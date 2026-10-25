import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfesoresList } from "@/components/admin/ProfesoresList";

export const metadata: Metadata = { title: "Profesores | Profesor Butchery" };

export default function ProfesoresPage() {
  return <Suspense fallback={<p role="status">Cargando profesores…</p>}><ProfesoresList /></Suspense>;
}
