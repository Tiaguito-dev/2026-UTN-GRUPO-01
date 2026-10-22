"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { isAnioCarrera, parseMateriaPage, parseMateriaContext } from "@/validations/materias";
import { useEffect, useRef } from "react";
import { listarCursadasPorMateria } from "@/services/academic";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { Breadcrumb } from "./Breadcrumb";
import { Pagination } from "./Pagination";
import { periodoLabel } from "./periodo";

export function CursadasList({ materiaId, materiaNombre, materiasHref = "/home/materias", embedded = false }: { materiaId: string; materiaNombre: string | undefined; materiasHref?: string; embedded?: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const context = useSearchParams();
  const materiaLabel = materiaNombre ?? "Materia";
  const [initialPage, setUrlPage] = useUrlPageParam();
  const { status, result, error, notFound, page, setPage, retry } = usePaginatedFetch(materiaId, (pageToFetch) => listarCursadasPorMateria(materiaId, { page: pageToFetch }), initialPage);
  useEffect(() => { headingRef.current?.focus(); }, [materiaId]);
  const handlePageChange = (next: number) => { setPage(next); setUrlPage(next); };

  return <section aria-labelledby="cursadas-heading">
    {!embedded ? <Breadcrumb items={[{ label: "Materias", href: materiasHref }, { label: materiaLabel }]} /> : null}
    {embedded ? <h2 id="cursadas-heading">Cursadas</h2> : <h1 ref={headingRef} tabIndex={-1} id="cursadas-heading">{materiaLabel}</h1>}
    <p className="system-description">Períodos en los que se dictó esta materia, con el profesor a cargo de cada uno.</p>
    {status === "loading" ? <p role="status">Cargando cursadas…</p> : null}
    {status === "error" ? <p role="alert" className="notice error">
      {error}{" "}
      {notFound ? <Link href={materiasHref}>Volver al listado de materias</Link> : <button type="button" onClick={retry}>Reintentar</button>}
    </p> : null}
    {status === "ready" && result ? (
      result.items.length === 0
        ? <div className="academic-panel"><p>Esta materia todavía no tiene cursadas cargadas. <Link href={materiasHref}>Volver al listado de materias</Link></p></div>
        : <>
          <div className="academic-panel">
            <ul className="academic-list">
              {result.items.map((cursada) => {
                const periodo = periodoLabel(cursada.anio, cursada.cuatrimestre);
                const query = new URLSearchParams({ nombre: materiaLabel, anio: String(cursada.anio), cuatrimestre: cursada.cuatrimestre });
                const careerYear = context.get("anioCarrera");
                if (isAnioCarrera(careerYear)) query.set("anioCarrera", careerYear);
                const listPage = parseMateriaPage(context.get("listadoPage"));
                if (listPage > 1) query.set("listadoPage", String(listPage));
                const searchContext = parseMateriaContext(context);
                if (searchContext.q) query.set("q", searchContext.q);
                if (searchContext.nivelElectiva) query.set("nivelElectiva", searchContext.nivelElectiva);
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
