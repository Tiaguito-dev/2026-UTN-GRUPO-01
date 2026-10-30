import type { Metadata } from "next";
import { Suspense } from "react";
import { MateriasList } from "@/components/academic/MateriasList";

export const metadata: Metadata = { title: "Materias | Profesor Butchery" };

export default function MateriasPage() {
  return <Suspense fallback={<p role="status">Cargando materias…</p>}><MateriasList /></Suspense>;
}
