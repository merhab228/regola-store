import net from "net";
import tls from "tls";

const DEFAULT_RECIPIENT = "torretta-club@mail.ru";

export function formatNotification(title, data) {
  const lines = [
    title,
    `Имя: ${data.name}`,
    data.phone ? `Телефон: ${data.phone}` : "",
    data.email ? `Email: ${data.email}` : "",
    data.message ? `Сообщение: ${data.message}` : "",
  ].filter(Boolean);
  if (Array.isArray(data.payload?.items)) {
    lines.push("Товары:");
    for (const item of data.payload.items.slice(0, 20)) {
      lines.push(`- ${item.name} × ${item.qty} — ${item.price} ₽`);
    }
    lines.push(`Итого: ${data.payload.total || 0} ₽`);
  }
  return lines.join("\n");
}

/**
 * Sends site notifications through a standard SMTP server. The server supports
 * implicit TLS (recommended: smtp.mail.ru on port 465) and LOGIN authentication.
 */
export async function sendEmailNotification(title, data, { env = process.env, logger = console } = {}) {
  const to = (env.EMAIL_TO || DEFAULT_RECIPIENT).trim();
  const host = (env.SMTP_HOST || "").trim();
  const user = (env.SMTP_USER || "").trim();
  const password = env.SMTP_PASSWORD || "";
  if (!to || !host || !user || !password) return false;

  const port = Number(env.SMTP_PORT || 465);
  const secure = env.SMTP_SECURE !== "false";
  const from = (env.EMAIL_FROM || user).trim();
  const subject = encodeHeader(title);
  const text = formatNotification(title, data);
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(text.replace(/\r?\n/g, "\r\n"), "utf8").toString("base64"),
  ].join("\r\n");

  try {
    const socket = await connect({ host, port, secure });
    const smtp = createSmtpSession(socket);
    await smtp.expect(220);
    await smtp.command("EHLO regola.shop", 250);
    await smtp.command("AUTH LOGIN", 334);
    await smtp.command(Buffer.from(user, "utf8").toString("base64"), 334);
    await smtp.command(Buffer.from(password, "utf8").toString("base64"), 235);
    await smtp.command(`MAIL FROM:<${from}>`, 250);
    await smtp.command(`RCPT TO:<${to}>`, 250);
    await smtp.command("DATA", 354);
    await smtp.command(`${message}\r\n.`, 250);
    await smtp.command("QUIT", 221);
    socket.end();
    return true;
  } catch (error) {
    logger.warn("[Regola] Email notification failed:", error.message);
    return false;
  }
}

function encodeHeader(value) {
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function connect({ host, port, secure }) {
  return new Promise((resolve, reject) => {
    const onError = (error) => reject(error);
    const socket = secure
      ? tls.connect({ host, port, servername: host }, () => { socket.off("error", onError); resolve(socket); })
      : net.createConnection({ host, port }, () => { socket.off("error", onError); resolve(socket); });
    socket.setTimeout(15_000, () => socket.destroy(new Error("SMTP connection timed out")));
    socket.once("error", onError);
  });
}

function createSmtpSession(socket) {
  let pending = "";
  const responses = [];
  const waiters = [];
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split("\r\n");
    pending = lines.pop();
    for (const line of lines) {
      if (!/^\d{3} /.test(line)) continue;
      const waiter = waiters.shift();
      if (waiter) waiter.resolve(line);
      else responses.push(line);
    }
  });
  socket.on("error", (error) => {
    while (waiters.length) waiters.shift().reject(error);
  });
  const read = () => new Promise((resolve, reject) => {
    if (responses.length) resolve(responses.shift());
    else waiters.push({ resolve, reject });
  });
  const expect = async (code) => {
    const response = await read();
    if (!response.startsWith(String(code))) throw new Error(`SMTP: ${response}`);
  };
  return { expect, command: async (command, expected) => { socket.write(`${command}\r\n`); await expect(expected); } };
}
