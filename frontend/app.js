const API=(window.INSAN_CONFIG?.API_BASE||"").replace(/\/$/,"");
const $=id=>document.getElementById(id);
let token=localStorage.getItem("insan_token"), state=null, cachedUser=null;
const DB_NAME="insan-stock-local", STORE="kv", QUEUE="queue";
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE);if(!d.objectStoreNames.contains(QUEUE))d.createObjectStore(QUEUE,{keyPath:"id"});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function kvGet(key){const d=await openDB();return new Promise((resolve,reject)=>{const r=d.transaction(STORE).objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function kvSet(key,value){const d=await openDB();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,"readwrite");t.objectStore(STORE).put(value,key);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
async function kvDelete(key){const d=await openDB();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,"readwrite");t.objectStore(STORE).delete(key);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
async function queueAll(){const d=await openDB();return new Promise((resolve,reject)=>{const r=d.transaction(QUEUE).objectStore(QUEUE).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function queueAdd(op){const d=await openDB();return new Promise((resolve,reject)=>{const t=d.transaction(QUEUE,"readwrite");t.objectStore(QUEUE).put(op);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
async function queueRemove(ids){const d=await openDB();return new Promise((resolve,reject)=>{const t=d.transaction(QUEUE,"readwrite"),s=t.objectStore(QUEUE);ids.forEach(id=>s.delete(id));t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
function newId(){return (crypto.randomUUID?crypto.randomUUID():"tx-"+Date.now()+"-"+Math.random().toString(36).slice(2));}
function setStatus(text,kind="muted"){$("connection").textContent=text;$("connection").className=kind;}
function themeInit(){if(localStorage.getItem("insan_theme")==="light")document.documentElement.classList.add("light");}
function toggleTheme(){document.documentElement.classList.toggle("light");localStorage.setItem("insan_theme",document.documentElement.classList.contains("light")?"light":"dark");}
async function api(path,opts={}){const r=await fetch(API+"/api"+path,{...opts,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{}),...(opts.headers||{})}});let d={};try{d=await r.json();}catch{}if(!r.ok){const e=new Error(d.error||"Permintaan gagal");e.status=r.status;throw e;}return d;}
function showLogin(){ $("login").classList.remove("hidden");$("app").classList.add("hidden");}
function showApp(){ $("login").classList.add("hidden");$("app").classList.remove("hidden");}
async function login(){try{const d=await api("/auth/login",{method:"POST",body:JSON.stringify({username:$("username").value,password:$("password").value})});token=d.token;cachedUser=d.user;localStorage.setItem("insan_token",token);await kvSet("user",cachedUser);await refresh();}catch(e){$("loginMsg").textContent=e.message;}}
async function logout(){token=null;cachedUser=null;localStorage.removeItem("insan_token");await kvDelete("user");showLogin();}
async function refresh(){try{state=await api("/state");await kvSet("state",state);showApp();cachedUser=state.user;await renderAll();setStatus("Terhubung · data server terbaru","ok");await syncQueue();}catch(e){if(e instanceof TypeError || !navigator.onLine){state=await kvGet("state");cachedUser=await kvGet("user");if(state&&cachedUser){showApp();await renderAll();setStatus("Offline · perubahan disimpan di perangkat","low");}else{showLogin();$("loginMsg").textContent="Login pertama membutuhkan koneksi ke server.";}}else if(e.status===401){showLogin();$("loginMsg").textContent=e.message;}else{state=await kvGet("state");cachedUser=await kvGet("user");if(state&&cachedUser){showApp();await renderAll();setStatus("Server tidak tersedia · mode offline","low");}else showLogin();}}}
async function renderAll(){if(!state)return;syncActiveNav();$("who").textContent=(cachedUser?.username||state.user?.username||"Pengguna")+" · "+(cachedUser?.role||state.user?.role||"offline");renderStock();renderHistory();renderDailyTargets();await loadReport();const q=await queueAll();$("pendingCount").textContent=q.length?(" · "+q.length+" transaksi menunggu sinkronisasi"):"";checkForUpdates();}
function renderStock(){const defs=state.itemDefs||{};$("stockGrid").innerHTML=Object.entries(state.stock||{}).map(([k,v])=>{const def=defs[k]||{label:k,min:null};return `<div class="panel"><div class="muted">${def.label}</div><div class="qty">${Number(v).toLocaleString("id-ID")} pcs</div><div class="${def.min!==null&&v<def.min?'low':'ok'} muted">${def.min===null?'Batas minimum belum ditetapkan':v<def.min?'Di bawah minimum '+def.min:'Aman · minimum '+def.min}</div></div>`;}).join("");}
function toggleMenu(){const nav=$("mainNav"),backdrop=$("navBackdrop"),btn=$("menuToggle");if(!nav||!backdrop||!btn)return;const open=!nav.classList.contains("open");nav.classList.toggle("open",open);backdrop.classList.toggle("visible",open);btn.setAttribute("aria-expanded",String(open));btn.setAttribute("aria-label",open?"Tutup navigasi":"Buka navigasi");document.body.classList.toggle("nav-open",open);}
function closeMenu(){const nav=$("mainNav"),backdrop=$("navBackdrop"),btn=$("menuToggle");if(!nav||!backdrop||!btn)return;nav.classList.remove("open");backdrop.classList.remove("visible");btn.setAttribute("aria-expanded","false");btn.setAttribute("aria-label","Buka navigasi");document.body.classList.remove("nav-open");}
function syncActiveNav(){const current=document.querySelector(".tab:not(.hidden)");if(!current)return;document.querySelectorAll("#mainNav button[onclick^='showTab']").forEach(btn=>{const active=btn.getAttribute("onclick").includes("'"+current.id+"'");btn.classList.toggle("nav-active",active);if(active)btn.setAttribute("aria-current","page");else btn.removeAttribute("aria-current");});}
function showTab(id){const target=$(id);if(!target)return;document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));target.classList.remove("hidden");syncActiveNav();closeMenu();if(id==="report")loadReport();if(id==="history")renderHistory();if(id==="about")loadAbout();}
async function loadAbout(){
  const versionEl=$("aboutVersion"), list=$("changeLogList"), status=$("changeLogStatus");
  const remoteList=$("latestCommitList"), remoteStatus=$("latestCommitStatus"), applyBtn=$("applyLatestCommit");
  if(!list)return;
  try{
    const data=await api("/update/history");
    if(versionEl)versionEl.textContent="Versi "+(data.version||"—");
    list.replaceChildren();
    (data.commits||[]).forEach(item=>{
      const card=document.createElement("article");card.className="history-card";
      const title=document.createElement("b");title.textContent=item.message||"Pembaruan";
      const meta=document.createElement("div");meta.className="muted";meta.textContent=(item.date||"")+(item.sha?" · "+item.sha:"");
      card.append(title,meta);list.appendChild(card);
    });
    if(status)status.textContent="Riwayat commit yang sudah terpasang · hingga 8 commit terakhir.";
  }catch(e){
    if(status)status.textContent="Riwayat lokal belum tersedia: "+e.message;
  }
  try{
    const remote=await api("/update/commits");
    const commits=remote.commits||[];
    window.insanLatestCommit=commits[0]?.sha||null;
    window.insanUpdateAvailable=!!(window.insanLatestCommit&&window.insanLatestCommit!==remote.current&&(cachedUser?.role||state?.user?.role)==="admin");
    if(remoteList)remoteList.replaceChildren();
    commits.forEach((item,index)=>{
      if(!remoteList)return;
      const card=document.createElement("article");card.className="history-card";
      const title=document.createElement("b");title.textContent=item.message||"Pembaruan";
      const meta=document.createElement("div");meta.className="muted";
      const date=item.date?new Date(item.date).toLocaleString("id-ID"):"Tanggal tidak tersedia";
      meta.textContent=date+" · "+(item.author||"Kontributor")+" · "+item.shortSha+(item.sha===remote.current?" · Terpasang":"");
      card.append(title,meta);
      if(index===0&&item.sha!==remote.current){
        const tag=document.createElement("p");tag.className="muted";tag.textContent="Commit terbaru pada branch main";
        card.appendChild(tag);
      }
      remoteList.appendChild(card);
    });
    if(remoteStatus)remoteStatus.textContent=commits.length
      ?(remote.current===commits[0].sha?"Aplikasi sudah berada pada commit terbaru.":"Ditemukan "+commits.length+" commit terbaru dari GitHub.")
      :"Belum ada commit yang dapat ditampilkan.";
    if(applyBtn){
      const admin=(cachedUser?.role||state?.user?.role)==="admin";
      applyBtn.hidden=!admin||!window.insanUpdateAvailable;
      applyBtn.disabled=!window.insanUpdateAvailable;
      applyBtn.textContent=window.insanUpdateAvailable?"Terapkan commit terbaru":"Sudah menggunakan commit terbaru";
    }
  }catch(e){
    window.insanLatestCommit=null;window.insanUpdateAvailable=false;
    if(remoteStatus)remoteStatus.textContent="Gagal mengambil commit dari GitHub: "+e.message;
    if(applyBtn)applyBtn.hidden=true;
  }
}

document.addEventListener("keydown",e=>{if(e.key==="Escape")closeMenu();});
function renderHistory(){
const filter=$("historyFilter")?$("historyFilter").value:"all";
const list=(state.history||[]).filter(x=>filter==="all"||x.type===filter);
const admin=(cachedUser?.role||state.user?.role)==="admin";
const root=$("historyList");root.innerHTML="";
list.forEach(x=>{
const card=document.createElement("article");card.className="history-card";
const title=document.createElement("b");title.textContent=x.type==="stock-in"?"Barang masuk":x.type==="stock-out"?"Pengurangan stok manual":"Target produksi";card.appendChild(title);
const meta=document.createElement("div");meta.className="muted";meta.textContent=(x.date||"")+" · Oleh: "+(x.createdBy||"-");card.appendChild(meta);
const detail=document.createElement("div");detail.className="detail";
const l=x.lines||{};detail.textContent=x.type==="stock-in"?"Barang: "+(state.itemDefs?.[l.item]?.label||l.item)+" · Total masuk: "+(l.total||0)+" pcs":x.type==="stock-out"?"Barang: "+(state.itemDefs?.[l.item]?.label||l.item)+" · Dikurangi: "+(l.quantity||0)+" pcs · Alasan: "+(l.reason||x.note||"-"):"Outlet: "+(x.location||"-")+" · Ori: "+(l.ori||0)+" · Beef: "+(l.beef||0)+" · Spicy: "+(l.spicy||0)+" · Cheese: "+(l.cheese||0)+" · Total: "+(l.total||0)+" loyang"+(l.requestNote?" · Request: "+l.requestNote:"");
if(x.note)detail.textContent+=" · Catatan: "+x.note;card.appendChild(detail);
if(admin){const btn=document.createElement("button");btn.className="danger";btn.textContent="Hapus transaksi";btn.onclick=()=>deleteTransaction(x.id);card.appendChild(btn);}
root.appendChild(card);});
if(!list.length)root.textContent="Belum ada riwayat pada filter ini.";
}
async function deleteTransaction(id){if(!id||!confirm("Yakin menghapus transaksi ini? Stok akan dikembalikan otomatis. Tindakan ini tidak dapat dibatalkan."))return;try{const d=await api("/transactions/"+encodeURIComponent(id),{method:"DELETE"});state=d.state;await kvSet("state",state);await renderAll();$("syncErrors").textContent="Transaksi dihapus; perubahan stok sudah dibatalkan.";showTab("history");}catch(e){alert("Gagal menghapus transaksi: "+e.message);}}
function applyLocal(op){const p=op.payload;let changes={};if(op.type==="stock-in"){const total=(p.packs||0)*(p.perPack||0)+(p.extra||0);changes[p.item]=total;}else if(op.type==="stock-out"){changes[p.item]=-(p.quantity||0);}else{const total=(p.ori||0)+(p.beef||0)+(p.spicy||0)+(p.cheese||0);if(p.custom?.enabled){changes={box3:-(p.custom.box3||0),box5outer:-(p.custom.box5||0),box5inner:-(p.custom.box5||0),paper:-(p.custom.box5||0)};}else{const use=total*2;changes={box3:-use,box5outer:-use,box5inner:-use,paper:-use};}}
for(const [k,d] of Object.entries(changes)){if(!Number.isSafeInteger(d)||!Number.isSafeInteger(state.stock[k]+d)||state.stock[k]+d<0)throw Error("Stok lokal "+k+" tidak mencukupi.");}
for(const [k,d] of Object.entries(changes))state.stock[k]+=d;
state.history.unshift({id:op.id,type:op.type,date:p.date||new Date().toISOString().slice(0,10),location:p.location||"",lines:op.type==="stock-in"?{item:p.item,packs:p.packs,perPack:p.perPack,extra:p.extra}:p,changes,createdBy:cachedUser?.username||"offline",createdAt:new Date().toISOString()});state.history=state.history.slice(0,30);}
async function submitOperation(type,payload,msgId){const op={id:newId(),type,payload};try{const d=await api("/sync",{method:"POST",body:JSON.stringify({operations:[op]})});if(d.rejected?.length){const rejected=new Error(d.rejected[0].error);rejected.status=409;throw rejected;}state=d.state;await kvSet("state",state);$(msgId).textContent="Tersimpan dan tersinkron ke server.";}catch(e){if(!(e instanceof TypeError)&&navigator.onLine&&e.status&&e.status<500)throw e;applyLocal(op);await queueAdd(op);await kvSet("state",state);$(msgId).textContent="Disimpan offline di perangkat. Akan dikirim saat tersambung.";}await renderAll();}
async function stockIn(){try{await submitOperation("stock-in",{item:$("inItem").value,packs:+$("packs").value,perPack:+$("perPack").value,extra:+$("extra").value,note:$("inNote").value},"inMsg");}catch(e){$("inMsg").textContent=e.message;}}
let editingTargetId=null;
const pvars=["ori","beef","spicy","cheese"];
const plabel={ori:"Ori",beef:"Beef",spicy:"Spicy",cheese:"Cheese"};
function packData(){const o={};pvars.forEach(k=>{const n=plabel[k],on=$("packCustom"+n).checked;o[k]={enabled:on,box3:on?Number($("packBox3"+n).value):0,box5:on?Number($("packBox5"+n).value):0};});return o;}
function productionPreview(){let total=0,b3=0,b5=0,details=[];pvars.forEach(k=>{const q=Math.max(0,Number($(k).value)||0),n=plabel[k],on=$("packCustom"+n).checked,x3=on?(Number($("packBox3"+n).value)||0):q*2,x5=on?(Number($("packBox5"+n).value)||0):q*2;total+=q;b3+=x3;b5+=x5;if(q)details.push(n+": "+q+" loyang ("+x5+" Box isi 5, "+x3+" Box isi 3)");});$("productionPreview").textContent="Total "+total+" loyang · "+(details.join(" | ")||"Isi jumlah loyang")+". Pengurangan: Box isi 3 "+b3+", Box isi 5 luar/dalam "+b5+", Kertas Minyak "+b5+".";}
pvars.forEach(k=>{const n=plabel[k];[k,"packBox3"+n,"packBox5"+n].forEach(id=>$(id).addEventListener("input",productionPreview));$("packCustom"+n).addEventListener("change",()=>{$("packFields"+n).classList.toggle("hidden",!$("packCustom"+n).checked);productionPreview();});});
$("prodDate").addEventListener("change",()=>{renderDailyTargets();renderTargetSource();});
function renderTargetSource(){const s=$("targetSource");if(!s||!state)return;const prev=s.value,rows=(state.history||[]).filter(x=>x.type==="production"&&x.date===$("prodDate").value);s.innerHTML='<option value="">Pilih target tanggal ini</option>';rows.forEach(x=>{const o=document.createElement("option");o.value=x.id;o.textContent=(x.location||"Outlet")+" · "+(x.lines?.total||0)+" loyang";s.appendChild(o);});if(rows.some(x=>x.id===prev))s.value=prev;}
function loadTargetForRequest(){const id=$("targetSource").value,tx=(state?.history||[]).find(x=>x.id===id&&x.type==="production");if(!tx){$("editTargetMsg").textContent="Pilih target produksi.";return;}const l=tx.lines||{},packs=l.packagingByVariant||{};$("prodDate").value=tx.date||$("prodDate").value;$("location").value=tx.location||"";pvars.forEach(k=>{const n=plabel[k],p=packs[k];$(k).value=Number(l[k]||0);$("packCustom"+n).checked=!!p?.enabled;$("packFields"+n).classList.toggle("hidden",!p?.enabled);$("packBox3"+n).value=Number(p?.box3||0);$("packBox5"+n).value=Number(p?.box5||0);});$("requestNote").value=l.requestNote||"";$("prodNote").value=tx.note||"";editingTargetId=tx.id;$("prodSubmit").textContent="Simpan perubahan target";$("editTargetMsg").textContent="Edit target "+tx.location+". Kemasan dapat diatur per varian.";productionPreview();renderDailyTargets();}
async function production(){try{const vals=pvars.map(k=>Number($(k).value));if(vals.some(v=>!Number.isSafeInteger(v)||v<0)||vals.reduce((a,b)=>a+b,0)<=0)throw Error("Isi setidaknya satu jumlah loyang yang valid.");if(!$("location").value)throw Error("Pilih outlet terlebih dahulu.");const packagingByVariant=packData();for(const k of pvars){const p=packagingByVariant[k];if(p.enabled&&(!Number.isSafeInteger(p.box3)||p.box3<0||!Number.isSafeInteger(p.box5)||p.box5<0))throw Error("Jumlah kemasan "+plabel[k]+" tidak valid.");}const payload={date:$("prodDate").value,location:$("location").value,ori:vals[0],beef:vals[1],spicy:vals[2],cheese:vals[3],packagingByVariant,requestNote:$("requestNote").value.trim(),note:$("prodNote").value};if(editingTargetId){if(!navigator.onLine)throw Error("Edit target lama membutuhkan koneksi internet.");const d=await api("/transactions/"+encodeURIComponent(editingTargetId),{method:"PUT",body:JSON.stringify(payload)});state=d.state;await kvSet("state",state);$("prodMsg").textContent="Target diperbarui dan stok disesuaikan berdasarkan selisih.";}else await submitOperation("production",payload,"prodMsg");editingTargetId=null;$("prodSubmit").textContent="Tambah target outlet";pvars.forEach(k=>{const n=plabel[k];$(k).value=0;$("packCustom"+n).checked=false;$("packFields"+n).classList.add("hidden");$("packBox3"+n).value=0;$("packBox5"+n).value=0;});$("location").value="";$("requestNote").value="";$("prodNote").value="";$("targetSource").value="";productionPreview();await renderAll();}catch(e){$("prodMsg").textContent=e.message;}}
async function manualStockOut(){try{const quantity=Number($("outQuantity").value);const reason=$("outReason").value.trim();if(!Number.isSafeInteger(quantity)||quantity<=0)throw Error("Jumlah pengurangan harus bilangan bulat lebih dari nol.");if(!reason)throw Error("Alasan pengurangan wajib diisi.");if(!confirm("Kurangi stok "+quantity+" pcs? Pastikan barang dan alasan sudah benar."))return;await submitOperation("stock-out",{item:$("outItem").value,quantity,note:reason,reason,date:new Date().toISOString().slice(0,10)},"outMsg");$("outQuantity").value="";$("outReason").value="";}catch(e){$("outMsg").textContent=e.message;}}
function renderDailyTargets(){
const box=$("targetDailyReport");if(!box||!state)return;
const date=$("prodDate").value;
const rows=(state.history||[]).filter(x=>x.type==="production"&&x.date===date).slice().sort((x,y)=>String(x.createdAt||"").localeCompare(String(y.createdAt||"")));
renderTargetSource();
const groups=new Map();
rows.forEach(x=>{
const name=x.location||"Outlet tidak diketahui";
if(!groups.has(name))groups.set(name,{Ori:0,Beef:0,Spicy:0,Cheese:0,total:0});
const g=groups.get(name),l=x.lines||{};
g.Ori+=Number(l.ori||0);g.Beef+=Number(l.beef||0);g.Spicy+=Number(l.spicy||0);g.Cheese+=Number(l.cheese||0);
g.total+=Number(l.ori||0)+Number(l.beef||0)+Number(l.spicy||0)+Number(l.cheese||0);
});
box.innerHTML="";
const heading=document.createElement("b");heading.textContent="Rekap target · "+(date||"-");box.appendChild(heading);
if(!groups.size){const p=document.createElement("p");p.className="muted";p.textContent="Belum ada target untuk tanggal ini.";box.appendChild(p);return;}
groups.forEach((variants,outlet)=>{
const card=document.createElement("section");card.className="outlet-target-card";
const top=document.createElement("div");top.className="outlet-target-heading";
const h=document.createElement("h3");h.textContent=outlet;
const total=document.createElement("strong");total.textContent="Total "+variants.total.toLocaleString("id-ID")+" Loyang";
top.append(h,total);card.appendChild(top);
Object.entries(variants).filter(([name,count])=>name!=="total"&&count>0).forEach(([variant,count])=>{
const line=document.createElement("div");line.className="outlet-target-line";
const name=document.createElement("span");name.textContent=variant;
const qty=document.createElement("strong");qty.textContent=count.toLocaleString("id-ID")+" Loyang";
line.append(name,qty);card.appendChild(line);
});
box.appendChild(card);
});
}
async function checkForUpdates(){if(!token||!navigator.onLine)return;try{const d=await api("/update/check");if(d.available){window.insanLatestCommit=d.latest;window.insanUpdateAvailable=(cachedUser?.role||state?.user?.role)==="admin";$("updateNotice").classList.remove("hidden");$("updateTitle").textContent="Pembaruan INSAN tersedia";const admin=(cachedUser?.role||state?.user?.role)==="admin";$("updateMessage").textContent=d.message+(admin?" · Tekan tombol untuk memperbarui.":" · Hubungi admin untuk memasang pembaruan.");$("updateButton").hidden=!admin;window.insanUpdateAvailable=admin;}else{$("updateNotice").classList.add("hidden");window.insanUpdateAvailable=false;window.insanLatestCommit=null;}}catch(e){/* update check is optional while offline */}}
async function applyUpdate(commitSha=window.insanLatestCommit){if(!window.insanUpdateAvailable||!commitSha)return;if((await queueAll()).length){alert("Sinkronkan transaksi yang masih tertunda sebelum memperbarui aplikasi.");return;}if(!confirm("Terapkan commit "+commitSha.slice(0,7)+" dari GitHub? Server akan dimulai ulang otomatis. Data stok dan riwayat tetap disimpan."))return;try{$("updateButton").disabled=true;$("updateButton").textContent="Memperbarui…";const d=await api("/update/apply",{method:"POST",body:JSON.stringify({commitSha})});$("updateMessage").textContent=d.message+" Halaman akan tersambung kembali setelah server aktif.";$("updateButton").textContent="Menunggu server…";setTimeout(()=>{let attempts=0;const watcher=setInterval(async()=>{attempts++;try{const r=await fetch(API+"/api/health",{cache:"no-store"});if(r.ok){clearInterval(watcher);location.reload();}}catch(e){}if(attempts>=90)clearInterval(watcher);},3000);},5000);}catch(e){$("updateButton").disabled=false;$("updateButton").textContent="Update Sekarang";alert("Pembaruan gagal dimulai: "+e.message);}}
async function syncQueue(){if(!navigator.onLine||!token)return;const queue=await queueAll();if(!queue.length)return;try{const d=await api("/sync",{method:"POST",body:JSON.stringify({operations:queue.slice(0,100)})});await queueRemove(d.accepted.map(x=>x.id));state=d.state;await kvSet("state",state);if(d.rejected.length){setStatus(d.rejected.length+" transaksi perlu diperiksa: stok server berubah","low");$("syncErrors").textContent=d.rejected.map(x=>x.error).join(" · ");}else{setStatus("Semua transaksi tersinkron","ok");$("syncErrors").textContent="";}await renderAll();}catch(e){setStatus("Belum dapat sinkron · data aman tersimpan lokal","low");}}
async function loadReport(){if(!state)return;const s=state.stock,fmt=n=>Number(n||0).toLocaleString("id-ID");$("reportText").value=`*INSAN*:
Box isi 3 : ${fmt(s.box3)}pcs
Box isi 5 luar : ${fmt(s.box5outer)}pcs
Box isi 5 dalam : ${fmt(s.box5inner)}pcs
Kertas Minyak: ${fmt(s.paper)}pcs
Mika roti roll : ${fmt(s.mika)}pcs`;}
function generateFullStockReport(){
const source=$("stockOpnameInput").value;
if(!source.trim()){ $("stockOpnameMsg").textContent="Tempel pesan stock opname terlebih dahulu."; return; }
const section=/\*INSAN\*:[\s\S]*?(?=\n(?:_{5,}|-{5,})|$)/i;
if(!section.test(source)){ $("stockOpnameMsg").textContent="Bagian *INSAN* tidak ditemukan. Pastikan pesan memiliki judul *INSAN*:. Tidak ada teks yang diubah."; return; }
const s=state?.stock;
if(!s){ $("stockOpnameMsg").textContent="Data stok belum tersedia. Hubungkan ke server lalu perbarui data."; return; }
const fmt=n=>Number(n||0).toLocaleString("id-ID");
const replacement=`*INSAN*:
Box isi 3 : ${fmt(s.box3)}pcs
Box isi 5 luar : ${fmt(s.box5outer)}pcs
Box isi 5 dalam : ${fmt(s.box5inner)}pcs
Kertas Minyak: ${fmt(s.paper)}pcs
Mika roti roll : ${fmt(s.mika)}pcs`;
$("reportText").value=source.replace(section,replacement);
$("stockOpnameMsg").textContent="Berhasil! Hanya bagian *INSAN* yang diperbarui menggunakan stok terbaru dari database.";
}
async function copyReport(){try{await navigator.clipboard.writeText($("reportText").value);alert("Laporan disalin.");}catch{$("reportText").select();document.execCommand("copy");alert("Laporan disalin.");}}
function updateLiveClock(){const now=new Date();const time=$("liveClock"),date=$("liveDate");if(time)time.textContent=new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(now);if(date)date.textContent=new Intl.DateTimeFormat("id-ID",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).format(now);}
themeInit();updateLiveClock();setInterval(updateLiveClock,1000);
$("prodDate").value=new Date().toISOString().slice(0,10);
if("serviceWorker" in navigator && location.protocol!=="file:")navigator.serviceWorker.register("./sw.js",{updateViaCache:"none"}).catch(()=>{});
window.addEventListener("online",()=>{setStatus("Koneksi tersedia · memperbarui data…");refresh();});

// Alarm pulang kerja: jadwal disimpan lokal pada perangkat, tidak menyentuh database stok.
let workAlarmTimer=null, workAlarmAudio=null, workAlarmRinging=false;
const WORK_ALARM_KEY="insan_work_alarm_v1";
function alarmEndTime(start){const [h,m]=String(start||"07:00").split(":").map(Number);const total=(h*60+m+600)%1440;return String(Math.floor(total/60)).padStart(2,"0")+":"+String(total%60).padStart(2,"0");}
function renderWorkAlarm(){const input=$("workStartTime"),end=$("workEndTime"),status=$("workAlarmStatus"),toggle=$("workAlarmToggle"),stop=$("workAlarmStop");if(!input||!end)return;const saved=JSON.parse(localStorage.getItem(WORK_ALARM_KEY)||"null");if(saved?.start)input.value=saved.start;end.textContent=alarmEndTime(input.value)+" WIB";if(saved?.enabled){const when=new Date(saved.fireAt);status.textContent="Alarm aktif · "+input.value+" → "+alarmEndTime(input.value)+" WIB · "+(when.toLocaleDateString("id-ID"));toggle.textContent="Perbarui & aktifkan";stop.disabled=false;}else{status.textContent=workAlarmRinging?"Alarm sedang berbunyi.":"Alarm belum diaktifkan.";toggle.textContent="Aktifkan alarm";stop.disabled=true;}}
function stopAlarmSound(){workAlarmRinging=false;if(workAlarmAudio){try{workAlarmAudio.osc.stop();workAlarmAudio.ctx.close();}catch{}workAlarmAudio=null;}renderWorkAlarm();}
function playGentleAlarm(){if(workAlarmRinging)return;workAlarmRinging=true;renderWorkAlarm();try{const Ctx=window.AudioContext||window.webkitAudioContext;if(Ctx){const ctx=new Ctx(),osc=ctx.createOscillator(),gain=ctx.createGain();osc.type="sine";osc.frequency.value=659.25;gain.gain.value=.0001;osc.connect(gain);gain.connect(ctx.destination);osc.start();gain.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.8);let step=0;const melody=[659.25,783.99,987.77,783.99];const id=setInterval(()=>{if(!workAlarmRinging){clearInterval(id);return;}osc.frequency.setTargetAtTime(melody[++step%melody.length],ctx.currentTime,.08);},650);workAlarmAudio={ctx,osc};}}catch(e){console.warn("Audio alarm tidak tersedia",e);}if("Notification"in window&&Notification.permission==="granted")new Notification("Waktunya pulang! 🏡",{body:"Terima kasih sudah bekerja hari ini. Saatnya beristirahat.",tag:"insan-work-alarm"});}
async function toggleWorkAlarm(){const input=$("workStartTime"),start=input.value;if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(start)){alert("Pilih jam masuk kerja yang valid.");return;}if("Notification"in window&&Notification.permission==="default"){try{await Notification.requestPermission();}catch{}}const [h,m]=start.split(":").map(Number),now=new Date(),fire=new Date(now);fire.setHours(h,m,0,0);fire.setMinutes(fire.getMinutes()+600);if(fire<=now)fire.setDate(fire.getDate()+1);localStorage.setItem(WORK_ALARM_KEY,JSON.stringify({start,fireAt:fire.toISOString(),enabled:true}));workAlarmRinging=false;renderWorkAlarm();scheduleWorkAlarm();}
function stopWorkAlarm(){localStorage.removeItem(WORK_ALARM_KEY);if(workAlarmTimer)clearTimeout(workAlarmTimer);workAlarmTimer=null;stopAlarmSound();renderWorkAlarm();}
function scheduleWorkAlarm(){if(workAlarmTimer)clearTimeout(workAlarmTimer);const saved=JSON.parse(localStorage.getItem(WORK_ALARM_KEY)||"null");if(!saved?.enabled)return;const delay=new Date(saved.fireAt).getTime()-Date.now();if(delay<=0){localStorage.removeItem(WORK_ALARM_KEY);playGentleAlarm();return;}workAlarmTimer=setTimeout(()=>{localStorage.removeItem(WORK_ALARM_KEY);playGentleAlarm();renderWorkAlarm();},delay);}
if($("workStartTime")){$("workStartTime").addEventListener("input",()=>{$("workEndTime").textContent=alarmEndTime($("workStartTime").value)+" WIB";});renderWorkAlarm();scheduleWorkAlarm();document.addEventListener("visibilitychange",()=>{if(!document.hidden)scheduleWorkAlarm();});}
\nwindow.addEventListener("offline",()=>setStatus("Offline · tetap bisa mencatat stok","low"));
setInterval(checkForUpdates,300000);
(async()=>{cachedUser=await kvGet("user");if(token||cachedUser)await refresh();else showLogin();if(!navigator.onLine)setStatus("Offline","low");})();
