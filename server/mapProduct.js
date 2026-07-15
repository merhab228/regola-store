function parseImages(row) {
  const fallback = row.image ? [row.image] : [];
  if (!row.images_json) return fallback;
  try {
    const parsed = JSON.parse(row.images_json);
    const images = Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string" && item.trim()) : [];
    return images.length ? images : fallback;
  } catch {
    return fallback;
  }
}

/** @param {Record<string, unknown>} row */
export function mapProduct(row) {
  const wbUrl = row.wb_url || "";
  const ozonUrl = row.ozon_url || "";
  const ymUrl = row.ym_url || "";
  const images = parseImages(row);
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    categoryId: row.category_id,
    category_id: row.category_id,
    description: row.description,
    image: images[0] || row.image,
    images,
    imagesJson: row.images_json || "",
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
