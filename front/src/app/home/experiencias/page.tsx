import type { Metadata } from "next";
import { Suspense } from "react";
import { ExperienciasList } from "@/components/feedback/ExperienciasList";

export const metadata: Metadata = { title: "Experiencias | Profesor Butchery" };

export default function ExperienciasPage() {
  return <Suspense fallback={<p role="status">Cargando experiencias…</p>}><ExperienciasList /></Suspense>;
}
