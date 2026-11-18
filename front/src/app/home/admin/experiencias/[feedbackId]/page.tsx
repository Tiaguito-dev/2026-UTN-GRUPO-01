import { BrandLoading } from "@/components/ui/BrandLoading";
import { Suspense } from "react";
import { AdminRecordDetail } from "@/components/admin/AdminRecordDetail";

export default async function ComentarioPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await params;
  return <Suspense fallback={<BrandLoading message="Cargando comentario…" />}><AdminRecordDetail kind="feedback" id={feedbackId} /></Suspense>;
}
