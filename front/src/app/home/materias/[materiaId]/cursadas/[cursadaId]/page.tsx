import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ComisionesList } from "@/components/academic/ComisionesList";

// The root metadata keeps the browser title fixed; the period is shown within the page.
export const metadata: Metadata = { title: "Comisiones | Professors' butchery" };

export default async function ComisionesPage({ params }: { params: Promise<{ materiaId: string; cursadaId: string }> }) {
  const { materiaId, cursadaId } = await params;
  return <Suspense fallback={<BrandLoading message="Cargando comisiones…" />}><ComisionesList materiaId={materiaId} cursadaId={cursadaId} /></Suspense>;
}
