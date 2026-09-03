export const DEFAULT_TELEGRAM_BOT_API_BASE_URL = "https://api.telegram.org";

export function telegramBotApiBaseUrl(value = process.env.TELEGRAM_BOT_API_BASE_URL) {
  const configured = String(value || DEFAULT_TELEGRAM_BOT_API_BASE_URL).trim().replace(/\/+$/, "");
  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("TELEGRAM_BOT_API_BASE_URL must be a valid HTTPS URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("TELEGRAM_BOT_API_BASE_URL must be a valid HTTPS URL");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export async function requestTelegramBotApi({
  token,
  method,
  body = {},
  baseUrl = process.env.TELEGRAM_BOT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  if (!token) throw new Error("Telegram bot token is not configured");
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(String(method))) throw new Error("Invalid Telegram Bot API method");
  if (typeof fetchImpl !== "function") throw new Error("Fetch is not available");

  const response = await fetchImpl(`${telegramBotApiBaseUrl(baseUrl)}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    const fallback = `Telegram ${method} failed with HTTP ${response.status}`;
    throw new Error(redactToken(result.description || fallback, token));
  }
  return result.result;
}

function redactToken(value, token) {
  return String(value).split(String(token)).join("[redacted]");
}
