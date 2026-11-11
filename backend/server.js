require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "data.json");
const FRONTEND_DIR = path.resolve(__dirname, "../frontend");
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) { console.error("JWT_SECRET belum diatur. Jalankan scripts/termux-install.sh."); process.exit(1); }
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const itemDefs = {
  box3: { label: "Box isi 3", min: 500 },
  box5outer: { label: "Box isi 5 luar (Slongsong)", min: 500 },
  box5inner: { label: "Box isi 5 dalam (Tatakan Polos)", min: 500 },
  paper: { label: "Kertas Minyak", min: 500 },
  mika: { label: "Mika roti roll", min: null }
};
const initialStock = { box3: 3861, box5outer: 3427, box5inner: 3559, paper: 1686, mika: 210 };
let db;
let writeQueue = Promise.resolve();

function freshDb() {
  return { version: 1, stock: { ...initialStock }, users: [], transactions: [], processed: [] };
}
async function persist() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + ".tmp";
  await fs.promises.writeFile(tmp, JSON.stringify(db, null, 2), { mode: 0o600 });
  await fs.promises.rename(tmp, DATA_FILE);
}
async function locked(fn) {
  const run = writeQueue.then(fn, fn);
  writeQueue = run.catch(() => {});
  return run;
}
function snapshot(user) {
  return { stock: { ...db.stock }, itemDefs, history: db.transactions.slice(-30).reverse(), user: user ? { username: user.username, role: user.role } : null };
}
function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!token) throw new Error("missing");
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: "Sesi tidak valid. Login kembali saat internet/server tersedia." }); }
}
function adminOnly(req, res, next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Khusus admin." });
  next();
}
function int(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(label + " harus bilangan bulat nol atau lebih.");
  return value;
}
function operationChanges(op) {
  const p = op.payload || {};
  if (op.type === "stock-in") {
    if (!Object.hasOwn(itemDefs, p.item)) throw new Error("Barang tidak dikenal.");
    const packs = int(p.packs ?? 0, "Jumlah pack");
    const perPack = int(p.perPack ?? 0, "Isi per pack");
    const extra = int(p.extra ?? 0, "Tambahan pcs");
    const total = packs * perPack + extra;
    if (!Number.isSafeInteger(total) || total <= 0) throw new Error("Jumlah barang masuk harus lebih dari nol.");
    return { changes: { [p.item]: total }, lines: { item: p.item, packs, perPack, extra, total }, date: p.date, note: p.note || "", location: "" };
  }
  if (op.type === "production") {
    const ori = int(p.ori ?? 0, "Ori");
    const beef = int(p.beef ?? 0, "Beef");
    const spicy = int(p.spicy ?? 0, "Spicy");
    const total = ori + beef + spicy;
    if (!Number.isSafeInteger(total) || total <= 0) throw new Error("Jumlah loyang harus lebih dari nol.");
    let changes;
    if (p.custom && p.custom.enabled) {
      const box3 = int(p.custom.box3 ?? 0, "Box isi 3 khusus");
      const box5 = int(p.custom.box5 ?? 0, "Box isi 5 khusus");
      const paper = int(p.custom.paper ?? 0, "Kertas khusus");
      changes = { box3: -box3, box5outer: -box5, box5inner: -box5, paper: -paper };
    } else {
      const use = total * 2;
      changes = { box3: -use, box5outer: -use, box5inner: -use, paper: -use };
    }
    return { changes, lines: { ori, beef, spicy, total, custom: p.custom || null }, date: p.date, note: p.note || "", location: p.location || "-" };
  }
  throw new Error("Jenis transaksi tidak dikenal.");
}
async function applyOperation(op, username) {
  if (!op.id || typeof op.id !== "string" || op.id.length > 100) throw new Error("ID transaksi tidak valid.");
  if (db.processed.includes(op.id)) return { id: op.id, duplicate: true };
  const parsed = operationChanges(op);
  for (const [key, delta] of Object.entries(parsed.changes)) {
    if (!Object.hasOwn(itemDefs, key) || !Number.isSafeInteger(delta)) throw new Error("Perubahan stok tidak valid.");
    if (db.stock[key] + delta < 0) throw new Error("Stok " + itemDefs[key].label + " tidak mencukupi. Periksa stok server sebelum mengulang transaksi.");
  }
  for (const [key, delta] of Object.entries(parsed.changes)) db.stock[key] += delta;
  db.transactions.push({
    id: op.id, type: op.type, date: parsed.date || new Date().toISOString().slice(0, 10),
    location: parsed.location, note: parsed.note, lines: parsed.lines, changes: parsed.changes,
    createdBy: username, createdAt: new Date().toISOString()
  });
  db.processed.push(op.id);
  if (db.processed.length > 5000) db.processed = db.processed.slice(-5000);
  return { id: op.id, accepted: true };
}

