require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true }));

const itemDefs = {
  box3: { label: "Box isi 3", min: 500 },
  box5outer: { label: "Box isi 5 luar (Slongsong)", min: 500 },
  box5inner: { label: "Box isi 5 dalam (Tatakan Polos)", min: 500 },
  paper: { label: "Kertas Minyak", min: 500 },
  mika: { label: "Mika roti roll", min: null }
};
const StockSchema = new mongoose.Schema({
  key: { type: String, unique: true },
  qty: { type: Number, min: 0, default: 0 },
  updatedAt: { type: Date, default: Date.now }
});
const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, enum: ["admin", "staff"], default: "staff" }
});
const TxSchema = new mongoose.Schema({
  type: String, date: String, location: String, note: String,
  lines: mongoose.Schema.Types.Mixed, changes: mongoose.Schema.Types.Mixed,
  createdBy: String, createdAt: { type: Date, default: Date.now }
});
const Stock = mongoose.model("Stock", StockSchema);
const User = mongoose.model("User", UserSchema);
const Transaction = mongoose.model("Transaction", TxSchema);

const initialStock = { box3:3861, box5outer:3427, box5inner:3559, paper:1686, mika:210 };

async function ensureSeed() {
  for (const [key, qty] of Object.entries(initialStock)) {
    await Stock.updateOne({ key }, { $setOnInsert: { key, qty, updatedAt: new Date() } }, { upsert: true });
  }
  if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    const found = await User.findOne({ username: process.env.ADMIN_USERNAME });
    if (!found) {
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
      await User.create({ username: process.env.ADMIN_USERNAME, passwordHash, role: "admin" });
      console.log("Initial admin account created.");
    }
  }
}
function auth(req,res,next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try {
    if (!token) throw new Error("missing");
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ error:"Sesi tidak valid. Silakan login kembali." }); }
}
function adminOnly(req,res,next) {
  if (req.user.role !== "admin") return res.status(403).json({ error:"Khusus admin." });
  next();
}
async function getStockMap() {
  const rows = await Stock.find().lean();
  return Object.fromEntries(rows.map(x => [x.key, x.qty]));
}
async function applyChanges(changes, session) {
  for (const [key, delta] of Object.entries(changes)) {
    if (!(key in itemDefs) || !Number.isFinite(delta)) throw new Error("Perubahan stok tidak valid.");
    const filter = { key };
    if (delta < 0) filter.qty = { $gte: -delta };
    const result = await Stock.updateOne(filter, { $inc: { qty: delta }, $set: { updatedAt: new Date() } }, { session });
    if (result.modifiedCount !== 1) throw new Error("Stok " + itemDefs[key].label + " tidak mencukupi atau berubah di perangkat lain. Muat ulang stok.");
  }
}
async function saveTransaction(changes, transaction) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await applyChanges(changes, session);
      await Transaction.create([transaction], { session });
    });
  } finally { await session.endSession(); }
}

app.get("/api/health", (req,res) => res.json({ ok:true, service:"INSAN Stock Manager API" }));
app.post("/api/auth/login", async (req,res) => {
  const { username, password } = req.body || {};
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password || "", user.passwordHash))) return res.status(401).json({ error:"Username atau password salah." });
  const token = jwt.sign({ id:user._id, username:user.username, role:user.role }, process.env.JWT_SECRET, { expiresIn:"14d" });
  res.json({ token, user:{ username:user.username, role:user.role } });
});
app.get("/api/state", auth, async (req,res) => {
  const stock = await getStockMap();
  const history = await Transaction.find().sort({ createdAt:-1 }).limit(30).lean();
  res.json({ stock, itemDefs, history, user:{ username:req.user.username, role:req.user.role } });
});
app.post("/api/stock-in", auth, async (req,res) => {
  try {
    const { item, packs=0, perPack=0, extra=0, date, note="" } = req.body || {};
    if (!(item in itemDefs) || ![packs,perPack,extra].every(x => Number.isInteger(x) && x >= 0)) return res.status(400).json({ error:"Data barang masuk tidak valid." });
    const total = packs * perPack + extra;
    if (!Number.isSafeInteger(total) || total <= 0) return res.status(400).json({ error:"Jumlah barang masuk harus lebih dari nol." });
    const changes = { [item]: total };
    await saveTransaction(changes, { type:"stock-in", date:date || new Date().toISOString().slice(0,10), note, lines:{ item,packs,perPack,extra,total }, changes, createdBy:req.user.username });
    res.json({ ok:true, total, stock:await getStockMap() });
  } catch(e) { res.status(400).json({ error:e.message }); }
});
app.post("/api/production", auth, async (req,res) => {
  try {
    const { date, location, ori=0, beef=0, spicy=0, custom=null, note="" } = req.body || {};
    if (![ori,beef,spicy].every(x => Number.isInteger(x) && x >= 0) || ori+beef+spicy <= 0) return res.status(400).json({ error:"Jumlah loyang tidak valid." });
    const total = ori+beef+spicy;
    let changes;
    if (custom && custom.enabled) {
      const { box3=0, box5=0, paper=0 } = custom;
      if (![box3,box5,paper].every(x => Number.isInteger(x) && x >= 0)) return res.status(400).json({ error:"Rincian request khusus tidak valid." });
      changes = { box3:-box3, box5outer:-box5, box5inner:-box5, paper:-paper };
    } else {
      const use = total * 2;
      changes = { box3:-use, box5outer:-use, box5inner:-use, paper:-use };
    }
    await saveTransaction(changes, { type:"production", date:date || new Date().toISOString().slice(0,10), location:location || "-", note, lines:{ ori,beef,spicy,total,custom:custom || null }, changes, createdBy:req.user.username });
    res.json({ ok:true, totalLoyang:total, changes, stock:await getStockMap() });
  } catch(e) { res.status(400).json({ error:e.message }); }
});
app.get("/api/report", auth, async (req,res) => {
  const s = await getStockMap();
  const fmt = n => Number(n || 0).toLocaleString("id-ID");
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
  res.json({ report, stock:s });
});
app.post("/api/users", auth, adminOnly, async (req,res) => {
  const { username,password,role="staff" } = req.body || {};
  if (!username || !password || password.length < 10 || !["admin","staff"].includes(role)) return res.status(400).json({ error:"Username, password minimal 10 karakter, dan role valid wajib diisi." });
  if (await User.findOne({ username })) return res.status(409).json({ error:"Username sudah digunakan." });
  const passwordHash = await bcrypt.hash(password,12);
  await User.create({ username,passwordHash,role });
  res.json({ ok:true, username, role });
});
app.get("/api/users", auth, adminOnly, async (req,res) => {
  const users = await User.find().select("username role").lean();
  res.json({ users });
});
const port = process.env.PORT || 10000;
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await ensureSeed();
  app.listen(port, "0.0.0.0", () => console.log(`INSAN API running on ${port}`));
}).catch(err => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
