import { Suspense } from "react";
import { AdminMateriaDetail } from "@/components/admin/AdminAcademicDetail";

export default async function MateriaPage({ params }: { params: Promise<{ materiaId: string }> }) {
  const { materiaId } = await params;
  return <Suspense fallback={<p role="status">Cargando materia…</p>}><AdminMateriaDetail materiaId={materiaId} /></Suspense>;
}
