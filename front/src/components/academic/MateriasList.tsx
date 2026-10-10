"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { listarMaterias } from "@/services/academic";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useUrlPageParam } from "@/hooks/useUrlPageParam";
import { findSection } from "@/components/home/sections";
import { Breadcrumb } from "./Breadcrumb";
import { Pagination } from "./Pagination";

export function MateriasList() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [initialPage, setUrlPage] = useUrlPageParam();
  const { status, result, error, page, setPage, retry } = usePaginatedFetch("materias", (pageToFetch) => listarMaterias({ page: pageToFetch }), initialPage);
  useEffect(() => { headingRef.current?.focus(); }, []);
  const handlePageChange = (next: number) => { setPage(next); setUrlPage(next); };

  return <section aria-labelledby="materias-heading">
    <Breadcrumb items={[{ label: "Materias" }]} />
    <h1 ref={headingRef} tabIndex={-1} id="materias-heading">Materias</h1>
    <p className="system-description">{findSection("materias").description}</p>
    {status === "loading" ? <p role="status">Cargando materias…</p> : null}
    {status === "error" ? <p role="alert" className="notice error">{error} <button type="button" onClick={retry}>Reintentar</button></p> : null}
    {status === "ready" && result ? (
      result.items.length === 0
        ? <div className="academic-panel"><p>Todavía no hay materias cargadas. Volvé a intentarlo más adelante.</p></div>
        : <>
          <div className="academic-panel">
            <ul className="academic-list">
              {result.items.map((materia) => <li key={materia.id}>
                <Link href={`/home/materias/${materia.id}?nombre=${encodeURIComponent(materia.nombre)}`}>{materia.nombre}</Link>
              </li>)}
            </ul>
          </div>
          <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={handlePageChange} />
        </>
    ) : null}
  </section>;
}
