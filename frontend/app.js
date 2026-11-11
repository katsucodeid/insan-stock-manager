const API=(window.INSAN_CONFIG?.API_BASE||"").replace(/\/$/,"");
const $=id=>document.getElementById(id);
let token=localStorage.getItem("insan_token"), state=null, cachedUser=null;
const DB_NAME="insan-stock-local", STORE="kv", QUEUE="queue";
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE);if(!d.objectStoreNames.contains(QUEUE))d.createObjectStore(QUEUE,{keyPath:"id"});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function kvGet(key){const d=await openDB();return new Promise((resolve,reject)=>{const r=d.transaction(STORE).objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function kvSet(key,value){const d=await openDB();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,"readwrite");t.objectStore(STORE).put(value,key);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}\nasync function kvDelete(key){const d=await openDB();return new Promise((resolve,reject)=>{const t=d.transaction(STORE,"readwrite");t.objectStore(STORE).delete(key);t.oncomplete=resolve;t.onerror=()=>reject(t.error);});}
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
async function renderAll(){if(!state)return;$("who").textContent=(cachedUser?.username||state.user?.username||"Pengguna")+" · "+(cachedUser?.role||state.user?.role||"offline");renderStock();renderHistory();await loadReport();const q=await queueAll();$("pendingCount").textContent=q.length?(" · "+q.length+" transaksi menunggu sinkronisasi"):"";}
function renderStock(){const defs=state.itemDefs||{};$("stockGrid").innerHTML=Object.entries(state.stock||{}).map(([k,v])=>{const def=defs[k]||{label:k,min:null};return `<div class="panel"><div class="muted">${def.label}</div><div class="qty">${Number(v).toLocaleString("id-ID")} pcs</div><div class="${def.min!==null&&v<def.min?'low':'ok'} muted">${def.min===null?'Batas minimum belum ditetapkan':v<def.min?'Di bawah minimum '+def.min:'Aman · minimum '+def.min}</div></div>`;}).join("");}
function showTab(id){document.querySelectorAll(".tab").forEach(x=>x.classList.add("hidden"));$(id).classList.remove("hidden");if(id==="report")loadReport();}
function renderHistory(){const list=state.history||[];$("historyList").innerHTML=list.map(x=>`<div class="panel"><b>${x.type==="stock-in"?"Barang masuk":"Target produksi"}</b><div class="muted">${x.date||""} · ${x.location||x.createdBy||""}</div><small>${JSON.stringify(x.lines||{})}</small></div>`).join("")||"Belum ada riwayat.";}
function applyLocal(op){const p=op.payload;let changes={};if(op.type==="stock-in"){const total=(p.packs||0)*(p.perPack||0)+(p.extra||0);changes[p.item]=total;}else{const total=(p.ori||0)+(p.beef||0)+(p.spicy||0);if(p.custom?.enabled){changes={box3:-(p.custom.box3||0),box5outer:-(p.custom.box5||0),box5inner:-(p.custom.box5||0),paper:-(p.custom.paper||0)};}else{const use=total*2;changes={box3:-use,box5outer:-use,box5inner:-use,paper:-use};}}
for(const [k,d] of Object.entries(changes)){if(!Number.isSafeInteger(d)||!Number.isSafeInteger(state.stock[k]+d)||state.stock[k]+d<0)throw Error("Stok lokal "+k+" tidak mencukupi.");}
for(const [k,d] of Object.entries(changes))state.stock[k]+=d;
state.history.unshift({id:op.id,type:op.type,date:p.date||new Date().toISOString().slice(0,10),location:p.location||"",lines:op.type==="stock-in"?{item:p.item,packs:p.packs,perPack:p.perPack,extra:p.extra}:p,changes,createdBy:cachedUser?.username||"offline",createdAt:new Date().toISOString()});state.history=state.history.slice(0,30);}
async function submitOperation(type,payload,msgId){const op={id:newId(),type,payload};try{const d=await api("/sync",{method:"POST",body:JSON.stringify({operations:[op]})});if(d.rejected?.length){const rejected=new Error(d.rejected[0].error);rejected.status=409;throw rejected;}state=d.state;await kvSet("state",state);$(msgId).textContent="Tersimpan dan tersinkron ke server.";}catch(e){if(!(e instanceof TypeError)&&navigator.onLine&&e.status&&e.status<500)throw e;applyLocal(op);await queueAdd(op);await kvSet("state",state);$(msgId).textContent="Disimpan offline di perangkat. Akan dikirim saat tersambung.";}await renderAll();}
async function stockIn(){try{await submitOperation("stock-in",{item:$("inItem").value,packs:+$("packs").value,perPack:+$("perPack").value,extra:+$("extra").value,note:$("inNote").value},"inMsg");}catch(e){$("inMsg").textContent=e.message;}}
async function production(){try{await submitOperation("production",{date:$("prodDate").value,location:$("location").value,ori:+$("ori").value,beef:+$("beef").value,spicy:+$("spicy").value,custom:$("customEnabled").checked?{enabled:true,box3:+$("cBox3").value,box5:+$("cBox5").value,paper:+$("cPaper").value}:null,note:$("prodNote").value},"prodMsg");}catch(e){$("prodMsg").textContent=e.message;}}
async function syncQueue(){if(!navigator.onLine||!token)return;const queue=await queueAll();if(!queue.length)return;try{const d=await api("/sync",{method:"POST",body:JSON.stringify({operations:queue.slice(0,100)})});await queueRemove(d.accepted.map(x=>x.id));state=d.state;await kvSet("state",state);if(d.rejected.length){setStatus(d.rejected.length+" transaksi perlu diperiksa: stok server berubah","low");$("syncErrors").textContent=d.rejected.map(x=>x.error).join(" · ");}else{setStatus("Semua transaksi tersinkron","ok");$("syncErrors").textContent="";}await renderAll();}catch(e){setStatus("Belum dapat sinkron · data aman tersimpan lokal","low");}}
async function loadReport(){if(!state)return;const s=state.stock,fmt=n=>Number(n||0).toLocaleString("id-ID");$("reportText").value=`*INSAN*:
Box isi 3 : ${fmt(s.box3)} pcs
Box isi 5 luar (Slongsong) : ${fmt(s.box5outer)} pcs
Box isi 5 dalam (Tatakan Polos) : ${fmt(s.box5inner)} pcs
Kertas Minyak : ${fmt(s.paper)} pcs
Mika roti roll : ${fmt(s.mika)} pcs

_________________
Note‼️
Box isi 5/3 stok limit: 500 pcs
Kertas minyak stok limit: 1 pack (500 pcs)
____________`;}
async function copyReport(){try{await navigator.clipboard.writeText($("reportText").value);alert("Laporan disalin.");}catch{$("reportText").select();document.execCommand("copy");alert("Laporan disalin.");}}
themeInit();
$("prodDate").value=new Date().toISOString().slice(0,10);
if("serviceWorker" in navigator && location.protocol!=="file:")navigator.serviceWorker.register("./sw.js").catch(()=>{});
window.addEventListener("online",()=>{setStatus("Koneksi tersedia · memperbarui data…");refresh();});
window.addEventListener("offline",()=>setStatus("Offline · tetap bisa mencatat stok","low"));
(async()=>{cachedUser=await kvGet("user");if(token||cachedUser)await refresh();else showLogin();if(!navigator.onLine)setStatus("Offline","low");})();
