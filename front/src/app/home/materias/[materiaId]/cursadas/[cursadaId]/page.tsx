import type { Metadata } from "next";
import { Suspense } from "react";
import { ComisionesList } from "@/components/academic/ComisionesList";

// The root metadata keeps the browser title fixed; the period is shown within the page.
export const metadata: Metadata = { title: "Comisiones | Profesor Butchery" };

export default async function ComisionesPage({ params }: { params: Promise<{ materiaId: string; cursadaId: string }> }) {
  const { materiaId, cursadaId } = await params;
  return <Suspense fallback={<p role="status">Cargando comisiones…</p>}><ComisionesList materiaId={materiaId} cursadaId={cursadaId} /></Suspense>;
}
