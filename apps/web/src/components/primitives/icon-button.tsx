import * as React from "react"

interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  icon: React.ReactNode
  variant?: "primary" | "secondary" | "ghost" | "destructive"
  size?: "sm" | "md" | "lg"
  loading?: boolean
  ariaLabel: string
}

const variantStyles: Record<NonNullable<IconButtonProps["variant"]>, string> = {
  primary: "bg-primary text-text-inverse hover:bg-primary/90",
  secondary: "bg-secondary text-text-inverse hover:bg-secondary/90",
  ghost: "bg-transparent text-text-primary hover:bg-surface",
  destructive: "bg-error text-text-inverse hover:bg-error/90",
}

const sizeStyles: Record<NonNullable<IconButtonProps["size"]>, string> = {
  sm: "h-8 w-8 rounded-md",
  md: "h-10 w-10 rounded-md",
  lg: "h-12 w-12 rounded-lg",
}

export function IconButton({
  icon,
  variant = "ghost",
  size = "md",
  loading = false,
  ariaLabel,
  className,
  disabled,
  ...props
}: IconButtonProps) {
  const isDisabled = disabled || loading

  return (
    <button
      className={[
        "inline-flex items-center justify-center transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className || "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={isDisabled}
      aria-label={ariaLabel}
      {...props}
    >
      {loading ? (
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
      ) : (
        icon
      )}
    </button>
  )
}
