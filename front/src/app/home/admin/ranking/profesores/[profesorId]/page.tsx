import type { Metadata } from "next";
import { Suspense } from "react";
import { PerfilProfesor } from "@/components/ranking/PerfilProfesor";

export const metadata: Metadata = { title: "Profesor | Professors' butchery" };

export default async function AdminRankingProfesorPage({ params }: { params: Promise<{ profesorId: string }> }) {
  const { profesorId } = await params;
  return <Suspense fallback={<p role="status">Cargando profesor…</p>}><PerfilProfesor profesorId={profesorId} admin /></Suspense>;
}
