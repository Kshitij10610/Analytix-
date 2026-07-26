import type { Metadata } from "next";
import "./globals.css";
import { FontInjector } from "./font-injector";
import { AppShellNav } from "@/components/app-shell/app-shell-nav";

export const metadata: Metadata = {
  title: "Analytix",
  description: "Financial intelligence platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <FontInjector />
        <AppShellNav>{children}</AppShellNav>
      </body>
    </html>
  );
}

