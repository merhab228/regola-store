import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, "regola.db"));

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  address TEXT,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  image TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  ozon_url TEXT,
  wb_url TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  delivery TEXT NOT NULL,
  payment TEXT NOT NULL,
  total INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  price INTEGER NOT NULL
);
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((c) => c.name === "admin_login")) {
  db.exec("ALTER TABLE users ADD COLUMN admin_login TEXT");
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_admin_login ON users(admin_login) WHERE admin_login IS NOT NULL"
  );
}

const productColumns = db.prepare("PRAGMA table_info(products)").all();
const productColNames = new Set(productColumns.map((c) => c.name));
if (!productColNames.has("wb_nm_id")) {
  db.exec("ALTER TABLE products ADD COLUMN wb_nm_id INTEGER");
}
if (!productColNames.has("wb_synced_at")) {
  db.exec("ALTER TABLE products ADD COLUMN wb_synced_at TEXT");
}
if (!productColNames.has("wb_sync_error")) {
  db.exec("ALTER TABLE products ADD COLUMN wb_sync_error TEXT");
}
if (!productColNames.has("price_previous")) {
  db.exec("ALTER TABLE products ADD COLUMN price_previous INTEGER");
}

export default db;
