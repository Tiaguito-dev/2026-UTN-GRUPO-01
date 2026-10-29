import { Suspense } from "react";
import { AdminRecordDetail } from "@/components/admin/AdminRecordDetail";

export default async function ComentarioPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await params;
  return <Suspense fallback={<p role="status">Cargando comentario…</p>}><AdminRecordDetail kind="feedback" id={feedbackId} /></Suspense>;
}
