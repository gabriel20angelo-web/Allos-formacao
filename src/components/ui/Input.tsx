"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-cream/70"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`
            w-full px-4 py-2.5
            rounded-[10px]
            bg-white/5 text-cream-90 placeholder:text-cream/45
            transition-all duration-250 ease-out
            disabled:opacity-40 disabled:cursor-not-allowed
            outline-none
            border-[1.5px]
            ${error
              ? "border-red-400/40 focus:border-red-400/60 focus:ring-2 focus:ring-red-400/10"
              : "border-border-soft-2 focus:border-accent/50 focus:ring-[3px] focus:ring-accent/10"}
            ${className}
          `}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
