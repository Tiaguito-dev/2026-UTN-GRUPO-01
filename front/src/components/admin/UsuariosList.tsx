"use client";

import Link from "next/link";
import { useId } from "react";
import { listarUsuarios } from "@/services/users";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ROLE_LABEL } from "@/lib/format/role";
import styles from "./AdminTables.module.css";

function fecha(valor: string): string {
  const date = new Date(valor);
  return Number.isNaN(date.getTime()) ? "fecha no disponible" : date.toLocaleDateString("es-AR");
}

export function UsuariosList() {
  const headingId = useId();
  const { page, setPage } = useUrlPagination();
  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title="Usuarios registrados" description="Cuentas que ya se registraron en la aplicación. Este listado es de consulta: desde acá no se modifican cuentas ni roles." breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Usuarios registrados" }]} />
    <PaginatedListView resetKey="usuarios" page={page} onPageChange={setPage} fetchPage={(next) => listarUsuarios({ page: next })} loadingMessage="Cargando usuarios…"
      empty={<EmptyState action={<Link href="/home/admin">Volver al panel de administración</Link>}>Todavía no hay cuentas registradas.</EmptyState>}>
      {(result) => <Card variant="panel">
        <p className="academic-list-detail">{result.total} {result.total === 1 ? "cuenta registrada" : "cuentas registradas"}.</p>
        <div className={styles.tableWrap}><table className={styles.table}><caption>Usuarios registrados</caption><thead><tr><th scope="col">Nombre visible</th><th scope="col">Email</th><th scope="col">Rol</th><th scope="col">Fecha de alta</th></tr></thead><tbody>
          {result.items.map((usuario) => <tr key={usuario.id}><td>{usuario.displayName}</td><td>{usuario.email}</td><td><Badge tone="role">{ROLE_LABEL[usuario.role]}</Badge></td><td>{fecha(usuario.createdAt)}</td></tr>)}
        </tbody></table></div>
      </Card>}
    </PaginatedListView>
  </section>;
}
