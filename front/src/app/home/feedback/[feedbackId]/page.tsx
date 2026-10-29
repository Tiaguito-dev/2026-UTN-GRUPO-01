import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackDetail } from "@/components/feedback/FeedbackDetail";

export const metadata: Metadata = { title: "Comentario | Profesor Butchery" };
export default async function FeedbackPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await params;
  return <Suspense fallback={<p role="status">Cargando comentario…</p>}><FeedbackDetail feedbackId={feedbackId} /></Suspense>;
}
