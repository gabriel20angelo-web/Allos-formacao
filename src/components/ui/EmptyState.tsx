import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`text-center py-10 px-6 rounded-lg bg-black/20 ${className}`}>
      {Icon && (
        <Icon className="h-8 w-8 mx-auto mb-3 text-cream/20" aria-hidden="true" />
      )}
      <p className="text-sm font-dm font-medium mb-1 text-cream-50">{title}</p>
      {description && (
        <p className="text-xs font-dm text-cream-30">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
