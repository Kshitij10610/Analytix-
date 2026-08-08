import { apiClient } from "@/lib/api/client";
import type { User, AuthTokens } from "@/types/auth";

export const authApi = {
  login: async (email: string, password: string): Promise<{ user: User; tokens: AuthTokens }> => {
    const { data } = await apiClient.post<{ accessToken: string; expiresIn: number; user: User }>("/auth/login", { email, password });
    return {
      user: data.user,
      tokens: {
        accessToken: data.accessToken,
        refreshToken: "",
        expiresIn: data.expiresIn,
      },
    };
  },

  register: async (email: string, password: string, name?: string): Promise<User> => {
    const { data } = await apiClient.post<User>("/auth/register", { email, password, name });
    return data;
  },

  refresh: async (refreshToken: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> => {
    const { data } = await apiClient.post<{ accessToken: string; refreshToken: string; expiresIn: number }>("/auth/refresh", { refreshToken });
    return data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post<void>("/auth/logout");
  },

  me: async (): Promise<User> => {
    const { data } = await apiClient.get<User>("/auth/me");
    return data;
  },
};
