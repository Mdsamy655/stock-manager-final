import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { queryClient } from "@/lib/queryClient";

interface AuthUser {
  id: number;
  name: string;
  email: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const verifyToken = useCallback(async (savedToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setToken(savedToken);
      } else {
        localStorage.removeItem("auth_token");
        setUser(null);
        setToken(null);
      }
    } catch {
      localStorage.removeItem("auth_token");
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("auth_token");
    if (savedToken) {
      verifyToken(savedToken);
    } else {
      setIsLoading(false);
    }
  }, [verifyToken]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Login failed");
    }

    const data = await res.json();
    localStorage.setItem("auth_token", data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.message || "Registration failed");
    }

    const data = await res.json();
    localStorage.setItem("auth_token", data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
    setToken(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
