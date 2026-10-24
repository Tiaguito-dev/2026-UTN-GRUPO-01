"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { listarUsuarios } from "@/services/users";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Pagination } from "@/components/ui/Pagination";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { ROLE_LABEL } from "@/lib/format/role";

function fecha(valor: string): string {
  const date = new Date(valor);
  return Number.isNaN(date.getTime()) ? "fecha no disponible" : date.toLocaleDateString("es-AR");
}

export function UsuariosList() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [initialPage, setUrlPage] = useUrlPageParam();
  const { status, result, error, page, setPage, retry } = usePaginatedFetch("usuarios", (pageToFetch) => listarUsuarios({ page: pageToFetch }), initialPage);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const handlePageChange = (next: number) => { setPage(next); setUrlPage(next); };

  return <section aria-labelledby="usuarios-heading">
    <Breadcrumb items={[{ label: "Administración", href: "/home/admin" }, { label: "Usuarios registrados" }]} />
    <h1 ref={headingRef} tabIndex={-1} id="usuarios-heading">Usuarios registrados</h1>
    <p className="system-description">Cuentas que ya se registraron en la aplicación. Este listado es de consulta: desde acá no se modifican cuentas ni roles.</p>
    {status === "loading" ? <p role="status">Cargando usuarios…</p> : null}
    {status === "error" ? <Notice tone="error">{error} <button className="button" type="button" onClick={retry}>Reintentar</button></Notice> : null}
    {status === "ready" && result ? (
      result.items.length === 0
        ? <EmptyState action={<Link href="/home/admin">Volver al panel de administración</Link>}>Todavía no hay cuentas registradas.</EmptyState>
        : <>
          <Card variant="panel">
            <p className="academic-list-detail">{result.total} {result.total === 1 ? "cuenta registrada" : "cuentas registradas"}.</p>
            <ul className="academic-list">
              {result.items.map((usuario) => <li key={usuario.id}>
                <strong>{usuario.displayName}</strong> <Badge tone="role">{ROLE_LABEL[usuario.role]}</Badge>
                <p className="academic-list-detail">{usuario.email} — alta {fecha(usuario.createdAt)}</p>
              </li>)}
            </ul>
          </Card>
          <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={handlePageChange} />
        </>
    ) : null}
  </section>;
}
