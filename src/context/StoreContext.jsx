import { createContext, useContext, useEffect, useMemo, useState } from "react";

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
  const [token, setToken] = useState(() => load(STORAGE_KEYS.token, null));
  const [user, setUser] = useState(null);
  const [cart, setCart] = useState(() => load(STORAGE_KEYS.cart, {}));

  const persistCart = (next) => {
    setCart(next);
    save(STORAGE_KEYS.cart, next);
  };

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then(setCategories).catch(() => {});
    fetchProducts({ categoryId: 1 });
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      fetchProducts({ categoryId: 1 }).catch(() => {});
    }, 60000);
    return () => clearInterval(timer);
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
    if (!token || !user) return;
    const endpoint = user.isAdmin ? "/api/admin/orders" : "/api/orders/my";
    api(endpoint, {}, token).then(setOrders).catch(() => {});
  }, [token, user]);

  const fetchProducts = async (query = {}) => {
    const qs = new URLSearchParams(query).toString();
    const rows = await fetch(`/api/products${qs ? `?${qs}` : ""}`).then((r) => r.json());
    setProducts(rows);
    return rows;
  };

  const login = async (email, password) => {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setToken(res.token);
    save(STORAGE_KEYS.token, res.token);
    setUser(res.user);
    return true;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    save(STORAGE_KEYS.token, null);
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

  const register = async (payload) => {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setToken(res.token);
    save(STORAGE_KEYS.token, res.token);
    setUser(res.user);
    return { ok: true };
  };

  const addToCart = (productId) => {
    const next = { ...cart, [productId]: (cart[productId] ?? 0) + 1 };
    persistCart(next);
  };

  const updateCartItem = (productId, qty) => {
    const next = { ...cart };
    if (qty <= 0) delete next[productId];
    else next[productId] = qty;
    persistCart(next);
  };

  const clearCart = () => persistCart({});

  const cartDetailed = useMemo(() => {
    return Object.entries(cart).map(([id, qty]) => {
      const product = products.find((p) => p.id === Number(id));
      return product ? { product, qty } : null;
    }).filter(Boolean);
  }, [cart, products]);

  const cartTotal = cartDetailed.reduce((sum, row) => sum + row.product.price * row.qty, 0);

  const placeOrder = async ({ name, phone, address, delivery, payment }) => {
    if (!user) return { ok: false, message: "Нужно войти в аккаунт" };
    if (!token) return { ok: false, message: "Нет сессии" };
    const order = await api(
      "/api/orders",
      {
        method: "POST",
        body: JSON.stringify({
          name,
          phone,
          address,
          delivery,
          payment,
          items: cartDetailed.map((row) => ({
            productId: row.product.id,
            qty: row.qty,
          })),
        }),
      },
      token
    );
    setOrders((prev) => [order, ...prev]);
    clearCart();
    return { ok: true, orderId: order.id };
  };

  const upsertProduct = async (payload) => {
    if (!token) return;
    if (payload.id) {
      const nextProduct = await api(`/api/admin/products/${payload.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }, token);
      setProducts((prev) => prev.map((p) => (p.id === payload.id ? nextProduct : p)));
      return;
    }
    const created = await api("/api/admin/products", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token);
    setProducts((prev) => [created, ...prev]);
  };

  const deleteProduct = async (id) => {
    if (!token) return;
    await api(`/api/admin/products/${id}`, { method: "DELETE" }, token);
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const syncWbPrice = async (id) => {
    if (!token) return;
    const updated = await api(`/api/admin/products/${id}/sync-wb`, { method: "POST" }, token);
    setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const updateOrderStatus = async (orderId, status) => {
    if (!token) return;
    const nextOrder = await api(`/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }, token);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? nextOrder : o)));
  };

  const updateProfile = async (payload) => {
    if (!token) return;
    const nextUser = await api("/api/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }, token);
    setUser(nextUser);
  };

  return (
    <StoreContext.Provider
      value={{
        categories,
        products,
        orders,
        user,
        cart,
        cartDetailed,
        cartTotal,
        login,
        logout,
        register,
        addToCart,
        updateCartItem,
        clearCart,
        placeOrder,
        upsertProduct,
        deleteProduct,
        syncWbPrice,
        updateOrderStatus,
        updateProfile,
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
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Request failed");
  }
  if (response.status === 204) return null;
  return response.json();
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("StoreContext is not available");
  }
  return ctx;
}
