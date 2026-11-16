import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfesoresRanking } from "@/components/ranking/ProfesoresRanking";

export const metadata: Metadata = { title: "Ranking de profesores | Professors' butchery" };

export default function AdminRankingPage() {
  return <Suspense fallback={<p role="status">Cargando profesores…</p>}><ProfesoresRanking admin /></Suspense>;
}
