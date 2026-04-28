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
          className={`
            w-full px-4 py-2.5
            rounded-[10px]
            text-cream placeholder:text-cream/45
            transition-all duration-250 ease-out
            disabled:opacity-40 disabled:cursor-not-allowed
            ${error ? "border-red-400/60 focus:border-red-400 focus:ring-red-400/10" : ""}
            ${className}
          `}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1.5px solid ${error ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.08)"}`,
            color: "rgba(253,251,247,0.9)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = error ? "rgba(248,113,113,0.6)" : "rgba(200,75,49,0.5)";
            e.currentTarget.style.boxShadow = error
              ? "0 0 0 3px rgba(248,113,113,0.1)"
              : "0 0 0 3px rgba(200,75,49,0.12), 0 0 20px rgba(200,75,49,0.06)";
            e.currentTarget.style.outline = "none";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = error ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.08)";
            e.currentTarget.style.boxShadow = "none";
          }}
          {...props}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
