"use client";

import { useParams } from "next/navigation";
import CourseForm from "@/components/admin/CourseForm";

export default function EditarCursoPage() {
  const params = useParams();
  return <CourseForm courseId={params.id as string} />;
}
