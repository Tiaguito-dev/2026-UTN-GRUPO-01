"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isAnioCarrera, parseMateriaPage, parseMateriaContext } from "@/validations/materias";
import { useId } from "react";
import { listarCursadasPorMateria } from "@/services/academic";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { periodoLabel } from "@/lib/format/periodo";

export function CursadasList({ materiaId, materiaNombre, materiasHref = "/home/materias", embedded = false }: { materiaId: string; materiaNombre: string | undefined; materiasHref?: string; embedded?: boolean }) {
  const headingId = useId();
  const context = useSearchParams();
  const materiaLabel = materiaNombre ?? "Materia";
  const { page, setPage } = useUrlPagination();
  const back = <Link href={materiasHref}>Volver al listado de materias</Link>;
  const careerYear = context.get("anioCarrera"), listPage = parseMateriaPage(context.get("listadoPage"));
  const searchContext = parseMateriaContext(context);
  return <section aria-labelledby={headingId}>
    {embedded ? <h2 id={headingId}>Cursadas</h2> : <PageHeader id={headingId} title={materiaLabel} breadcrumb={[{ label: "Materias", href: materiasHref }, { label: materiaLabel }]} focusKey={materiaId} />}
    <p className="system-description">Períodos en los que se dictó esta materia, con el profesor a cargo de cada uno.</p>
    <PaginatedListView resetKey={materiaId} page={page} onPageChange={setPage} fetchPage={(next) => listarCursadasPorMateria(materiaId, { page: next })} loadingMessage="Cargando cursadas…"
      notFoundAction={back} empty={<EmptyState action={back}>Esta materia todavía no tiene cursadas cargadas.</EmptyState>}>
      {(result) => <Card variant="panel"><ul className="academic-list">
        {result.items.map((cursada) => {
          // Only the list context travels: names and period come from the backend (TASK-031).
          const query = new URLSearchParams();
          if (isAnioCarrera(careerYear)) query.set("anioCarrera", careerYear);
          if (listPage > 1) query.set("listadoPage", String(listPage));
          if (searchContext.q) query.set("q", searchContext.q); if (searchContext.nivelElectiva) query.set("nivelElectiva", searchContext.nivelElectiva);
          return <li key={cursada.id}><Link href={`/home/materias/${materiaId}/cursadas/${cursada.id}${query.size ? `?${query}` : ""}`}>{periodoLabel(cursada.anio, cursada.cuatrimestre)}</Link><span className="academic-list-detail"> — {cursada.profesor}</span></li>;
        })}
      </ul></Card>}
    </PaginatedListView>
  </section>;
}
