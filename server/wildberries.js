const WB_CARD_API = "https://u-card.wb.ru/cards/v4/detail";
const WB_GEO_API = "https://user-geo-data.wildberries.ru/get-geo-info";
const WB_DEST_FALLBACK = process.env.WB_DEST || "-1257786";
const WB_SPP = process.env.WB_SPP || "30";

let cachedDest = process.env.WB_DEST || null;

async function resolveWbDest() {
  if (cachedDest) return cachedDest;
  try {
    const geoUrl = new URL(WB_GEO_API);
    geoUrl.searchParams.set("currency", "RUB");
    geoUrl.searchParams.set("latitude", "55.75");
    geoUrl.searchParams.set("longitude", "37.62");
    const response = await fetch(geoUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) {
      const data = await response.json();
      const fromXinfo = String(data.xinfo || "").match(/dest=(-?\d+)/);
      if (fromXinfo) {
        cachedDest = fromXinfo[1];
        return cachedDest;
      }
      const destinations = Array.isArray(data.destinations) ? data.destinations : [];
      if (destinations.length > 0) {
        cachedDest = String(destinations[destinations.length - 1]);
        return cachedDest;
      }
    }
  } catch {
    /* use fallback */
  }
  cachedDest = WB_DEST_FALLBACK;
  return cachedDest;
}

const WB_URL_RE = /wildberries\.ru/i;

/** @param {string} url */
export function parseNmIdFromWbUrl(url) {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  const catalog = trimmed.match(/\/catalog\/(\d{5,})/i);
  if (catalog) return Number(catalog[1]);
  const nmParam = trimmed.match(/[?&]nm=(\d{5,})/i);
  if (nmParam) return Number(nmParam[1]);
  return null;
}

/** @param {string} url */
export function validateWbUrl(url) {
  if (!url || !String(url).trim()) {
    return { ok: true, url: "", nmId: null };
  }
  const trimmed = String(url).trim();
  if (!WB_URL_RE.test(trimmed)) {
    return { ok: false, message: "Ссылка должна вести на wildberries.ru" };
  }
  const nmId = parseNmIdFromWbUrl(trimmed);
  if (!nmId) {
    return { ok: false, message: "Не удалось извлечь артикул из ссылки (формат: .../catalog/12345678/...)" };
  }
  return { ok: true, url: trimmed, nmId };
}

/** @param {unknown} product */
function extractPriceRub(product) {
  if (!product || typeof product !== "object") return null;

  if (typeof product.salePriceU === "number" && product.salePriceU > 0) {
    return Math.round(product.salePriceU / 100);
  }
  if (typeof product.priceU === "number" && product.priceU > 0) {
    return Math.round(product.priceU / 100);
  }

  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  let best = null;
  for (const size of sizes) {
    const price = size?.price;
    if (!price || typeof price !== "object") continue;
    const candidates = [price.product, price.total, price.basic].filter(
      (v) => typeof v === "number" && v > 0
    );
    for (const kopecks of candidates) {
      const rub = Math.round(kopecks / 100);
      if (best === null || rub < best) best = rub;
    }
  }
  return best;
}

/**
 * @param {number} nmId
 * @returns {Promise<{ price: number, nmId: number } | { error: string }>}
 */
export async function fetchWbPrice(nmId) {
  if (!Number.isFinite(nmId) || nmId < 10000) {
    return { error: "Некорректный артикул Wildberries" };
  }

  const dest = await resolveWbDest();
  const url = new URL(WB_CARD_API);
  url.searchParams.set("appType", "1");
  url.searchParams.set("curr", "rub");
  url.searchParams.set("dest", dest);
  url.searchParams.set("spp", WB_SPP);
  url.searchParams.set("nm", String(nmId));

  let response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
        Origin: "https://www.wildberries.ru",
        Referer: "https://www.wildberries.ru/",
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    return { error: err.message || "Ошибка сети при запросе к Wildberries" };
  }

  if (!response.ok) {
    return { error: `Wildberries ответил с кодом ${response.status}` };
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return { error: "Некорректный ответ Wildberries" };
  }

  const products = data?.products ?? data?.data?.products ?? [];
  const product = products.find((p) => Number(p.id) === nmId) || products[0];
  if (!product) {
    return { error: "Товар не найден на Wildberries (проверьте ссылку и наличие)" };
  }

  const price = extractPriceRub(product);
  if (price === null || price <= 0) {
    return {
      error:
        "Цена на Wildberries недоступна (нет в наличии или API не вернул цену). Попробуйте позже.",
    };
  }

  return { price, nmId };
}
