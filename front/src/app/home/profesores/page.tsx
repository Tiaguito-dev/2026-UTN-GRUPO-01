import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfesoresRanking } from "@/components/ranking/ProfesoresRanking";

export const metadata: Metadata = { title: "Profesores | Professors' butchery" };

export default function ProfesoresPage() {
  return <Suspense fallback={<p role="status">Cargando profesores…</p>}><ProfesoresRanking /></Suspense>;
}
