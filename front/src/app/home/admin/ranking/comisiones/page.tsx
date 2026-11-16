import type { Metadata } from "next";
import { Suspense } from "react";
import { ComisionesRanking } from "@/components/ranking/ComisionesRanking";

export const metadata: Metadata = { title: "Ranking de comisiones | Professors' butchery" };

export default function AdminRankingComisionesPage() {
  return <Suspense fallback={<p role="status">Cargando ranking…</p>}><ComisionesRanking admin /></Suspense>;
}
