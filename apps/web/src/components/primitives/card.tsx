import * as React from "react"

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "elevated" | "outlined" | "interactive"
  padding?: "none" | "sm" | "md" | "lg"
}

const variantStyles: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "bg-surface-card border border-border",
  elevated: "bg-surface-card shadow-sm",
  outlined: "bg-transparent border border-border-strong",
  interactive: [
    "bg-surface-card border border-border",
    "cursor-pointer",
    "transition-colors",
    "hover:bg-surface-hover",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
  ].join(" "),
}

const paddingStyles: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "p-0",
  sm: "p-spacing-4",
  md: "p-spacing-6",
  lg: "p-spacing-8",
}

export function Card({
  variant = "default",
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "w-full rounded-lg",
        variantStyles[variant],
        paddingStyles[padding],
        className || "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  )
}

type CardHeaderProps = React.HTMLAttributes<HTMLDivElement>

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={["flex flex-col space-y-spacing-2", className || ""]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  )
}

type CardTitleProps = React.HTMLAttributes<HTMLHeadingElement> & {
  as?: "h2" | "h3" | "h4"
}

export function CardTitle({
  as: Component = "h3",
  className,
  children,
  ...props
}: CardTitleProps) {
  return (
    <Component
      className={["text-h3 font-semibold text-text-heading", className || ""]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </Component>
  )
}

type CardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>

export function CardDescription({ className, children, ...props }: CardDescriptionProps) {
  return (
    <p
      className={["text-body-sm text-text-secondary", className || ""]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </p>
  )
}

type CardContentProps = React.HTMLAttributes<HTMLDivElement>

export function CardContent({ className, children, ...props }: CardContentProps) {
  return (
    <div
      className={className || ""}
      {...props}
    >
      {children}
    </div>
  )
}

type CardFooterProps = React.HTMLAttributes<HTMLDivElement>

export function CardFooter({ className, children, ...props }: CardFooterProps) {
  return (
    <div
      className={["flex items-center pt-0", className || ""]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  )
}
