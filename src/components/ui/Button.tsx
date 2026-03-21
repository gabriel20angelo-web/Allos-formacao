"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "text-white shadow-glow-orange hover:shadow-glow-orange-lg hover:-translate-y-0.5 active:translate-y-0",
  secondary:
    "border-2 border-accent/40 text-accent hover:bg-accent hover:text-white hover:border-accent",
  ghost:
    "text-cream/60 hover:text-cream hover:bg-white/5",
  danger:
    "bg-red-600 text-white hover:bg-red-700",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-2.5 text-sm",
  lg: "px-8 py-3 text-base",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      className = "",
      children,
      disabled,
      style,
      ...props
    },
    ref
  ) => {
    const isPrimary = variant === "primary";

    return (
      <button
        ref={ref}
        className={`
          inline-flex items-center justify-center gap-2
          font-dm font-semibold
          rounded-[10px]
          transition-all duration-300 ease-out
          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? "w-full" : ""}
          ${className}
        `}
        style={{
          ...(isPrimary
            ? {
                background: "linear-gradient(135deg, #C84B31, #A33D27)",
              }
            : {}),
          ...style,
        }}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
