"use client";

import { useState } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Notice } from "@/components/ui/Notice";
import type { AdminRecordKind } from "@/services/admin-detail";
import { useAdminDetail } from "./useAdminDetail";
import { UserAudit } from "./UserAudit";

/** Contenedor de la presentación compartida; conserva el contrato y la página del historial. */
export function AdminSharedAudit({ kind, id }: { kind: AdminRecordKind; id: string }) {
  const isAdmin = useIsAdmin();
  return isAdmin ? <AuditContent kind={kind} id={id} /> : null;
}

function AuditContent({ kind, id }: { kind: AdminRecordKind; id: string }) {
  const [page, setPage] = useState(1);
  const { data, error, retry } = useAdminDetail(kind, id, page);
  if (error) return <Notice tone="error">Lo sentimos. No pudimos recuperar la auditoría. Intentá nuevamente. <button className="button button-secondary" type="button" onClick={retry}>Reintentar auditoría</button></Notice>;
  return data ? <UserAudit kind={kind} data={data} page={page} onPageChange={setPage} /> : <p role="status">Cargando auditoría…</p>;
}
