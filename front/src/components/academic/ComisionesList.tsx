"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isAnioCarrera, parseMateriaPage, materiaListHref, materiaDetailHref, parseMateriaContext } from "@/validations/materias";
import { useId } from "react";
import { listarComisionesPorCursada, type Cuatrimestre } from "@/services/academic";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { periodoLabel } from "@/lib/format/periodo";

export function ComisionesList({ materiaId, cursadaId, materiaNombre, anio, cuatrimestre }: { materiaId: string; cursadaId: string; materiaNombre: string | undefined; anio: number | undefined; cuatrimestre: Cuatrimestre | undefined }) {
  const headingId = useId();
  const context = useSearchParams();
  const rawYear = context.get("anioCarrera");
  const careerYear = isAnioCarrera(rawYear) ? rawYear : undefined;
  const listPage = parseMateriaPage(context.get("listadoPage"));
  const materiaLabel = materiaNombre ?? "Materia";
  const periodoActual = anio && cuatrimestre ? periodoLabel(anio, cuatrimestre) : "Período";
  const { page, setPage } = useUrlPagination();
  const backHref = materiaDetailHref(materiaId, careerYear, listPage, parseMateriaContext(context));
  const back = <Link href={backHref}>Volver a las cursadas de {materiaLabel}</Link>;

  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title={periodoActual} description="Turnos de cursada de este período." focusKey={cursadaId} breadcrumb={[{ label: "Materias", href: materiaListHref(careerYear, listPage, parseMateriaContext(context)) }, { label: materiaLabel, href: backHref }, { label: periodoActual }]} />
    <PaginatedListView resetKey={cursadaId} page={page} onPageChange={setPage} fetchPage={(next) => listarComisionesPorCursada(cursadaId, { page: next })} loadingMessage="Cargando comisiones…"
      notFoundAction={back} empty={<EmptyState action={back}>Esta cursada todavía no tiene comisiones cargadas.</EmptyState>}>
      {(result) => <Card variant="panel"><ul className="academic-list">
        {result.items.map((comision) => <li key={comision.id}>{comision.nombre}{!comision.activa ? <span className="academic-list-detail"> — inactiva</span> : null}</li>)}
      </ul></Card>}
    </PaginatedListView>
  </section>;
}
