import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbPath = process.env.DB_PATH || "/data/regola.db";
const backupDir = process.env.BACKUP_DIR || "/backups";
const prefix = process.env.BACKUP_PREFIX || "regola";
const retentionDays = Number(process.env.BACKUP_RETENTION_DAYS || 31);

if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) {
  throw new Error(`Database is missing or empty: ${dbPath}`);
}

fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const filename = `${prefix}-${timestamp}.db`;
const temporaryPath = path.join(backupDir, `.${filename}.tmp`);
const destinationPath = path.join(backupDir, filename);

// SQLite's backup API reads a consistent snapshot, including uncheckpointed WAL data.
const source = new Database(dbPath, { readonly: true, fileMustExist: true });
try {
  await source.backup(temporaryPath);
} finally {
  source.close();
}

const backup = new Database(temporaryPath, { readonly: true, fileMustExist: true });
try {
  const integrity = backup.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") throw new Error(`Backup integrity check failed: ${integrity}`);

  const tables = new Set(backup.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(({ name }) => name));
  for (const table of ["products", "orders", "order_items"]) {
    if (!tables.has(table)) throw new Error(`Backup is missing required table: ${table}`);
  }

  const products = backup.prepare("SELECT COUNT(*) AS count FROM products").get().count;
  const orders = backup.prepare("SELECT COUNT(*) AS count FROM orders").get().count;
  fs.renameSync(temporaryPath, destinationPath);
  console.log(`Backup created: ${destinationPath} (products: ${products}, orders: ${orders})`);
} finally {
  backup.close();
  if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true });
}

if (Number.isFinite(retentionDays) && retentionDays > 0) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
    if (!entry.isFile() || !new RegExp(`^${prefix}-.*\\.db$`).test(entry.name)) continue;
    const filePath = path.join(backupDir, entry.name);
    if (fs.statSync(filePath).mtimeMs < cutoff) fs.rmSync(filePath, { force: true });
  }
}
