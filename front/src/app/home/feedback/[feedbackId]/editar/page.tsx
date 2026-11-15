import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";

export const metadata: Metadata = { title: "Editar comentario | Professors' butchery" };
export default async function EditarFeedbackPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await params;
  return <Suspense fallback={<BrandLoading message="Cargando formulario…" />}><FeedbackForm feedbackId={feedbackId} /></Suspense>;
}
