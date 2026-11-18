import { BrandLoading } from "@/components/ui/BrandLoading";
import { Suspense } from "react";
import { AdminCursadaDetail } from "@/components/admin/AdminAcademicDetail";

export default async function CursadaPage({ params }: { params: Promise<{ cursadaId: string }> }) {
  const { cursadaId } = await params;
  return <Suspense fallback={<BrandLoading message="Cargando cursada…" />}><AdminCursadaDetail cursadaId={cursadaId} /></Suspense>;
}
