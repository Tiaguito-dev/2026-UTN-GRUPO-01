"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { listarCursadasPorMateria } from "@/services/academic";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { Breadcrumb } from "./Breadcrumb";
import { Pagination } from "./Pagination";
import { periodoLabel } from "./periodo";

export function CursadasList({ materiaId, materiaNombre }: { materiaId: string; materiaNombre: string | undefined }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const materiaLabel = materiaNombre ?? "Materia";
  const [initialPage, setUrlPage] = useUrlPageParam();
  const { status, result, error, notFound, page, setPage, retry } = usePaginatedFetch(materiaId, (pageToFetch) => listarCursadasPorMateria(materiaId, { page: pageToFetch }), initialPage);
  useEffect(() => { headingRef.current?.focus(); }, [materiaId]);
  const handlePageChange = (next: number) => { setPage(next); setUrlPage(next); };

  return <section aria-labelledby="cursadas-heading">
    <Breadcrumb items={[{ label: "Materias", href: "/home/materias" }, { label: materiaLabel }]} />
    <h1 ref={headingRef} tabIndex={-1} id="cursadas-heading">{materiaLabel}</h1>
    <p className="system-description">Períodos en los que se dictó esta materia, con el profesor a cargo de cada uno.</p>
    {status === "loading" ? <p role="status">Cargando cursadas…</p> : null}
    {status === "error" ? <p role="alert" className="notice error">
      {error}{" "}
      {notFound ? <Link href="/home/materias">Volver al listado de materias</Link> : <button type="button" onClick={retry}>Reintentar</button>}
    </p> : null}
    {status === "ready" && result ? (
      result.items.length === 0
        ? <div className="academic-panel"><p>Esta materia todavía no tiene cursadas cargadas. <Link href="/home/materias">Volver al listado de materias</Link></p></div>
        : <>
          <div className="academic-panel">
            <ul className="academic-list">
              {result.items.map((cursada) => {
                const periodo = periodoLabel(cursada.anio, cursada.cuatrimestre);
                const query = new URLSearchParams({ nombre: materiaLabel, anio: String(cursada.anio), cuatrimestre: cursada.cuatrimestre });
                return <li key={cursada.id}>
                  <Link href={`/home/materias/${materiaId}/cursadas/${cursada.id}?${query.toString()}`}>{periodo}</Link>
                  <span className="academic-list-detail"> — {cursada.profesor}</span>
                </li>;
              })}
            </ul>
          </div>
          <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={handlePageChange} />
        </>
    ) : null}
  </section>;
}
