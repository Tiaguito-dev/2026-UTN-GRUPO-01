import { BrandLoading } from "@/components/ui/BrandLoading";
import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackDetail } from "@/components/feedback/FeedbackDetail";

export const metadata: Metadata = { title: "Comentario | Professors' butchery" };
export default async function FeedbackPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await params;
  return <Suspense fallback={<BrandLoading message="Cargando comentario…" />}><FeedbackDetail feedbackId={feedbackId} /></Suspense>;
}
