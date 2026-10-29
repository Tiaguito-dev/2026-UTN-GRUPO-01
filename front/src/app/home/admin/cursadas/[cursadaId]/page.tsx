import { Suspense } from "react";
import { AdminCursadaDetail } from "@/components/admin/AdminAcademicDetail";

export default async function CursadaPage({ params }: { params: Promise<{ cursadaId: string }> }) {
  const { cursadaId } = await params;
  return <Suspense fallback={<p role="status">Cargando cursada…</p>}><AdminCursadaDetail cursadaId={cursadaId} /></Suspense>;
}
