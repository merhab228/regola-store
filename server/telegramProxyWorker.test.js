import assert from "node:assert/strict";
import test from "node:test";
import { createWorker } from "../cloudflare/telegram-api-proxy/src/index.js";

const env = { TELEGRAM_BOT_TOKEN: "allowed-token-for-test" };

test("Worker exposes an unauthenticated health endpoint", async () => {
  const worker = createWorker(() => assert.fail("health must not call upstream"));
  const response = await worker.fetch(new Request("https://proxy.example/health"), env);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ok");
});

test("Worker rejects a mismatched token without calling Telegram", async () => {
  const worker = createWorker(() => assert.fail("forbidden request must not call upstream"));
  const response = await worker.fetch(
    new Request("https://proxy.example/botwrong-token/getMe"),
    env,
  );
  assert.equal(response.status, 403);
});

test("Worker proxies Bot API method, body, content type, query, status and response", async () => {
  let captured;
  const worker = createWorker(async (url, init) => {
    captured = { url: url.toString(), init };
    return Response.json({ ok: false, description: "rate limited" }, {
      status: 429,
      headers: { "Retry-After": "2" },
    });
  });
  const response = await worker.fetch(new Request(
    "https://proxy.example/botallowed-token-for-test/sendMessage?test=1",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: 12345, text: "hello" }),
    },
  ), env);

  assert.equal(captured.url, "https://api.telegram.org/botallowed-token-for-test/sendMessage?test=1");
  assert.equal(captured.init.method, "POST");
  assert.equal(captured.init.headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(await new Response(captured.init.body).text()), { chat_id: 12345, text: "hello" });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "2");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: false, description: "rate limited" });
});

test("Worker streams Telegram files and forwards range headers", async () => {
  let captured;
  const worker = createWorker(async (url, init) => {
    captured = { url: url.toString(), init };
    return new Response("partial-file", {
      status: 206,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Range": "bytes 0-11/100",
      },
    });
  });
  const response = await worker.fetch(new Request(
    "https://proxy.example/file/botallowed-token-for-test/documents/report.pdf",
    { headers: { Range: "bytes=0-11" } },
  ), env);

  assert.equal(captured.url, "https://api.telegram.org/file/botallowed-token-for-test/documents/report.pdf");
  assert.equal(captured.init.method, "GET");
  assert.equal(captured.init.headers.get("range"), "bytes=0-11");
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 0-11/100");
  assert.equal(await response.text(), "partial-file");
});

test("Worker cannot be used as a wildcard proxy", async () => {
  const worker = createWorker(() => assert.fail("unknown routes must not call upstream"));
  const response = await worker.fetch(
    new Request("https://proxy.example/https://example.com/private"),
    env,
  );
  assert.equal(response.status, 404);
});
