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
          className={`
            w-full px-4 py-2.5
            rounded-[10px]
            text-cream placeholder:text-cream/25
            transition-all duration-250 ease-out
            disabled:opacity-40 disabled:cursor-not-allowed
            resize-y min-h-[100px]
            ${error ? "border-red-400/60" : ""}
            ${className}
          `}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1.5px solid ${error ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.08)"}`,
            color: "rgba(253,251,247,0.9)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "rgba(200,75,49,0.5)";
            e.currentTarget.style.boxShadow = "0 0 0 3px rgba(200,75,49,0.12)";
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

Textarea.displayName = "Textarea";

export default Textarea;
