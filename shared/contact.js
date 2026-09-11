export function contactValidationError(body = {}) {
  const name = String(body?.name || "").trim();
  const message = String(body?.message || "").trim();
  const phone = String(body?.phone || "").trim();
  const email = String(body?.email || "").trim();
  if (!name) return "Укажите имя";
  if (!message) return "Напишите сообщение";
  if (!phone && !email) return "Укажите телефон или email, чтобы мы могли ответить.";
  if (phone && (!/^[+\d\s()-]+$/.test(phone) || !/^\d{10,15}$/.test(phone.replace(/\D/g, "")))) {
    return "Проверьте телефон: укажите от 10 до 15 цифр с кодом страны или города.";
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Укажите корректный email.";
  return "";
}
