const TELEGRAM_ORIGIN = "https://api.telegram.org";
const encoder = new TextEncoder();

export function createWorker(fetchImpl = globalThis.fetch) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        if (request.method !== "GET") return textResponse("Method Not Allowed", 405);
        return textResponse("ok", 200);
      }

      const route = parseTelegramRoute(url.pathname);
      if (!route) return textResponse("Not Found", 404);
      if (!env?.TELEGRAM_BOT_TOKEN) return textResponse("Service Unavailable", 503);
      if (!(await secretsEqual(route.token, env.TELEGRAM_BOT_TOKEN))) {
        return textResponse("Forbidden", 403);
      }

      const allowedMethods = route.kind === "api" ? ["GET", "POST"] : ["GET", "HEAD"];
      if (!allowedMethods.includes(request.method)) return textResponse("Method Not Allowed", 405);

      const upstream = new URL(
        route.kind === "api"
          ? `/bot${env.TELEGRAM_BOT_TOKEN}/${route.suffix}`
          : `/file/bot${env.TELEGRAM_BOT_TOKEN}/${route.suffix}`,
        TELEGRAM_ORIGIN,
      );
      upstream.search = url.search;

      const headers = forwardRequestHeaders(request.headers);
      const init = {
        method: request.method,
        headers,
        redirect: "follow",
      };
      if (request.method !== "GET" && request.method !== "HEAD") init.body = request.body;

      try {
        const response = await fetchImpl(upstream, init);
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set("Cache-Control", "no-store");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      } catch {
        return textResponse("Bad Gateway", 502);
      }
    },
  };
}

function parseTelegramRoute(pathname) {
  const apiMatch = /^\/bot([^/]+)\/([A-Za-z][A-Za-z0-9_]*)$/.exec(pathname);
  if (apiMatch) {
    const token = safelyDecode(apiMatch[1]);
    return token ? { kind: "api", token, suffix: apiMatch[2] } : null;
  }

  const fileMatch = /^\/file\/bot([^/]+)\/(.+)$/.exec(pathname);
  if (fileMatch) {
    const token = safelyDecode(fileMatch[1]);
    if (!token || hasUnsafePathSegment(fileMatch[2])) return null;
    return { kind: "file", token, suffix: fileMatch[2] };
  }

  return null;
}

function safelyDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return "";
  }
}

function hasUnsafePathSegment(path) {
  return path.split("/").some((segment) => segment === "." || segment === ".." || segment === "");
}

async function secretsEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(String(left))),
    crypto.subtle.digest("SHA-256", encoder.encode(String(right))),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

function forwardRequestHeaders(source) {
  const headers = new Headers();
  for (const name of ["accept", "content-type", "range", "if-range", "if-none-match", "if-modified-since"]) {
    const value = source.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

function textResponse(body, status) {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default createWorker();
