import type { Metadata } from "next";
import { EditarMateria } from "@/components/admin/EditarMateria";
export const metadata: Metadata = { title: "Editar materia | Profesor Butchery" };
export default async function EditarMateriaPage({ params }: { params: Promise<{ materiaId: string }> }) {
  const { materiaId } = await params;
  return <EditarMateria materiaId={materiaId} />;
}
