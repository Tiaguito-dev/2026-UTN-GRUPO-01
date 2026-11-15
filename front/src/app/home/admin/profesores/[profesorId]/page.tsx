import { BrandLoading } from "@/components/ui/BrandLoading";
import { Suspense } from "react";
import { AdminProfesorDetail } from "@/components/admin/AdminAcademicDetail";

export default async function ProfesorPage({ params }: { params: Promise<{ profesorId: string }> }) {
  const { profesorId } = await params;
  return <Suspense fallback={<BrandLoading message="Cargando profesor…" />}><AdminProfesorDetail profesorId={profesorId} /></Suspense>;
}
