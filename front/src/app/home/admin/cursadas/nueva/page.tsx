import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AltaCursada } from "@/components/admin/AltaCursada";

export const metadata: Metadata = { title: "Nueva cursada | Professors' butchery" };

export default function AltaCursadaPage() {
  return <Suspense fallback={<BrandLoading message="Cargando materias…" />}><AltaCursada /></Suspense>;
}
