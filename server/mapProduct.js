/** @param {Record<string, unknown>} row */
export function mapProduct(row) {
  const wbUrl = row.wb_url || "";
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    pricePrevious: row.price_previous ?? null,
    categoryId: row.category_id,
    category_id: row.category_id,
    description: row.description,
    image: row.image,
    stock: row.stock,
    views: row.views,
    createdAt: row.created_at,
    ozonUrl: row.ozon_url || "",
    wbUrl,
    wb_nm_id: row.wb_nm_id ?? null,
    wbNmId: row.wb_nm_id ?? null,
    wbSyncedAt: row.wb_synced_at ?? null,
    wb_synced_at: row.wb_synced_at ?? null,
    wbSyncError: row.wb_sync_error ?? null,
    wb_sync_error: row.wb_sync_error ?? null,
    wbPriceTracking: Boolean(String(wbUrl).trim()),
  };
}
