import type { Metadata } from "next";
import "./globals.css";
import { FontInjector } from "./font-injector";
import { AuthProvider } from "@/providers/auth-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { ToastContainer } from "@/components/ui/toast-provider";
import { AppShellWrapper } from "./shell-wrapper";

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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <FontInjector />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <QueryProvider>
              <ToastContainer>
                <AppShellWrapper>{children}</AppShellWrapper>
              </ToastContainer>
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}