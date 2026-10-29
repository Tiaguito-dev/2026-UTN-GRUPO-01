import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export const metadata: Metadata = { title: "Editar comentario | Profesor Butchery" };
export default async function EditarFeedbackPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await params;
  return <Suspense fallback={<p role="status">Cargando formulario…</p>}><FeedbackForm feedbackId={feedbackId} /></Suspense>;
}
