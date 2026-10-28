import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export const metadata: Metadata = { title: "Compartir experiencia | Profesor Butchery" };
export default async function NuevoFeedbackPage({ searchParams }: { searchParams: Promise<{ comisionId?: string | string[] }> }) {
  const query = await searchParams;
  const comisionId = typeof query.comisionId === "string" ? query.comisionId : undefined;
  return <Suspense fallback={<p role="status">Cargando formulario…</p>}><FeedbackForm comisionId={comisionId} /></Suspense>;
}
