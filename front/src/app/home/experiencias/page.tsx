import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ExperienciasList } from "@/components/feedback/ExperienciasList";

export const metadata: Metadata = { title: "Experiencias | Professors' butchery" };

export default function ExperienciasPage() {
  return <Suspense fallback={<BrandLoading message="Cargando experiencias…" />}><ExperienciasList /></Suspense>;
}
