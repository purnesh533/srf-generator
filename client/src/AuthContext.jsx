import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import api from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("srf_user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { username, password });
      localStorage.setItem("srf_token", data.token);
      localStorage.setItem("srf_user", JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }, []);

  const signup = useCallback(async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/signup", payload);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("srf_token");
    localStorage.removeItem("srf_user");
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("srf_token");
    if (!token) return;
    api.get("/auth/me").catch(() => logout());
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      login,
      signup,
      logout,
      loading,
      isAdmin: user?.role === "admin" || user?.role === "superadmin",
      isSuperAdmin: user?.role === "superadmin"
    }),
    [user, login, signup, logout, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
