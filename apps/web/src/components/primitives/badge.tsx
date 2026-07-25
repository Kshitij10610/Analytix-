import * as React from "react"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "primary" | "success" | "warning" | "error" | "info" | "positive" | "negative"
  size?: "sm" | "md"
  leadingIcon?: React.ReactNode
}

const variantStyles: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral: "bg-surface text-text-secondary border border-border",
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
  info: "bg-info/10 text-info",
  positive: "bg-positive-financial/10 text-positive-financial",
  negative: "bg-negative-financial/10 text-negative-financial",
}

const sizeStyles: Record<NonNullable<BadgeProps["size"]>, string> = {
  sm: "px-spacing-2 py-spacing-1 text-caption",
  md: "px-spacing-3 py-spacing-1 text-label",
}

export function Badge({
  variant = "neutral",
  size = "md",
  leadingIcon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 font-medium",
        variantStyles[variant],
        sizeStyles[size],
        className || "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {leadingIcon && <span className="h-3 w-3">{leadingIcon}</span>}
      {children}
    </span>
  )
}
