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

function parseStringList(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || "").trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/** @param {Record<string, unknown>} row */
export function mapProduct(row) {
  const wbUrl = row.wb_url || "";
  const ozonUrl = row.ozon_url || "";
  const ymUrl = row.ym_url || "";
  const videoUrl = row.video_url || "";
  const images = parseImages(row);
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    categoryId: row.category_id,
    category_id: row.category_id,
    description: row.description,
    specifications: row.specifications || "",
    packageContents: row.package_contents || "",
    package_contents: row.package_contents || "",
    colors: parseStringList(row.colors_json),
    image: images[0] || row.image,
    images,
    imagesJson: row.images_json || "",
    colorsJson: row.colors_json || "",
    stock: row.stock,
    views: row.views,
    createdAt: row.created_at,
    ozonUrl,
    ozon_url: ozonUrl,
    ymUrl,
    ym_url: ymUrl,
    videoUrl,
    video_url: videoUrl,
    wbUrl,
    wb_url: wbUrl,
  };
}
