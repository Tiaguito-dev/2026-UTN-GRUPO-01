import { Suspense } from "react";
import { ComisionDetail } from "@/components/academic/ComisionDetail";

export default async function ComisionAdminPage({ params }: { params: Promise<{ comisionId: string }> }) {
  const { comisionId } = await params;
  return <Suspense fallback={<p role="status">Cargando comisión…</p>}><ComisionDetail comisionId={comisionId} administrative /></Suspense>;
}
