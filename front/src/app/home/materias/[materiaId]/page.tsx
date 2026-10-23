import type { Metadata } from "next";
import { MateriaDetail } from "@/components/academic/MateriaDetail";
export const metadata: Metadata = { title: "Materia | Profesor Butchery" };
export default async function MateriaPage({ params }: { params: Promise<{ materiaId: string }> }) {
  const { materiaId } = await params;
  return <MateriaDetail materiaId={materiaId} />;
}
