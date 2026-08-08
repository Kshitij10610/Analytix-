"use client";

import { useReducer, useEffect, useCallback, type ReactNode } from "react";
import { AuthContext } from "./auth-context";
import type { AuthState, AuthAction, User, AuthTokens } from "@/types/auth";
import { tokenStorage, restoreSession } from "@/lib/auth/storage";

const initialState: AuthState = {
  user: null,
  tokens: null,
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "RESTORE":
      return {
        ...action.payload,
        user: action.payload.user ?? null,
        tokens: action.payload.tokens ?? null,
        isAuthenticated: !!action.payload.user,
        isLoading: false,
      };
    case "LOGIN":
      return {
        ...state,
        user: action.payload.user,
        tokens: action.payload.tokens,
        isAuthenticated: true,
        isLoading: false,
      };
    case "LOGOUT":
      tokenStorage.clear();
      return {
        ...initialState,
        isLoading: false,
      };
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };
    default:
      return state;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      try {
        const session = await restoreSession();
        if (mounted && session) {
          dispatch({ type: "RESTORE", payload: session });
        } else if (mounted) {
          dispatch({ type: "RESTORE", payload: initialState });
        }
      } catch {
        if (mounted) {
          dispatch({ type: "RESTORE", payload: initialState });
        }
      }
    }

    hydrate();

    const handleLogout = () => dispatch({ type: "LOGOUT" });
    window.addEventListener("auth:logout", handleLogout);

    return () => {
      mounted = false;
      window.removeEventListener("auth:logout", handleLogout);
    };
  }, []);

  const login = useCallback((user: User, tokens: AuthTokens) => {
    tokenStorage.set(tokens.accessToken, tokens.refreshToken);
    dispatch({ type: "LOGIN", payload: { user, tokens } });
  }, []);

  const logout = useCallback(() => {
    dispatch({ type: "LOGOUT" });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  }, []);

  return (
    <AuthContext.Provider value={{ state, login, logout, setLoading }}>
      {children}
    </AuthContext.Provider>
  );
}
