import type { Metadata } from "next";
import { Suspense } from "react";
import { EditarProfesor } from "@/components/admin/EditarAcademico";
export const metadata: Metadata = { title: "Editar profesor | Profesor Butchery" };
export default async function EditPage({ params }: { params: Promise<{ profesorId: string }> }) {
 const { profesorId } = await params;
 return <Suspense fallback={<p role="status">Cargando registro…</p>}><EditarProfesor profesorId={profesorId} /></Suspense>;
}
