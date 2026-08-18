import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEYS = {
  token: "regola_token",
  cart: "regola_cart",
};

const StoreContext = createContext(null);

const load = (key, fallback) => {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const MAX_CART_QTY = 99;

export function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [messages, setMessages] = useState([]);
  const [commerce, setCommerce] = useState({ tbankEnabled: false, tbankLive: false, cdekApiEnabled: false, cdekOrderCreationEnabled: false, addressSuggestionsEnabled: false });
  const [cartItems, setCartItems] = useState(() => load(STORAGE_KEYS.cart, []));
  const [token, setToken] = useState(() => load(STORAGE_KEYS.token, null));
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => {});
    fetch("/api/commerce/config").then((r) => r.json()).then(setCommerce).catch(() => {});
    fetchProducts({ categoryId: 1 });
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setOrders([]);
      setMessages([]);
      return;
    }
    api("/api/me", {}, token)
      .then(setUser)
      .catch(() => {
        setUser(null);
        setToken(null);
        save(STORAGE_KEYS.token, null);
      });
  }, [token]);

  useEffect(() => {
    if (!token || !user?.isAdmin) return;
    api("/api/admin/orders", {}, token).then(setOrders).catch(() => {});
    api("/api/admin/messages", {}, token).then(setMessages).catch(() => {});
  }, [token, user]);

  useEffect(() => {
    save(STORAGE_KEYS.cart, cartItems);
  }, [cartItems]);

  const fetchProducts = async (query = {}) => {
    const qs = new URLSearchParams(query).toString();
    const rows = await fetch("/api/products" + (qs ? "?" + qs : "")).then((r) => r.json());
    setProducts(rows);
    return rows;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    setOrders([]);
    setMessages([]);
    save(STORAGE_KEYS.token, null);
  };

  const authedApi = async (url, options = {}) => {
    if (!token) throw new Error("Нет сессии");
    try {
      return await api(url, options, token);
    } catch (error) {
      if (error.status === 401 || /invalid token|unauthorized/i.test(error.message)) {
        logout();
        throw new Error("Сессия устарела. Войдите в админку заново.");
      }
      throw error;
    }
  };

  const grantAdminAccess = async ({ login, password, accessKey }) => {
    const res = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ login, password, accessKey }),
    });
    setToken(res.token);
    save(STORAGE_KEYS.token, res.token);
    setUser(res.user);
    return { ok: true };
  };

  const upsertProduct = async (payload) => {
    if (!token) return;
    if (payload.id) {
      const nextProduct = await authedApi("/api/admin/products/" + payload.id, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setProducts((prev) => prev.map((p) => (p.id === payload.id ? nextProduct : p)));
      return;
    }
    const created = await authedApi("/api/admin/products", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setProducts((prev) => [created, ...prev]);
  };

  const deleteProduct = async (id) => {
    if (!token) return;
    await authedApi("/api/admin/products/" + id, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const uploadMedia = async (file) => {
    if (!token) throw new Error("Нет сессии администратора");
    const response = await fetch("/api/admin/uploads", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) logout();
      throw new Error(result.message || "Не удалось загрузить файл");
    }
    return result.url;
  };

  const updateOrderStatus = async (orderId, status) => {
    if (!token) return;
    const nextOrder = await authedApi("/api/admin/orders/" + orderId + "/status", {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setOrders((prev) => prev.map((o) => (o.id === orderId ? nextOrder : o)));
  };

  const createCdekShipment = async (orderId) => {
    if (!token) return;
    const nextOrder = await authedApi("/api/admin/orders/" + orderId + "/cdek", { method: "POST" });
    setOrders((prev) => prev.map((order) => (order.id === orderId ? nextOrder : order)));
    return nextOrder;
  };

  const refreshCdekShipment = async (orderId) => {
    if (!token) return;
    const nextOrder = await authedApi("/api/admin/orders/" + orderId + "/cdek/refresh", { method: "POST" });
    setOrders((prev) => prev.map((order) => (order.id === orderId ? nextOrder : order)));
    return nextOrder;
  };

  const updateMessage = async (messageId, payload) => {
    if (!token) return;
    const nextMessage = await authedApi("/api/admin/messages/" + messageId, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setMessages((prev) => prev.map((m) => (m.id === messageId ? nextMessage : m)));
  };

  const addToCart = (product, qty = 1) => {
    const count = Math.min(MAX_CART_QTY, Math.max(1, Number(qty) || 1));
    setCartItems((prev) => {
      const found = prev.find((item) => item.id === product.id);
      if (found) return prev.map((item) => (item.id === product.id ? { ...item, qty: Math.min(MAX_CART_QTY, item.qty + count) } : item));
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: Number(product.price) || 0,
          image: product.image,
          images: Array.isArray(product.images) ? product.images : [],
          qty: count,
        },
      ];
    });
  };

  const updateCartQty = (id, qty) => {
    const count = Math.min(MAX_CART_QTY, Math.max(1, Number(qty) || 1));
    setCartItems((prev) => prev.map((item) => (item.id === id ? { ...item, qty: count } : item)));
  };

  const removeFromCart = (id) => setCartItems((prev) => prev.filter((item) => item.id !== id));
  const clearCart = () => {
    setCartItems([]);
    save(STORAGE_KEYS.cart, []);
  };
  const cartTotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);

  const sendCheckout = async (payload) => api("/api/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 45_000,
  });

  const estimateCdekDelivery = async (payload) => api("/api/cdek/estimate", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const suggestAddress = async (payload) => api("/api/address/suggest", {
    method: "POST",
    body: JSON.stringify(payload),
    timeoutMs: 10_000,
  });

  return (
    <StoreContext.Provider
      value={{
        categories,
        products,
        orders,
        messages,
        commerce,
        cartItems,
        cartTotal,
        user,
        logout,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        sendCheckout,
        estimateCdekDelivery,
        suggestAddress,
        upsertProduct,
        uploadMedia,
        deleteProduct,
        updateOrderStatus,
        createCdekShipment,
        refreshCdekShipment,
        updateMessage,
        grantAdminAccess,
        isAdminSessionValid: !!user?.isAdmin,
        fetchProducts,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

async function api(url, options = {}, token) {
  const { timeoutMs = 30_000, ...fetchOptions } = options;
  const headers = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers || {}),
  };
  if (token) headers.Authorization = "Bearer " + token;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...fetchOptions, headers, signal: controller.signal });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.message || `Сервер ответил кодом ${response.status}`);
      error.status = response.status;
      throw error;
    }
    if (response.status === 204) return null;
    return response.json();
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Сервер не ответил вовремя. Попробуйте ещё раз.");
    if (error instanceof TypeError) throw new Error("Не удалось связаться с сервером. Проверьте интернет и повторите.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreContext is not available");
  return ctx;
}
