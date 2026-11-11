import type { Metadata } from "next";
import { Suspense } from "react";
import { MateriaDetail } from "@/components/academic/MateriaDetail";
export const metadata: Metadata = { title: "Materia | Professors' butchery" };
export default async function MateriaPage({ params }: { params: Promise<{ materiaId: string }> }) {
  const { materiaId } = await params;
  return <Suspense fallback={<p role="status">Cargando materia…</p>}><MateriaDetail materiaId={materiaId} /></Suspense>;
}
