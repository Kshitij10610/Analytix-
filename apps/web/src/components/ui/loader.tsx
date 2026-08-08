"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
}

function Loader({ className, size = "md", ...props }: LoaderProps) {
  const sizeClasses: Record<string, string> = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("inline-block animate-spin rounded-full border-2 border-current border-t-transparent text-primary", sizeClasses[size], className)}
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

export { Loader };
