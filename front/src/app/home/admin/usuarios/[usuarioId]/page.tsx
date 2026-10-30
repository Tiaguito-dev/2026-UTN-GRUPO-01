import { Suspense } from "react";
import { AdminRecordDetail } from "@/components/admin/AdminRecordDetail";

export default async function UsuarioPage({ params }: { params: Promise<{ usuarioId: string }> }) {
  const { usuarioId } = await params;
  return <Suspense fallback={<p role="status">Cargando usuario…</p>}><AdminRecordDetail kind="users" id={usuarioId} /></Suspense>;
}
