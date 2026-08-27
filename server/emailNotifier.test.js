import assert from "node:assert/strict";
import net from "node:net";
import test from "node:test";
import { sendEmailNotification } from "./emailNotifier.js";

test("email notification sends an SMTP message with the same order details", async () => {
  const received = [];
  const server = net.createServer((socket) => {
    let buffer = "";
    let inData = false;
    socket.write("220 localhost SMTP ready\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\r\n");
      buffer = lines.pop();
      for (const line of lines) {
        received.push(line);
        if (inData) {
          if (line === ".") {
            inData = false;
            socket.write("250 Message accepted\r\n");
          }
          continue;
        }
        if (line.startsWith("EHLO")) socket.write("250-localhost\r\n250 AUTH LOGIN\r\n");
        else if (line === "AUTH LOGIN") socket.write("334 Username\r\n");
        else if (received.at(-2) === "AUTH LOGIN") socket.write("334 Password\r\n");
        else if (received.at(-3) === "AUTH LOGIN") socket.write("235 Authenticated\r\n");
        else if (line.startsWith("MAIL FROM:") || line.startsWith("RCPT TO:")) socket.write("250 OK\r\n");
        else if (line === "DATA") {
          inData = true;
          socket.write("354 Send message\r\n");
        } else if (line === "QUIT") socket.end("221 Bye\r\n");
      }
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const sent = await sendEmailNotification("Новый заказ #42", {
      name: "Иван",
      phone: "+79990000000",
      email: "buyer@example.ru",
      message: "Доставка в ПВЗ",
      payload: { items: [{ name: "Ручка", qty: 2, price: 1500 }], total: 3000 },
    }, {
      env: {
        EMAIL_TO: "regola-shop@mail.ru",
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(port),
        SMTP_SECURE: "false",
        SMTP_USER: "sender@example.ru",
        SMTP_PASSWORD: "app-password",
      },
      logger: { warn() {} },
    });

    assert.equal(sent, true);
    assert.ok(received.includes("RCPT TO:<regola-shop@mail.ru>"));
    const encodedBody = received.find((line) => /^[A-Za-z0-9+/]+={0,2}$/.test(line) && line.length > 30);
    assert.match(Buffer.from(encodedBody, "base64").toString("utf8"), /Иван/);
    assert.match(Buffer.from(encodedBody, "base64").toString("utf8"), /Ручка × 2 — 1500 ₽/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
