import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: { spinner: "h-3 w-3", text: "text-xs", padding: "py-4" },
  md: { spinner: "h-4 w-4", text: "text-xs", padding: "py-8" },
  lg: { spinner: "h-5 w-5", text: "text-sm", padding: "py-12" },
};

export default function LoadingState({
  label = "Carregando...",
  size = "md",
  className = "",
}: LoadingStateProps) {
  const s = sizeStyles[size];
  return (
    <div
      className={`flex items-center justify-center ${s.padding} ${s.text} font-dm text-cream-30 ${className}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={`${s.spinner} animate-spin mr-2`} aria-hidden="true" />
      {label}
    </div>
  );
}
