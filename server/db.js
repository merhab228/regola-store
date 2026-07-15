import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configuredDbPath = process.env.DB_PATH;
const dbPath =
  configuredDbPath && !(process.env.NODE_ENV !== "production" && configuredDbPath.startsWith("/app/"))
    ? configuredDbPath
    : path.join(__dirname, "regola.db");
const db = new Database(dbPath);

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
  wb_url TEXT,
  ym_url TEXT,
  wb_price INTEGER,
  ozon_price INTEGER,
  ym_price INTEGER
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
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_admin_login ON users(admin_login) WHERE admin_login IS NOT NULL");
}

const productColumns = db.prepare("PRAGMA table_info(products)").all();
const productColNames = new Set(productColumns.map((c) => c.name));
for (const [column, type] of [
  ["ym_url", "TEXT"],
  ["wb_price", "INTEGER"],
  ["ozon_price", "INTEGER"],
  ["ym_price", "INTEGER"],
]) {
  if (!productColNames.has(column)) db.exec(`ALTER TABLE products ADD COLUMN ${column} ${type}`);
}

export default db;
