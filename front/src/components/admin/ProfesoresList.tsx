"use client";

import Link from "next/link";
import { useId } from "react";
import { listarProfesores } from "@/services/academic";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function ProfesoresList() {
  const headingId = useId();
  const { page, setPage } = useUrlPagination();
  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title="Profesores" description="Profesores cargados, disponibles para asignar a una cursada. Este listado es de consulta." breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Profesores" }]} />
    <PaginatedListView resetKey="profesores" page={page} onPageChange={setPage} fetchPage={(next) => listarProfesores({ page: next })} loadingMessage="Cargando profesores…"
      empty={<EmptyState action={<Link href="/home/admin/profesores/nuevo">Cargar un profesor</Link>}>Todavía no hay profesores cargados.</EmptyState>}>
      {(result) => <Card variant="panel">
        <p className="academic-list-detail">{result.total} {result.total === 1 ? "profesor cargado" : "profesores cargados"}.</p>
        <ul className="academic-list">
          {result.items.map((profesor) => <li key={profesor.id}><strong>{profesor.nombreCompleto}</strong></li>)}
        </ul>
      </Card>}
    </PaginatedListView>
  </section>;
}
