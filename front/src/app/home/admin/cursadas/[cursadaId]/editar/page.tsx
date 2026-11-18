import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { EditarCursada } from "@/components/admin/EditarAcademico";
export const metadata: Metadata = { title: "Editar cursada | Professors' butchery" };
export default async function EditPage({ params }: { params: Promise<{ cursadaId: string }> }) {
 const { cursadaId } = await params;
 return <Suspense fallback={<BrandLoading message="Cargando registro…" />}><EditarCursada cursadaId={cursadaId} /></Suspense>;
}
