"use client";

import { usePathname } from "next/navigation";
import { AppShellNav } from "@/components/app-shell/app-shell-nav";

const publicPaths = ["/login", "/register", "/forgot-password", "/terms", "/privacy"];

interface AppShellWrapperProps {
  children: React.ReactNode;
}

export function AppShellWrapper({ children }: AppShellWrapperProps) {
  const pathname = usePathname();
  const isPublicPage = publicPaths.includes(pathname);

  if (isPublicPage) {
    return <div className="flex-1">{children}</div>;
  }

  return <AppShellNav>{children}</AppShellNav>;
}
