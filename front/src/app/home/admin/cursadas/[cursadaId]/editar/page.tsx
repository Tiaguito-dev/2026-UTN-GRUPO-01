import type { Metadata } from "next";
import { Suspense } from "react";
import { EditarCursada } from "@/components/admin/EditarAcademico";
export const metadata: Metadata = { title: "Editar cursada | Profesor Butchery" };
export default async function EditPage({ params }: { params: Promise<{ cursadaId: string }> }) {
 const { cursadaId } = await params;
 return <Suspense fallback={<p role="status">Cargando registro…</p>}><EditarCursada cursadaId={cursadaId} /></Suspense>;
}
