import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const envExamplePath = path.join(rootDir, ".env.example");

function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).trim();
    } else {
      val = val.trim();
    }
    if (!key) continue;
    process.env[key] = val;
  }
}

const isProd = process.env.NODE_ENV === "production";

if (!isProd && fs.existsSync(envExamplePath)) {
  applyEnvFile(envExamplePath);
}

if (fs.existsSync(envPath)) {
  applyEnvFile(envPath);
} else if (!isProd && fs.existsSync(envExamplePath)) {
  // eslint-disable-next-line no-console
  console.warn(
    "[Regola] Файл .env не найден — используются переменные из .env.example. Для своих секретов создайте .env в корне проекта."
  );
}