app.get("/api/health", (req, res) => res.json({ ok: true, service: "INSAN Stock Manager Local API", storage: "local-json", online: true }));
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  const user = db.users.find(x => x.username === username);
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) return res.status(401).json({ error: "Username atau password salah." });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
  res.json({ token, user: { username: user.username, role: user.role } });
});
app.get("/api/state", auth, (req, res) => res.json(snapshot(req.user)));
app.post("/api/sync", auth, async (req, res) => {
  const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
  if (!operations.length || operations.length > 100) return res.status(400).json({ error: "Kirim 1 sampai 100 transaksi per sinkronisasi." });
  const result = await locked(async () => {
    const accepted = [], rejected = [];
    for (const op of operations) {
      try { accepted.push(await applyOperation(op, req.user.username)); }
      catch (e) { rejected.push({ id: op?.id || null, error: e.message }); }
    }
    await persist();
    return { accepted, rejected, state: snapshot(req.user) };
  });
  res.json(result);
});
app.get("/api/report", auth, (req, res) => {
  const s = db.stock, fmt = n => Number(n || 0).toLocaleString("id-ID");
  const report = `*INSAN*:
Box isi 3 : ${fmt(s.box3)} pcs
Box isi 5 luar (Slongsong) : ${fmt(s.box5outer)} pcs
Box isi 5 dalam (Tatakan Polos) : ${fmt(s.box5inner)} pcs
Kertas Minyak : ${fmt(s.paper)} pcs
Mika roti roll : ${fmt(s.mika)} pcs

_________________
Note‼️
Box isi 5/3 stok limit: 500 pcs
Kertas minyak stok limit: 1 pack (500 pcs)
____________`;
  res.json({ report, stock: s });
});
app.get("/api/users", auth, adminOnly, (req, res) => res.json({ users: db.users.map(({ username, role }) => ({ username, role })) }));
app.post("/api/users", auth, adminOnly, async (req, res) => {
  const { username, password, role = "staff" } = req.body || {};
  if (!username || !password || password.length < 10 || !["admin", "staff"].includes(role)) return res.status(400).json({ error: "Username, password minimal 10 karakter, dan role valid wajib diisi." });
  const result = await locked(async () => {
    if (db.users.some(x => x.username === username)) throw new Error("Username sudah digunakan.");
    db.users.push({ id: require("crypto").randomUUID(), username, passwordHash: await bcrypt.hash(password, 12), role });
    await persist();
  });
  res.json({ ok: true, username, role });
});

app.use(express.static(FRONTEND_DIR, { extensions: ["html"] }));
app.get("*", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "index.html")));

async function start() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true });
  try { db = JSON.parse(await fs.promises.readFile(DATA_FILE, "utf8")); }
  catch { db = freshDb(); }
  db.stock = { ...initialStock, ...(db.stock || {}) };
  db.users ||= []; db.transactions ||= []; db.processed ||= [];
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && !db.users.some(x => x.username === process.env.ADMIN_USERNAME)) {
    db.users.push({ id: require("crypto").randomUUID(), username: process.env.ADMIN_USERNAME, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: "admin" });
    console.log("Akun admin awal dibuat:", process.env.ADMIN_USERNAME);
  }
  await persist();
  app.listen(PORT, "0.0.0.0", () => console.log(`INSAN Stock Manager aktif di http://0.0.0.0:${PORT}`));
}
start().catch(err => { console.error(err); process.exit(1); });
