import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { MateriasList } from "@/components/academic/MateriasList";

export const metadata: Metadata = { title: "Materias | Professors' butchery" };

export default function MateriasPage() {
  return <Suspense fallback={<BrandLoading message="Cargando materias…" />}><MateriasList /></Suspense>;
}
