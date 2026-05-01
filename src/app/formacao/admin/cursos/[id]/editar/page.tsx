"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import Skeleton from "@/components/ui/Skeleton";

const CourseForm = dynamic(() => import("@/components/admin/CourseForm"), {
  ssr: false,
  loading: () => (
    <div className="space-y-4 p-8">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  ),
});

export default function EditarCursoPage() {
  const params = useParams();
  return <CourseForm courseId={params.id as string} />;
}
