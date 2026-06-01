import db from "./db.js";
import { fetchWbPrice, parseNmIdFromWbUrl, validateWbUrl } from "./wildberries.js";

const SYNC_INTERVAL_MS = Number(process.env.WB_SYNC_INTERVAL_MS || 10 * 60 * 1000);
const SYNC_MIN_GAP_MS = Number(process.env.WB_SYNC_MIN_GAP_MS || 2 * 60 * 1000);

let syncInProgress = false;

export async function syncProductById(productId, { force = false } = {}) {
  const row = db.prepare("SELECT * FROM products WHERE id = ?").get(Number(productId));
  if (!row) return { ok: false, error: "Товар не найден" };

  const wbUrl = String(row.wb_url || "").trim();
  if (!wbUrl) return { ok: false, error: "Ссылка Wildberries не задана" };

  const validated = validateWbUrl(wbUrl);
  if (!validated.ok) return { ok: false, error: validated.message };

  if (!force && row.wb_synced_at) {
    const last = Date.parse(row.wb_synced_at);
    if (Number.isFinite(last) && Date.now() - last < SYNC_MIN_GAP_MS) {
      return { ok: true, skipped: true, productId: row.id };
    }
  }

  const nmId = validated.nmId ?? parseNmIdFromWbUrl(wbUrl);
  return applyWbPrice(row, nmId);
}

async function applyWbPrice(row, nmId) {
  const result = await fetchWbPrice(nmId);
  const now = new Date().toISOString();

  if ("error" in result) {
    db.prepare(
      "UPDATE products SET wb_nm_id = ?, wb_synced_at = ?, wb_sync_error = ? WHERE id = ?"
    ).run(nmId, now, result.error, row.id);
    return { ok: false, error: result.error, productId: row.id };
  }

  const newPrice = result.price;
  const previous = row.price !== newPrice ? row.price : row.price_previous ?? null;

  db.prepare(`
    UPDATE products
    SET price = ?,
        price_previous = ?,
        wb_nm_id = ?,
        wb_synced_at = ?,
        wb_sync_error = NULL
    WHERE id = ?
  `).run(newPrice, previous, nmId, now, row.id);

  return { ok: true, productId: row.id, price: newPrice, previous };
}

export async function syncAllWbProducts({ force = false } = {}) {
  if (syncInProgress) return { skipped: true };
  syncInProgress = true;
  try {
    const rows = db
      .prepare("SELECT id FROM products WHERE wb_url IS NOT NULL AND TRIM(wb_url) != ''")
      .all();
    const results = [];
    for (const { id } of rows) {
      // eslint-disable-next-line no-await-in-loop
      const r = await syncProductById(id, { force });
      results.push(r);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    return { count: rows.length, results };
  } finally {
    syncInProgress = false;
  }
}

export function startWbPriceScheduler() {
  const tick = () => {
    syncAllWbProducts().catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[Regola] WB price sync:", err.message);
    });
  };
  setTimeout(tick, 5000);
  setInterval(tick, SYNC_INTERVAL_MS);
}

export { validateWbUrl, parseNmIdFromWbUrl };
