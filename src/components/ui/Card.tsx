interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "sm" | "md" | "lg";
}

const paddingStyles = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export default function Card({
  children,
  className = "",
  hover = false,
  padding = "md",
}: CardProps) {
  return (
    <div
      className={`
        rounded-[16px]
        ${paddingStyles[padding]}
        ${
          hover
            ? "transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(200,75,49,0.12)] hover:border-accent/20"
            : ""
        }
        ${className}
      `}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
      }}
    >
      {children}
    </div>
  );
}
