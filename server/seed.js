import crypto from "crypto";
import bcrypt from "bcryptjs";
import db from "./db.js";

function generateAdminCredentials() {
  const login = `rg_adm_${crypto.randomBytes(10).toString("hex")}`;
  const password = crypto.randomBytes(22).toString("base64url");
  return { login, password };
}

export function seedIfNeeded() {
  const usersCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
  if (usersCount > 0) return;

  let adminLogin = process.env.ADMIN_LOGIN?.trim();
  let adminPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!adminLogin || !adminPassword) {
    const gen = generateAdminCredentials();
    adminLogin = gen.login;
    adminPassword = gen.password;
    // eslint-disable-next-line no-console
    console.warn(
      "\n╔════════════════════════════════════════════════════════════════╗\n" +
        "║  Regola: первый запуск — сохраните учётные данные администратора  ║\n" +
        "╠════════════════════════════════════════════════════════════════╣\n" +
        `║  Логин:    ${adminLogin.padEnd(52)}║\n` +
        `║  Пароль:   ${adminPassword.padEnd(52)}║\n` +
        "╚════════════════════════════════════════════════════════════════╝\n"
    );
  }

  if (!/^[a-zA-Z0-9_-]{3,128}$/.test(adminLogin)) {
    throw new Error("ADMIN_LOGIN must be 3–128 chars: letters, digits, _ and -");
  }
  if (adminPassword.length < 12) {
    throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  }

  const adminHash = bcrypt.hashSync(adminPassword, 12);
  const adminEmail = `admin-${adminLogin}@regola.invalid`;

  const userHash = bcrypt.hashSync("user123", 10);

  db.prepare(
    `INSERT INTO users (name, email, phone, address, password_hash, is_admin, admin_login)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run("Admin Regola", adminEmail, "+79990000000", "Москва, ул. Примерная, 1", adminHash, 1, adminLogin);

  db.prepare(
    `INSERT INTO users (name, email, phone, address, password_hash, is_admin, admin_login)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run("Иван Покупатель", "ivan@regola.local", "+79991112233", "Санкт-Петербург, Невский пр., 10", userHash, 0, null);

  db.prepare("INSERT INTO categories (name) VALUES (?), (?)").run("Дверные ручки", "Подставки для наушников");

  const insertProduct = db.prepare(`
    INSERT INTO products
      (name, price, category_id, description, image, stock, views, created_at, ozon_url, wb_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  insertProduct.run(
    "Regola Classic Chrome",
    1850,
    1,
    "Классическая дверная ручка в хроме для межкомнатных дверей.",
    "https://images.unsplash.com/photo-1616047006789-b7af2f5f4ca4?auto=format&fit=crop&w=600&q=80",
    18,
    45,
    now,
    "https://www.ozon.ru/",
    "https://www.wildberries.ru/"
  );
  insertProduct.run(
    "Regola Matte Black",
    2190,
    1,
    "Матовая черная ручка в современном минималистичном дизайне.",
    "https://images.unsplash.com/photo-1615873968403-89e068629265?auto=format&fit=crop&w=600&q=80",
    12,
    62,
    now,
    "https://www.ozon.ru/",
    "https://www.wildberries.ru/"
  );
  insertProduct.run(
    "Regola Stand One",
    1490,
    2,
    "Металлическая подставка для наушников с мягким основанием.",
    "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80",
    60,
    20,
    36,
    now,
    "https://www.ozon.ru/",
    "https://www.wildberries.ru/"
  );
}
