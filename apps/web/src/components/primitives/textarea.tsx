import * as React from "react"

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: "default" | "error"
  size?: "sm" | "md" | "lg"
  label?: string
  helperText?: string
  errorMessage?: string
  required?: boolean
  characterCount?: number
  maxCharacterCount?: number
}

const variantStyles: Record<NonNullable<TextareaProps["variant"]>, string> = {
  default: "border-border focus-visible:border-primary",
  error: "border-error focus-visible:border-error",
}

const sizeStyles: Record<NonNullable<TextareaProps["size"]>, string> = {
  sm: "text-body-sm",
  md: "text-body",
  lg: "text-body",
}

export function Textarea({
  variant = "default",
  size = "md",
  label,
  helperText,
  errorMessage,
  required = false,
  characterCount,
  maxCharacterCount,
  className,
  id,
  rows = 4,
  ...props
}: TextareaProps) {
  const generatedId = React.useId()
  const textareaId = id || generatedId
  const helperId = `${textareaId}-helper`
  const errorId = `${textareaId}-error`
  const countId = `${textareaId}-count`
  const describedBy = [
    errorMessage ? errorId : null,
    helperText && !errorMessage ? helperId : null,
    maxCharacterCount ? countId : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined

  const currentCount = characterCount ?? props.value?.toString().length ?? 0
  const isOverLimit = maxCharacterCount !== undefined && currentCount > maxCharacterCount

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={textareaId}
          className="block text-sm font-medium text-text-primary mb-1.5"
        >
          {label}
          {required && <span className="text-error ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <textarea
          id={textareaId}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={variant === "error" ? true : undefined}
          aria-required={required}
          className={[
            "w-full rounded-md border bg-surface text-text-primary placeholder:text-text-muted",
            "transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            variantStyles[variant],
            sizeStyles[size],
            className || "",
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        {errorMessage ? (
          <p id={errorId} className="text-sm text-error flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {errorMessage}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-sm text-text-muted">
            {helperText}
          </p>
        ) : (
          <span />
        )}
        {maxCharacterCount !== undefined && (
          <p
            id={countId}
            className={`text-xs tabular-nums ${
              isOverLimit ? "text-error" : "text-text-muted"
            }`}
          >
            {currentCount} / {maxCharacterCount}
          </p>
        )}
      </div>
    </div>
  )
}
