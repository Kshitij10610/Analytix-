"use client";

import { type ReactNode, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Loader } from "@/components/ui/loader";

interface ProtectedRouteProps {
  children: ReactNode;
  fallback?: ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
}

export function ProtectedRoute({
  children,
  fallback,
  redirectTo = "/login",
  requireAuth = true,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const pathname = usePathname(); // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for future active-route checks
  const router = useRouter(); // eslint-disable-line @typescript-eslint/no-unused-vars -- Reserved for programmatic navigation

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (requireAuth && !isAuthenticated) {
      window.location.href = redirectTo;
    } else if (!requireAuth && isAuthenticated && redirectTo) {
      window.location.href = redirectTo;
    }
  }, [isAuthenticated, requireAuth, redirectTo]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {fallback ?? <Loader size="lg" />}
      </div>
    );
  }

  if (requireAuth && !isAuthenticated) {
    return null;
  }

  if (!requireAuth && isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
