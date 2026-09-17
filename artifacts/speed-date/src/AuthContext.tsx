import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: "chooser" | "suitor";
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  bypassLogin: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_STORAGE_KEY = "intermingled_auth_token";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback((token: string) => {
    return fetch(`/api/profile/me`, {
      headers: { "X-Dev-User-Id": token }
    })
    .then(r => {
      if (!r.ok) throw new Error("Fetch failed");
      return r.json();
    })
    .then(data => {
      if (data.id) {
        setUser(data);
        return data;
      }
      else throw new Error("Invalid user data");
    });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(AUTH_STORAGE_KEY);
    if (token) {
      fetchProfile(token)
        .catch(err => {
          console.error("[AuthContext] Auth init failed:", err);
          localStorage.removeItem(AUTH_STORAGE_KEY);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const resp = await fetch(`/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Login failed");
    localStorage.setItem(AUTH_STORAGE_KEY, data.user.id);
    setUser(data.user);
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, ageVerified: boolean, termsAccepted: boolean) => {
    const resp = await fetch(`/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, ageVerified, termsAccepted }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || "Registration failed");
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  }, []);

  const bypassLogin = useCallback(() => {
    if (import.meta.env.MODE === "production") {
      console.warn("[AuthContext] bypassLogin disabled in production");
      return;
    }
    console.log("[AuthContext] bypassLogin executing...");
    const guestId = "u_8071647dc527ad40";
    localStorage.setItem(AUTH_STORAGE_KEY, guestId);

    // Attempt immediate fetch to update state before reload
    setIsLoading(true);
    fetchProfile(guestId)
        .then(() => {
            console.log("[AuthContext] Bypass success, reloading...");
            window.location.href = "/"; // Force redirect to root
        })
        .catch(err => {
            console.error("[AuthContext] Bypass fetch failed:", err);
            window.location.reload();
        });
  }, [fetchProfile]);

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut, bypassLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
