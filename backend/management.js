const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

module.exports = function registerManagementRoutes(app, ctx) {
  const { auth, adminOnly, locked, persist, getDb, dataDir, dataFile, itemDefs } = ctx;
  const backupDir = path.join(dataDir, "backups");
  const audit = async (user, action, details = {}) => {
    const db = getDb();
    db.auditLog ||= [];
    db.auditLog.push({ id: crypto.randomUUID(), at: new Date().toISOString(), username: user?.username || "system", role: user?.role || "system", action, details });
    if (db.auditLog.length > 10000) db.auditLog = db.auditLog.slice(-10000);
  };
  const safeDb = value => value && typeof value === "object" && !Array.isArray(value)
    && value.stock && typeof value.stock === "object"
    && Array.isArray(value.users) && Array.isArray(value.transactions) && Array.isArray(value.processed)
    && Object.keys(itemDefs).every(k => Number.isSafeInteger(value.stock[k]) && value.stock[k] >= 0)
    && value.users.every(u => u && typeof u.username === "string" && typeof u.passwordHash === "string");
  const makeBackup = async reason => {
    await fs.promises.mkdir(backupDir, { recursive: true, mode: 0o700 });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = path.join(backupDir, "insan-" + stamp + "-" + reason + ".json");
    await fs.promises.copyFile(dataFile, file, fs.constants.COPYFILE_EXCL);
    await fs.promises.chmod(file, 0o600);
    return { name: path.basename(file), size: (await fs.promises.stat(file)).size, createdAt: new Date().toISOString() };
  };

  app.get("/api/admin/backups", auth, adminOnly, async (req, res) => {
    try {
      await fs.promises.mkdir(backupDir, { recursive: true, mode: 0o700 });
      const names = (await fs.promises.readdir(backupDir)).filter(n => /^insan-[\w.-]+\.json$/.test(n));
      const files = await Promise.all(names.map(async name => { const s = await fs.promises.stat(path.join(backupDir, name)); return { name, size: s.size, modifiedAt: s.mtime.toISOString() }; }));
      files.sort((a,b) => b.modifiedAt.localeCompare(a.modifiedAt));
      res.json({ backups: files });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.post("/api/admin/backups", auth, adminOnly, async (req, res) => {
    try {
      const result = await locked(async () => { const b = await makeBackup("manual"); await audit(req.user, "backup.create", { name: b.name }); await persist(); return b; });
      res.json({ ok: true, backup: result });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get("/api/admin/backups/:name/download", auth, adminOnly, async (req, res) => {
    const name = path.basename(req.params.name);
    if (name !== req.params.name || !/^insan-[\w.-]+\.json$/.test(name)) return res.status(400).json({ error: "Nama backup tidak valid." });
    const file = path.join(backupDir, name);
    if (!fs.existsSync(file)) return res.status(404).json({ error: "Backup tidak ditemukan." });
    res.download(file, name);
  });
  app.post("/api/admin/backups/restore", auth, adminOnly, async (req, res) => {
    const name = String(req.body?.name || "");
    if (path.basename(name) !== name || !/^insan-[\w.-]+\.json$/.test(name)) return res.status(400).json({ error: "Nama backup tidak valid." });
    try {
      const result = await locked(async () => {
        const source = path.join(backupDir, name);
        const parsed = JSON.parse(await fs.promises.readFile(source, "utf8"));
        if (!safeDb(parsed)) throw new Error("Struktur backup tidak valid atau tidak kompatibel. Database aktif tidak diubah.");
        const before = await makeBackup("before-restore");
        const current = getDb();
        parsed.settings = { ...(current.settings || {}), ...(parsed.settings || {}) };
        parsed.auditLog = Array.isArray(parsed.auditLog) ? parsed.auditLog : [];
        parsed.auditLog.push({ id: crypto.randomUUID(), at: new Date().toISOString(), username: req.user.username, role: req.user.role, action: "backup.restore", details: { source: name, safetyBackup: before.name } });
        ctx.setDb(parsed);
        await persist();
        return { ok: true, safetyBackup: before.name };
      });
      res.json(result);
    } catch (e) { res.status(400).json({ error: e.message }); }
  });

  app.get("/api/admin/settings", auth, adminOnly, (req, res) => {
    const settings = getDb().settings || {};
    res.json({ minStock: { ...(settings.minStock || {}) } });
  });
  app.put("/api/admin/settings/min-stock", auth, adminOnly, async (req, res) => {
    try {
      const input = req.body?.minStock;
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Pengaturan minimum stok tidak valid.");
      const next = {};
      for (const key of Object.keys(itemDefs)) {
        const value = input[key];
        if (value === null || value === "" || value === undefined) next[key] = null;
        else if (Number.isSafeInteger(value) && value >= 0) next[key] = value;
        else throw new Error("Batas minimum " + itemDefs[key].label + " harus bilangan bulat nol atau lebih.");
      }
      await locked(async () => { const db = getDb(); db.settings ||= {}; db.settings.minStock = next; await audit(req.user, "settings.min_stock.update", next); await persist(); });
      res.json({ ok: true, minStock: next });
    } catch (e) { res.status(400).json({ error: e.message }); }
  });
  app.get("/api/analytics/usage", auth, (req, res) => {
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
    const from = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const usage = Object.fromEntries(Object.keys(itemDefs).map(k => [k, 0]));
    const daily = {};
    for (const tx of getDb().transactions) {
      if (tx.date < from) continue;
      for (const [key, delta] of Object.entries(tx.changes || {})) if (Object.hasOwn(usage, key) && delta < 0) {
        usage[key] += -delta;
        daily[tx.date] ||= {};
        daily[tx.date][key] = (daily[tx.date][key] || 0) - delta;
      }
    }
    res.json({ days, from, through: new Date().toISOString().slice(0,10), usage, daily, itemDefs });
  });
  app.get("/api/production/calendar", auth, (req, res) => {
    const month = String(req.query.month || new Date().toISOString().slice(0,7));
    if (!/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: "Format bulan harus YYYY-MM." });
    const events = getDb().transactions.filter(t => t.type === "production" && String(t.date || "").startsWith(month))
      .map(t => ({ id: t.id, date: t.date, location: t.location, total: t.lines?.total || 0, variants: { ori:t.lines?.ori||0, beef:t.lines?.beef||0, spicy:t.lines?.spicy||0, cheese:t.lines?.cheese||0 }, createdBy:t.createdBy }));
    res.json({ month, events });
  });
  app.get("/api/export/transactions.csv", auth, (req, res) => {
    const rows = [["Tanggal","Jenis","Outlet","Pengguna","Total loyang","Catatan","Perubahan stok"]];
    for (const t of getDb().transactions) rows.push([t.date,t.type,t.location||"",t.createdBy||"",t.lines?.total||"",t.note||"",Object.entries(t.changes||{}).map(([k,v])=>k+":"+v).join("; ")]);
    const csv = rows.map(row => row.map(v => '"' + String(v ?? "").replace(/"/g,'""') + '"').join(",")).join("\r\n");
    res.setHeader("Content-Type","text/csv; charset=utf-8");
    res.setHeader("Content-Disposition",'attachment; filename="insan-transaksi.csv"');
    res.send("\uFEFF" + csv);
  });
  app.get("/api/admin/audit", auth, adminOnly, (req, res) => {
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 200));
    res.json({ entries: (getDb().auditLog || []).slice(-limit).reverse() });
  });
};
