"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const ToastProvider = ToastPrimitive.Provider;
const ToastViewport = ToastPrimitive.Viewport;
const ToastTitle = ToastPrimitive.Title;
const ToastDescription = ToastPrimitive.Description;

type ToastProps = React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> & {
  variant?: "default" | "success" | "error" | "warning";
};

const variantStyles: Record<NonNullable<ToastProps["variant"]>, string> = {
  default: "border-border bg-surface-card text-text-primary",
  success: "border-success/50 bg-surface-card text-text-primary",
  error: "border-error/50 bg-surface-card text-text-primary",
  warning: "border-warning/50 bg-surface-card text-text-primary",
};

function Toast({ className, variant = "default", ...props }: ToastProps) {
  return (
    <ToastPrimitive.Root
      className={cn(
        "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-4 shadow-lg transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition ease-in-out data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

type ToastCloseProps = React.ComponentPropsWithoutRef<typeof ToastPrimitive.Close>;

function ToastClose({ className, ...props }: ToastCloseProps) {
  return (
    <ToastPrimitive.Close
      className={cn(
        "absolute right-2 top-2 rounded-md opacity-0 transition-opacity group-hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
      {...props}
    >
      <X className="h-4 w-4" />
    </ToastPrimitive.Close>
  );
}

export {
  ToastProvider,
  ToastViewport,
  ToastTitle,
  ToastDescription,
  Toast,
  ToastClose,
};
