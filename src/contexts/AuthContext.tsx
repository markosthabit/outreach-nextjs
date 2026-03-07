'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import {jwtDecode} from 'jwt-decode';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

type User = { sub: string; email: string; role: string };
type AuthContextType = {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    // on mount, try to refresh
    (async () => {
      await refresh();
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // important so httpOnly cookie is set
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(err || 'Login failed');
    }
    const data = await res.json();
    setAccessToken(data.accessToken);
    const decoded = jwtDecode<User>(data.accessToken);
    setUser(decoded);
    router.push('/dashboard');
  };

  const refresh = async (): Promise<string | null> => {
    try {
      console.log("Attempting refresh...");
      const res = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' });
      console.log("Refresh response:", res.status);
      if (!res.ok) { setAccessToken(null); setUser(null); return null; }
      const { accessToken: newToken } = await res.json();
      console.log("Refresh response:", res.status);
      setAccessToken(newToken);
      setUser(jwtDecode<User>(newToken));
      return newToken;
    } catch (err) {
          console.error("Refresh error:", err);

      setAccessToken(null);
      setUser(null);
      return null;
    }
  };

const logout = async () => {
  try {
    await fetch(`${API}/auth/logout`, {
      method: 'POST',
      credentials: 'include', // include cookie for backend
    });
  } catch (e) {
    console.error('Logout failed', e);
  } finally {
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  }
};


  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
  
}
