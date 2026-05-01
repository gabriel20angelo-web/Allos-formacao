"use client";

import { forwardRef, type TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-cream/70"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${textareaId}-error` : undefined}
          className={`
            w-full px-4 py-2.5
            rounded-[10px]
            bg-white/5 text-cream-90 placeholder:text-cream/45
            transition-all duration-250 ease-out
            disabled:opacity-40 disabled:cursor-not-allowed
            resize-y min-h-[100px]
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
          <p id={`${textareaId}-error`} className="text-xs text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export default Textarea;
