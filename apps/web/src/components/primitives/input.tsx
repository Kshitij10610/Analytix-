import * as React from "react"

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  variant?: "default" | "error"
  size?: "sm" | "md" | "lg"
  label?: string
  helperText?: string
  errorMessage?: string
  required?: boolean
  leadingElement?: React.ReactNode
  trailingElement?: React.ReactNode
}

const variantStyles: Record<NonNullable<InputProps["variant"]>, string> = {
  default: "border-border focus-visible:border-primary",
  error: "border-error focus-visible:border-error",
}

const sizeStyles: Record<NonNullable<InputProps["size"]>, string> = {
  sm: "h-8 px-spacing-3 text-body-sm",
  md: "h-10 px-spacing-4 text-body",
  lg: "h-12 px-spacing-4 text-body",
}

export function Input({
  variant = "default",
  size = "md",
  label,
  helperText,
  errorMessage,
  required = false,
  leadingElement,
  trailingElement,
  className,
  id,
  ...props
}: InputProps) {
  const generatedId = React.useId()
  const inputId = id || generatedId
  const helperId = `${inputId}-helper`
  const errorId = `${inputId}-error`
  const describedBy = [
    errorMessage ? errorId : null,
    helperText && !errorMessage ? helperId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          {label}
          {required && <span className="text-error ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        {leadingElement && (
          <div className="absolute inset-y-0 left-0 flex items-center pl-spacing-4 text-text-muted pointer-events-none">
            <span className="h-4 w-4">{leadingElement}</span>
          </div>
        )}
        <input
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={variant === "error" ? true : undefined}
          aria-required={required}
          className={[
            "w-full rounded-md border bg-surface text-text-primary placeholder:text-text-muted",
            "transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            leadingElement ? "pl-spacing-12" : "",
            trailingElement ? "pr-spacing-12" : "",
            variantStyles[variant],
            sizeStyles[size],
            className || "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
        {trailingElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-spacing-4 text-text-muted pointer-events-none">
            <span className="h-4 w-4">{trailingElement}</span>
          </div>
        )}
      </div>
      {errorMessage && (
        <p id={errorId} className="mt-1.5 text-sm text-error flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {errorMessage}
        </p>
      )}
      {helperText && !errorMessage && (
        <p id={helperId} className="mt-1.5 text-sm text-text-muted">
          {helperText}
        </p>
      )}
    </div>
  )
}
