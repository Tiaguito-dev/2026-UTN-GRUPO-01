import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ComisionDetail } from "@/components/academic/ComisionDetail";

export const metadata: Metadata = { title: "Comisión | Professors' butchery" };

export default async function ComisionDetailPage({
  params,
}: {
  params: Promise<{ materiaId: string; cursadaId: string; comisionId: string }>;
}) {
  const { materiaId, cursadaId, comisionId } = await params;
  return (
    <Suspense fallback={<BrandLoading message="Cargando comisión…" />}>
      <ComisionDetail materiaId={materiaId} cursadaId={cursadaId} comisionId={comisionId} />
    </Suspense>
  );
}
