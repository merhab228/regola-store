import assert from "node:assert/strict";
import test from "node:test";
import { requestTelegramBotApi, telegramBotApiBaseUrl } from "./telegramApi.js";
import { createTelegramBot } from "./telegramBot.js";

test("Telegram API base URL defaults to the official endpoint", () => {
  assert.equal(telegramBotApiBaseUrl(""), "https://api.telegram.org");
});

test("Telegram API transport uses a custom compatible base URL", async () => {
  let captured;
  const result = await requestTelegramBotApi({
    token: "allowed-token-for-test",
    method: "getMe",
    baseUrl: "https://telegram-api-proxy.example.workers.dev/",
    body: {},
    fetchImpl: async (url, init) => {
      captured = { url, init };
      return Response.json({ ok: true, result: { username: "regola_test_bot" } });
    },
  });

  assert.equal(captured.url, "https://telegram-api-proxy.example.workers.dev/botallowed-token-for-test/getMe");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers["Content-Type"], "application/json");
  assert.deepEqual(result, { username: "regola_test_bot" });
});

test("Telegram API transport rejects non-HTTPS base URLs", () => {
  assert.throws(() => telegramBotApiBaseUrl("http://proxy.example"), /valid HTTPS URL/);
});

test("Telegram API errors never expose the configured token", async () => {
  const token = "allowed-token-for-test";
  await assert.rejects(
    requestTelegramBotApi({
      token,
      method: "getMe",
      baseUrl: "https://telegram-api-proxy.example.workers.dev",
      fetchImpl: async () => Response.json(
        { ok: false, description: `request for ${token} failed` },
        { status: 502 },
      ),
    }),
    (error) => !error.message.includes(token) && error.message.includes("[redacted]"),
  );
});

test("polling uses the configured Telegram API base URL", async () => {
  let bot;
  let requestedUrl;
  const firstRequest = new Promise((resolve) => {
    const fetchImpl = async (url) => {
      requestedUrl = url;
      bot.stop();
      resolve();
      return Response.json({ ok: true, result: [] });
    };
    bot = createTelegramBot({
      database: {},
      token: "allowed-token-for-test",
      adminChatIds: ["12345"],
      apiBaseUrl: "https://telegram-api-proxy.example.workers.dev",
      fetchImpl,
    });
  });

  bot.start();
  await firstRequest;
  assert.equal(requestedUrl, "https://telegram-api-proxy.example.workers.dev/botallowed-token-for-test/getUpdates");
});
