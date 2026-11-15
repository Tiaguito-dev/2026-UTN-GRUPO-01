import { BrandLoading } from "@/components/ui/BrandLoading";
import { Suspense } from "react";
import { AdminRecordDetail } from "@/components/admin/AdminRecordDetail";

export default async function UsuarioPage({ params }: { params: Promise<{ usuarioId: string }> }) {
  const { usuarioId } = await params;
  return <Suspense fallback={<BrandLoading message="Cargando usuario…" />}><AdminRecordDetail kind="users" id={usuarioId} /></Suspense>;
}
