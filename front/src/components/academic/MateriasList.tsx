"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { listarMaterias } from "@/services/materias";
import type { AnioCarrera } from "@/types/materias";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { ANIOS_CARRERA, anioCarreraLabel, isAnioCarrera, materiaListHref, materiaDetailHref, parseMateriaPage, parseMateriaContext, validateMateriaSearch, NIVELES_ELECTIVA, isNivelElectiva, nivelElectivaLabel, type MateriaContext } from "@/validations/materias";
import { Breadcrumb } from "./Breadcrumb";
import { Pagination } from "./Pagination";

export function MateriasList() {
  const params = useSearchParams();
  const router = useRouter();
  const rawAnio = params.get("anioCarrera");
  const anio = isAnioCarrera(rawAnio) ? rawAnio : undefined;
  const page = parseMateriaPage(params.get("page"));
  const context = parseMateriaContext(params);
  return <section aria-labelledby="materias-heading">
    <Breadcrumb items={[{ label: "Materias" }]} />
    <h1 id="materias-heading">Materias</h1>
    {params.get("successMessage") ? <p role="status" className="notice success">{params.get("successMessage")}</p> : null}
    <MateriaSearch key={context.q ?? ""} query={context.q ?? ""} onSearch={(q) => router.replace(materiaListHref(anio, 1, { ...context, q }), { scroll: false })} />
    <div className="field"><label htmlFor="anio-carrera">Año de la carrera</label>
      <select id="anio-carrera" value={anio ?? ""} onChange={(event) => router.replace(materiaListHref(isAnioCarrera(event.target.value) ? event.target.value : undefined, 1, context), { scroll: false })}>
        <option value="">Todos los años</option>
        {ANIOS_CARRERA.map((value) => <option key={value} value={value}>{value === "ELECTIVA" ? "Electivas" : anioCarreraLabel(value)}</option>)}
      </select>
    </div>
    {anio === "ELECTIVA" ? <div className="field"><label htmlFor="nivel-electiva">Nivel de electiva</label><select id="nivel-electiva" value={context.nivelElectiva ?? ""} onChange={(event) => router.replace(materiaListHref(anio, 1, { ...context, nivelElectiva: isNivelElectiva(event.target.value) ? event.target.value : undefined }), { scroll: false })}><option value="">Todos los niveles</option>{NIVELES_ELECTIVA.map((nivel) => <option key={nivel} value={nivel}>{nivelElectivaLabel(nivel)}</option>)}</select></div> : null}
    <MateriasResults key={`${anio ?? "todos"}:${page}:${context.q ?? ""}:${context.nivelElectiva ?? ""}`} anio={anio} initialPage={page} context={context} />
  </section>;
}
function MateriasResults({ anio, initialPage, context }: { anio: AnioCarrera | undefined; initialPage: number; context: MateriaContext }) {
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const { status, result, error, page, retry } = usePaginatedFetch(`materias:${anio ?? "todos"}`, (next) => listarMaterias({ page: next, anioCarrera: anio, ...context }), initialPage);
  useEffect(() => { listRef.current?.focus(); }, []);
  return <div ref={listRef} tabIndex={-1}>
    {status === "loading" ? <p role="status">Cargando materias…</p> : null}
    {status === "error" ? <p role="alert" className="notice error">Lo sentimos. No pudimos recuperar las materias. Intentá nuevamente. <span>{error}</span> <button type="button" onClick={retry}>Reintentar</button></p> : null}
    {status === "ready" && result ? result.items.length === 0 ? <p>No hay materias que coincidan con la búsqueda y los filtros.</p> : <>
      {[...ANIOS_CARRERA, null].map((group) => {
        const items = result.items.filter((materia) => (materia.anioCarrera ?? null) === group);
        return items.length ? <div className="academic-panel" key={group ?? "sin-anio"}><h2>{anioCarreraLabel(group)}</h2><ul className="academic-list">
          {items.map((materia) => <li key={materia.id}><Link href={materiaDetailHref(materia.id, anio, page, context)}>{materia.nombre}</Link>{materia.anioCarrera === "ELECTIVA" ? <span className="academic-list-detail"> — {nivelElectivaLabel(materia.nivelElectiva ?? null)}</span> : null}</li>)}
        </ul></div> : null;
      })}
      <Pagination page={page} pageSize={result.pageSize} total={result.total} onChange={(next) => router.replace(materiaListHref(anio, next, context), { scroll: false })} />
    </> : null}
  </div>;
}

function MateriaSearch({ query, onSearch }: { query: string; onSearch: (q: string) => void }) {
  const [value, setValue] = useState(query);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const issue = validateMateriaSearch(value);
    setError(issue ?? "");
    if (!issue) onSearch(value.trim());
  }
  return <form onSubmit={submit} noValidate role="search">
    <div className="field"><label htmlFor="materia-search">Buscar por nombre</label><input id="materia-search" name="q" type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Nombre de la materia" maxLength={150} aria-invalid={Boolean(error)} aria-describedby={error ? "materia-search-error" : undefined} />{error ? <p id="materia-search-error" role="alert" className="field-error">{error}</p> : null}</div>
    <button type="submit">Buscar</button>{value || query ? <button type="button" onClick={() => { setValue(""); setError(""); onSearch(""); }}>Limpiar búsqueda</button> : null}
  </form>;
}
