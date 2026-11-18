import { BrandLoading } from "@/components/ui/BrandLoading";
import { Suspense } from "react";
import { AdminMateriaDetail } from "@/components/admin/AdminAcademicDetail";

export default async function MateriaPage({ params }: { params: Promise<{ materiaId: string }> }) {
  const { materiaId } = await params;
  return <Suspense fallback={<BrandLoading message="Cargando materia…" />}><AdminMateriaDetail materiaId={materiaId} /></Suspense>;
}
