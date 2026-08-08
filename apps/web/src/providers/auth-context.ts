"use client";

import { createContext, useContext } from "react";
import type { AuthState, User, AuthTokens } from "@/types/auth";

interface AuthContextValue {
  state: AuthState;
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return context;
}
