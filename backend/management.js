const crypto = require("crypto");

module.exports = function registerManagementRoutes(app, ctx) {
  const { auth, adminOnly, locked, persist, getDb, itemDefs } = ctx;
  const audit = async (user, action, details = {}) => {
    const db = getDb();
    db.auditLog ||= [];
    db.auditLog.push({ id: crypto.randomUUID(), at: new Date().toISOString(), username: user?.username || "system", role: user?.role || "system", action, details });
    if (db.auditLog.length > 10000) db.auditLog = db.auditLog.slice(-10000);
  };
  const makeBackup = database => {
    const serialized = JSON.stringify(database);
    return {
      format: "INSAN-STOCK-BACKUP",
      formatVersion: 1,
      app: "INSAN Stock Manager",
      createdAt: new Date().toISOString(),
      checksum: crypto.createHash("sha256").update(serialized).digest("hex"),
      database
    };
  };
  app.get("/api/admin/backup", auth, adminOnly, (req, res) => {
    try {
      const backup = makeBackup(getDb());
      res.setHeader("Content-Disposition", 'attachment; filename="insan-backup-' + new Date().toISOString().replace(/[:.]/g, "-") + '.insanbackup"');
      res.setHeader("Content-Type", "application/vnd.insan.stock-backup+json; charset=utf-8");
      res.json(backup);
    } catch (e) {
      res.status(500).json({ error: "Gagal membuat file cadangan: " + e.message });
    }
  });
  app.post("/api/admin/restore", auth, adminOnly, async (req, res) => {
    try {
      const backup = req.body;
      if (!backup || backup.format !== "INSAN-STOCK-BACKUP" || backup.formatVersion !== 1 || !backup.database || typeof backup.database !== "object" || Array.isArray(backup.database)) {
        throw new Error("Format file bukan cadangan INSAN yang didukung.");
      }
      const database = backup.database;
      if (!database.stock || typeof database.stock !== "object" || Array.isArray(database.stock) ||
          !Array.isArray(database.users) || !Array.isArray(database.transactions) || !Array.isArray(database.processed)) {
        throw new Error("Struktur database di dalam file cadangan tidak lengkap.");
      }
      for (const key of Object.keys(itemDefs)) {
        if (!Number.isSafeInteger(database.stock[key]) || database.stock[key] < 0) {
          throw new Error("Nilai stok " + itemDefs[key].label + " tidak valid. Data aktif tidak diubah.");
        }
      }
      const expected = crypto.createHash("sha256").update(JSON.stringify(database)).digest("hex");
      if (typeof backup.checksum !== "string" || backup.checksum !== expected) {
        throw new Error("Checksum tidak cocok. File rusak atau telah diubah; pemulihan dibatalkan.");
      }
      const result = await locked(async () => {
        const previous = getDb();
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const safetyPath = require("path").join(process.env.DATA_DIR || require("path").join(__dirname, "data"), "pre-restore-" + stamp + ".insanbackup");
        await require("fs").promises.writeFile(safetyPath, JSON.stringify(makeBackup(previous), null, 2), { mode: 0o600, flag: "wx" });
        try {
          database.stock = { ...database.stock };
          database.users = database.users.slice();
          database.transactions = database.transactions.slice();
          database.processed = database.processed.slice();
          ctx.setDb(database);
          await persist();
        } catch (e) {
          ctx.setDb(previous);
          throw e;
        }
        return {
          users: database.users.length,
          transactions: database.transactions.length,
          stock: database.stock
        };
      });
      res.json({ ok: true, message: "Pemulihan berhasil. Cadangan kondisi sebelum pemulihan juga disimpan di folder database.", summary: result });
    } catch (e) {
      res.status(400).json({ error: e.message || "Pemulihan gagal. Database aktif tidak diubah." });
    }
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
