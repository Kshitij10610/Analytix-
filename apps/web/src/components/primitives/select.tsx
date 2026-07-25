import * as React from "react"

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size" | "children"> {
  variant?: "default" | "error"
  size?: "sm" | "md" | "lg"
  label?: string
  helperText?: string
  errorMessage?: string
  required?: boolean
  placeholder?: string
  options: SelectOption[]
}

const variantStyles: Record<NonNullable<SelectProps["variant"]>, string> = {
  default: "border-border focus-visible:border-primary",
  error: "border-error focus-visible:border-error",
}

const sizeStyles: Record<NonNullable<SelectProps["size"]>, string> = {
  sm: "h-8 px-spacing-3 text-body-sm",
  md: "h-10 px-spacing-4 text-body",
  lg: "h-12 px-spacing-4 text-body",
}

export function Select({
  variant = "default",
  size = "md",
  label,
  helperText,
  errorMessage,
  required = false,
  placeholder,
  options,
  className,
  id,
  value,
  defaultValue,
  onChange,
  ...props
}: SelectProps) {
  const generatedId = React.useId()
  const selectId = id || generatedId
  const helperId = `${selectId}-helper`
  const errorId = `${selectId}-error`
  const describedBy = [
    errorMessage ? errorId : null,
    helperText && !errorMessage ? helperId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined

  const hasValue = value !== undefined ? value !== "" : defaultValue !== undefined && defaultValue !== ""

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          {label}
          {required && <span className="text-error ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          aria-describedby={describedBy}
          aria-invalid={variant === "error" ? true : undefined}
          aria-required={required}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          className={[
            "w-full rounded-md border bg-surface text-text-primary appearance-none",
            "transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            placeholder && !hasValue ? "text-text-muted" : "",
            variantStyles[variant],
            sizeStyles[size],
            className || "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center pr-spacing-4 pointer-events-none text-text-muted">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
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
