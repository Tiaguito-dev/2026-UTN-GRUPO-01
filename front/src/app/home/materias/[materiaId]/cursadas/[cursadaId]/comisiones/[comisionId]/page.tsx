import type { Metadata } from "next";
import { Suspense } from "react";
import { ComisionDetail } from "@/components/academic/ComisionDetail";

export const metadata: Metadata = { title: "Comisión | Profesor Butchery" };

export default async function ComisionDetailPage({
  params,
}: {
  params: Promise<{ materiaId: string; cursadaId: string; comisionId: string }>;
}) {
  const { materiaId, cursadaId, comisionId } = await params;
  return (
    <Suspense fallback={<p role="status">Cargando comisión…</p>}>
      <ComisionDetail materiaId={materiaId} cursadaId={cursadaId} comisionId={comisionId} />
    </Suspense>
  );
}
