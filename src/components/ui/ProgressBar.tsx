interface ProgressBarProps {
  value: number; // 0–100
  size?: "sm" | "md";
  showLabel?: boolean;
  className?: string;
}

export default function ProgressBar({
  value,
  size = "md",
  showLabel = true,
  className = "",
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const height = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`flex-1 rounded-pill overflow-hidden ${height}`}
        style={{ background: "rgba(255,255,255,0.06)" }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${Math.round(clamped)}% concluído`}
      >
        <div
          className={`${height} rounded-pill transition-all duration-500 ease-out`}
          style={{
            width: `${clamped}%`,
            background: "linear-gradient(90deg, #A33D27, #C84B31, #D4854A)",
          }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-semibold text-accent tabular-nums">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
