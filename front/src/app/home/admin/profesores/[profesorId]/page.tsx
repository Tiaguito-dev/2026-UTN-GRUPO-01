import { Suspense } from "react";
import { AdminProfesorDetail } from "@/components/admin/AdminAcademicDetail";

export default async function ProfesorPage({ params }: { params: Promise<{ profesorId: string }> }) {
  const { profesorId } = await params;
  return <Suspense fallback={<p role="status">Cargando profesor…</p>}><AdminProfesorDetail profesorId={profesorId} /></Suspense>;
}
