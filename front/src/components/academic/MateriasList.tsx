"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { listarMaterias } from "@/services/materias";
import type { AnioCarrera } from "@/types/materias";
import { useFocusOnMount } from "@/hooks/useFocusOnMount";
import { ANIOS_CARRERA, anioCarreraLabel, isAnioCarrera, materiaListHref, materiaDetailHref, parseMateriaPage, parseMateriaContext, validateMateriaSearch, NIVELES_ELECTIVA, nivelElectivaLabel, type MateriaContext } from "@/validations/materias";
import { PageHeader } from "@/components/ui/PageHeader";
import { PaginatedListView } from "@/components/ui/PaginatedListView";
import { Card } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import styles from "./MateriasList.module.css";

export function MateriasList() {
  const params = useSearchParams();
  const router = useRouter();
  const rawAnio = params.get("anioCarrera");
  const anio = isAnioCarrera(rawAnio) ? rawAnio : undefined;
  const page = parseMateriaPage(params.get("page"));
  const context = parseMateriaContext(params);
  const headingId = useId();
  return <section aria-labelledby={headingId}>
    <PageHeader id={headingId} title="Materias" breadcrumb={[{ label: "Materias" }]} />
    {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
    <div className={styles.filters}>
      <div className={styles.heading}>
        <p className={styles.title}>Filtros</p>
        <p className={styles.description}>Encontrá una materia por su nombre o explorá por año.</p>
      </div>
      <MateriaSearch key={context.q ?? ""} query={context.q ?? ""} onSearch={(q) => router.replace(materiaListHref(anio, 1, { ...context, q }), { scroll: false })} />
      <div className={styles.filterGroup} role="group" aria-labelledby="anio-carrera-label">
        <p id="anio-carrera-label" className={styles.groupLabel}>Año de la carrera</p>
        <div className={styles.chips}>
          <button className={`button ${styles.chip}`} type="button" aria-pressed={!anio} onClick={() => router.replace(materiaListHref(undefined, 1, context), { scroll: false })}>Todos los años</button>
          {ANIOS_CARRERA.map((value) => <button className={`button ${styles.chip}`} key={value} type="button" aria-pressed={anio === value} onClick={() => router.replace(materiaListHref(value, 1, context), { scroll: false })}>{value === "ELECTIVA" ? "Electivas" : anioCarreraLabel(value)}</button>)}
        </div>
      </div>
      {anio === "ELECTIVA" ? <div className={`${styles.filterGroup} ${styles.electiveGroup}`} role="group" aria-labelledby="nivel-electiva-label">
        <p id="nivel-electiva-label" className={styles.groupLabel}>Nivel de electiva</p>
        <div className={styles.chips}>
          <button className={`button ${styles.chip}`} type="button" aria-pressed={!context.nivelElectiva} onClick={() => router.replace(materiaListHref(anio, 1, { ...context, nivelElectiva: undefined }), { scroll: false })}>Todos los niveles</button>
          {NIVELES_ELECTIVA.map((nivel) => <button className={`button ${styles.chip}`} key={nivel} type="button" aria-pressed={context.nivelElectiva === nivel} onClick={() => router.replace(materiaListHref(anio, 1, { ...context, nivelElectiva: nivel }), { scroll: false })}>{nivelElectivaLabel(nivel)}</button>)}
        </div>
      </div> : null}
    </div>
    <MateriasResults key={`${anio ?? "todos"}:${page}:${context.q ?? ""}:${context.nivelElectiva ?? ""}`} anio={anio} page={page} context={context} />
  </section>;
}
function MateriasResults({ anio, page, context }: { anio: AnioCarrera | undefined; page: number; context: MateriaContext }) {
  const router = useRouter();
  const resultsFocus = useFocusOnMount<HTMLDivElement>();
  return <div ref={resultsFocus} tabIndex={-1}>
    <PaginatedListView resetKey="materias" page={page} onPageChange={(next) => router.replace(materiaListHref(anio, next, context), { scroll: false })} fetchPage={(next) => listarMaterias({ page: next, anioCarrera: anio, ...context })}
      loadingMessage="Cargando materias…" errorMessage="Lo sentimos. No pudimos recuperar las materias. Intentá nuevamente." empty={<p>No hay materias que coincidan con la búsqueda y los filtros.</p>}>
      {(result) => [...ANIOS_CARRERA, null].map((group) => {
        const items = result.items.filter((materia) => (materia.anioCarrera ?? null) === group);
        return items.length ? <Card variant="panel" key={group ?? "sin-anio"}><h2>{anioCarreraLabel(group)}</h2><ul className="academic-list">
          {items.map((materia) => <li key={materia.id}><Link href={materiaDetailHref(materia.id, anio, page, context)}>{materia.nombre}</Link>{materia.anioCarrera === "ELECTIVA" ? <span className="academic-list-detail"> — {nivelElectivaLabel(materia.nivelElectiva ?? null)}</span> : null}</li>)}
        </ul></Card> : null;
      })}
    </PaginatedListView>
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
  return <form className={styles.search} onSubmit={submit} noValidate role="search">
    <div className={styles.searchField}><label htmlFor="materia-search">Buscar por nombre</label><div className={styles.searchControls}><input id="materia-search" name="q" type="search" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Nombre de la materia" maxLength={150} aria-invalid={Boolean(error)} aria-describedby={error ? "materia-search-error" : undefined} /><button className={`button ${styles.searchButton}`} type="submit">Buscar</button></div>{error ? <p id="materia-search-error" role="alert" className="field-error">{error}</p> : null}</div>
    {value || query ? <button className={`button ${styles.clearButton}`} type="button" onClick={() => { setValue(""); setError(""); onSearch(""); }}>Limpiar búsqueda</button> : null}
  </form>;
}
