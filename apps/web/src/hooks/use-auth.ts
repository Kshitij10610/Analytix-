"use client";

import { useAuthContext } from "@/providers/auth-context";

export function useAuth() {
  const context = useAuthContext();
  return {
    user: context.state.user,
    tokens: context.state.tokens,
    isAuthenticated: context.state.isAuthenticated,
    isLoading: context.state.isLoading,
    login: context.login,
    logout: context.logout,
    setLoading: context.setLoading,
  };
}
