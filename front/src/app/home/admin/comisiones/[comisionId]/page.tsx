import { BrandLoading } from "@/components/ui/BrandLoading";
import { Suspense } from "react";
import { ComisionDetail } from "@/components/academic/ComisionDetail";

export default async function ComisionAdminPage({ params }: { params: Promise<{ comisionId: string }> }) {
  const { comisionId } = await params;
  return <Suspense fallback={<BrandLoading message="Cargando comisión…" />}><ComisionDetail comisionId={comisionId} administrative /></Suspense>;
}
