"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { listarComisionesPorCursada, type Cuatrimestre } from "@/services/academic";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { Breadcrumb } from "./Breadcrumb";
import { Pagination } from "./Pagination";
import { periodoLabel } from "./periodo";

export function ComisionesList({ materiaId, cursadaId, materiaNombre, anio, cuatrimestre }: {
  materiaId: string;
  cursadaId: string;
  materiaNombre: string | undefined;
  anio: number | undefined;
  cuatrimestre: Cuatrimestre | undefined;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const materiaLabel = materiaNombre ?? "Materia";
  const periodoActual = anio && cuatrimestre ? periodoLabel(anio, cuatrimestre) : "Período";
  const [initialPage, setUrlPage] = useUrlPageParam();
  const { status, result, error, notFound, page, setPage, retry } = usePaginatedFetch(cursadaId, (pageToFetch) => listarComisionesPorCursada(cursadaId, { page: pageToFetch }), initialPage);
  useEffect(() => { headingRef.current?.focus(); }, [cursadaId]);
  const handlePageChange = (next: number) => { setPage(next); setUrlPage(next); };
  const backHref = `/home/materias/${materiaId}?nombre=${encodeURIComponent(materiaLabel)}`;

  return <section aria-labelledby="comisiones-heading">
    <Breadcrumb items={[
      { label: "Materias", href: "/home/materias" },
      { label: materiaLabel, href: backHref },
      { label: periodoActual },
    ]} />
    <h1 ref={headingRef} tabIndex={-1} id="comisiones-heading">{periodoActual}</h1>
    <p className="system-description">Turnos de cursada de este período.</p>
    {status === "loading" ? <p role="status">Cargando comisiones…</p> : null}
    {status === "error" ? <p role="alert" className="notice error">
      {error}{" "}
      {notFound ? <Link href={backHref}>Volver a las cursadas de {materiaLabel}</Link> : <button type="button" onClick={retry}>Reintentar</button>}
    </p> : null}
    {status === "ready" && result ? (
      result.items.length === 0
        ? <div className="academic-panel"><p>Esta cursada todavía no tiene comisiones cargadas. <Link href={backHref}>Volver a las cursadas de {materiaLabel}</Link></p></div>
        : <>
          <div className="academic-panel">
            <ul className="academic-list">
              {result.items.map((comision) => <li key={comision.id}>
                {comision.nombre}
                {!comision.activa ? <span className="academic-list-detail"> — inactiva</span> : null}
              </li>)}
            </ul>
          </div>
          <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={handlePageChange} />
        </>
    ) : null}
  </section>;
}
