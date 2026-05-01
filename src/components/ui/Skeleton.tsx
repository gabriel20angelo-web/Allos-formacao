interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-[10px] bg-surface-3 ${className}`}
      aria-hidden="true"
    />
  );
}

export function CourseCardSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden aspect-[3/4] bg-surface-2 border border-border-soft">
      <Skeleton className="w-full h-full rounded-none" />
    </div>
  );
}
