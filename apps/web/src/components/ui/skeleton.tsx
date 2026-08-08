"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular";
  width?: string | number;
  height?: string | number;
}

function Skeleton({ className, variant = "rectangular", width, height, ...props }: SkeletonProps) {
  const variantClasses: Record<string, string> = {
    text: "rounded-sm",
    circular: "rounded-full",
    rectangular: "rounded-md",
  };

  const style: React.CSSProperties = {
    ...(width ? { width: typeof width === "number" ? `${width}px` : width } : {}),
    ...(height ? { height: typeof height === "number" ? `${height}px` : height } : {}),
  };

  return (
    <div
      className={cn("animate-pulse bg-surface-hover", variantClasses[variant], className)}
      style={style}
      {...props}
    />
  );
}

export { Skeleton };
