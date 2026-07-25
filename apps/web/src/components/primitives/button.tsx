import * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  fullWidth?: boolean
}

const variantStyles: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary text-text-inverse hover:bg-primary/90",
  secondary: "bg-secondary text-text-inverse hover:bg-secondary/90",
  outline: "border border-border bg-transparent text-text-primary hover:bg-surface",
  ghost: "bg-transparent text-text-primary hover:bg-surface",
  destructive: "bg-error text-text-inverse hover:bg-error/90",
}

const sizeStyles: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-spacing-3 text-label rounded-md",
  md: "h-10 px-spacing-4 text-button rounded-md",
  lg: "h-12 px-spacing-6 text-button rounded-lg",
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      className={[
        "inline-flex items-center justify-center gap-2 font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        fullWidth ? "w-full" : "",
        className || "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={isDisabled}
      {...props}
    >
      {loading && (
        <svg
          aria-hidden="true"
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {!loading && leadingIcon && <span className="h-4 w-4">{leadingIcon}</span>}
      {children}
      {!loading && trailingIcon && <span className="h-4 w-4">{trailingIcon}</span>}
    </button>
  )
}
