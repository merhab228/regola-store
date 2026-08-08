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

export function StoreProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [cartItems, setCartItems] = useState(() => load(STORAGE_KEYS.cart, []));
  const [token, setToken] = useState(() => load(STORAGE_KEYS.token, null));
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => {});
    fetchProducts({ categoryId: 1 });
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setOrders([]);
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

  const updateOrderStatus = async (orderId, status) => {
    if (!token) return;
    const nextOrder = await authedApi("/api/admin/orders/" + orderId + "/status", {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setOrders((prev) => prev.map((o) => (o.id === orderId ? nextOrder : o)));
  };

  const addToCart = (product, qty = 1) => {
    const count = Math.max(1, Number(qty) || 1);
    setCartItems((prev) => {
      const found = prev.find((item) => item.id === product.id);
      if (found) return prev.map((item) => (item.id === product.id ? { ...item, qty: item.qty + count } : item));
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
    const count = Math.max(1, Number(qty) || 1);
    setCartItems((prev) => prev.map((item) => (item.id === id ? { ...item, qty: count } : item)));
  };

  const removeFromCart = (id) => setCartItems((prev) => prev.filter((item) => item.id !== id));
  const clearCart = () => setCartItems([]);
  const cartTotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);

  const sendCheckout = async (payload) => api("/api/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  return (
    <StoreContext.Provider
      value={{
        categories,
        products,
        orders,
        cartItems,
        cartTotal,
        user,
        logout,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        sendCheckout,
        upsertProduct,
        deleteProduct,
        updateOrderStatus,
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
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = "Bearer " + token;
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.message || "Request failed");
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("StoreContext is not available");
  return ctx;
}
