"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isAnioCarrera, parseMateriaPage, materiaListHref, materiaDetailHref, parseMateriaContext } from "@/validations/materias";
import { useEffect, useId } from "react";
import { listarComisionesPorCursada } from "@/services/academic";
import { useCursada } from "@/hooks/useCursada";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { periodoLabel } from "@/lib/format/periodo";

export function ComisionesList({ materiaId, cursadaId }: { materiaId: string; cursadaId: string }) {
  const headingId = useId();
  const context = useSearchParams();
  const rawYear = context.get("anioCarrera");
  const careerYear = isAnioCarrera(rawYear) ? rawYear : undefined;
  const listPage = parseMateriaPage(context.get("listadoPage"));
  // Names come from the backend detail (TASK-031 decision 2): "Cargando…" until it arrives.
  const { cursada, error, notFound, retry } = useCursada(cursadaId);
  const materiaLabel = cursada?.materia.nombre ?? (error ? "Materia" : "Cargando…");
  const periodoActual = cursada ? periodoLabel(cursada.anio, cursada.cuatrimestre) : error ? "Período" : "Cargando…";
  useEffect(() => { if (cursada) document.title = `${periodoActual} | Profesor Butchery`; }, [cursada, periodoActual]);
  const { page, setPage } = useUrlPagination();
  // Once loaded, link to the cursada's real materia: a hand-edited URL can pair it with another one.
  const backHref = materiaDetailHref(cursada?.materia.id ?? materiaId, careerYear, listPage, parseMateriaContext(context));
  const back = <Link href={backHref}>Volver a las cursadas de {cursada?.materia.nombre ?? "la materia"}</Link>;

  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title={periodoActual} description="Turnos de cursada de este período." focusKey={cursadaId} breadcrumb={[{ label: "Materias", href: materiaListHref(careerYear, listPage, parseMateriaContext(context)) }, { label: materiaLabel, href: backHref }, { label: periodoActual }]} />
    {error ? <Notice tone="error">{error} {notFound ? back : <button className="button" type="button" onClick={retry}>Reintentar</button>}</Notice> : <PaginatedListView resetKey={cursadaId} page={page} onPageChange={setPage} fetchPage={(next) => listarComisionesPorCursada(cursadaId, { page: next })} loadingMessage="Cargando comisiones…"
      notFoundAction={back} empty={<EmptyState action={back}>Esta cursada todavía no tiene comisiones cargadas.</EmptyState>}>
      {(result) => <Card variant="panel"><ul className="academic-list">
        {result.items.map((comision) => <li key={comision.id}>{comision.nombre}{!comision.activa ? <span className="academic-list-detail"> — inactiva</span> : null}</li>)}
      </ul></Card>}
    </PaginatedListView>}
  </section>;
}
