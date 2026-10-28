import type { Metadata } from "next";
import { Suspense } from "react";
import { EditarComision } from "@/components/admin/EditarAcademico";
export const metadata: Metadata = { title: "Editar comisión | Profesor Butchery" };
export default async function EditPage({ params }: { params: Promise<{ comisionId: string }> }) {
 const { comisionId } = await params;
 return <Suspense fallback={<p role="status">Cargando registro…</p>}><EditarComision comisionId={comisionId} /></Suspense>;
}
