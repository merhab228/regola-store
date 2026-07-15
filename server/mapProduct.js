/** @param {Record<string, unknown>} row */
export function mapProduct(row) {
  const wbUrl = row.wb_url || "";
  const ozonUrl = row.ozon_url || "";
  const ymUrl = row.ym_url || "";
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    pricePrevious: row.price_previous ?? null,
    wbPrice: row.wb_price ?? null,
    wb_price: row.wb_price ?? null,
    ozonPrice: row.ozon_price ?? null,
    ozon_price: row.ozon_price ?? null,
    ymPrice: row.ym_price ?? null,
    ym_price: row.ym_price ?? null,
    marketplacePrices: [
      row.wb_price ? { source: "Wildberries", price: row.wb_price, url: wbUrl } : null,
      row.ozon_price ? { source: "Ozon", price: row.ozon_price, url: ozonUrl } : null,
      row.ym_price ? { source: "Яндекс Маркет", price: row.ym_price, url: ymUrl } : null,
    ].filter(Boolean),
    categoryId: row.category_id,
    category_id: row.category_id,
    description: row.description,
    image: row.image,
    stock: row.stock,
    views: row.views,
    createdAt: row.created_at,
    ozonUrl,
    ozon_url: ozonUrl,
    ymUrl,
    ym_url: ymUrl,
    wbUrl,
    wb_url: wbUrl,
  };
}
