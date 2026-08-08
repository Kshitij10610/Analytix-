export interface User {
  id: string;
  email: string;
  name: string | null;
  role: "ADMIN" | "ANALYST" | "USER";
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface AuthState {
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export type AuthAction =
  | { type: "RESTORE"; payload: Partial<AuthState> }
  | { type: "LOGIN"; payload: { user: User; tokens: AuthTokens } }
  | { type: "LOGOUT" }
  | { type: "SET_LOADING"; payload: boolean };
