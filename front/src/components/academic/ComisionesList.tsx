"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isAnioCarrera, parseMateriaPage, materiaListHref, materiaDetailHref, parseMateriaContext } from "@/validations/materias";
import { useEffect, useRef } from "react";
import { listarComisionesPorCursada, type Cuatrimestre } from "@/services/academic";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Pagination } from "@/components/ui/Pagination";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Notice } from "@/components/ui/Notice";
import { periodoLabel } from "@/lib/format/periodo";

export function ComisionesList({ materiaId, cursadaId, materiaNombre, anio, cuatrimestre }: {
  materiaId: string;
  cursadaId: string;
  materiaNombre: string | undefined;
  anio: number | undefined;
  cuatrimestre: Cuatrimestre | undefined;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const context = useSearchParams();
  const rawYear = context.get("anioCarrera");
  const careerYear = isAnioCarrera(rawYear) ? rawYear : undefined;
  const listPage = parseMateriaPage(context.get("listadoPage"));
  const materiaLabel = materiaNombre ?? "Materia";
  const periodoActual = anio && cuatrimestre ? periodoLabel(anio, cuatrimestre) : "Período";
  const [initialPage, setUrlPage] = useUrlPageParam();
  const { status, result, error, notFound, page, setPage, retry } = usePaginatedFetch(cursadaId, (pageToFetch) => listarComisionesPorCursada(cursadaId, { page: pageToFetch }), initialPage);
  useEffect(() => { headingRef.current?.focus(); }, [cursadaId]);
  const handlePageChange = (next: number) => { setPage(next); setUrlPage(next); };
  const backHref = materiaDetailHref(materiaId, careerYear, listPage, parseMateriaContext(context));

  return <section aria-labelledby="comisiones-heading">
    <Breadcrumb items={[
      { label: "Materias", href: materiaListHref(careerYear, listPage, parseMateriaContext(context)) },
      { label: materiaLabel, href: backHref },
      { label: periodoActual },
    ]} />
    <h1 ref={headingRef} tabIndex={-1} id="comisiones-heading">{periodoActual}</h1>
    <p className="system-description">Turnos de cursada de este período.</p>
    {status === "loading" ? <p role="status">Cargando comisiones…</p> : null}
    {status === "error" ? <Notice tone="error">
      {error}{" "}
      {notFound ? <Link href={backHref}>Volver a las cursadas de {materiaLabel}</Link> : <button className="button" type="button" onClick={retry}>Reintentar</button>}
    </Notice> : null}
    {status === "ready" && result ? (
      result.items.length === 0
        ? <EmptyState action={<Link href={backHref}>Volver a las cursadas de {materiaLabel}</Link>}>Esta cursada todavía no tiene comisiones cargadas.</EmptyState>
        : <>
          <Card variant="panel">
            <ul className="academic-list">
              {result.items.map((comision) => <li key={comision.id}>
                {comision.nombre}
                {!comision.activa ? <span className="academic-list-detail"> — inactiva</span> : null}
              </li>)}
            </ul>
          </Card>
          <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={handlePageChange} />
        </>
    ) : null}
  </section>;
}
