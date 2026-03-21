import { CourseCardSkeleton } from "@/components/ui/Skeleton";
import Skeleton from "@/components/ui/Skeleton";

export default function FormacaoLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Hero skeleton */}
      <div className="mb-12 space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-96" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-3 mb-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Course cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
