"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { listarMaterias } from "@/services/materias";
import type { Carrera } from "@/types/materias";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { validateMateriaSearch } from "@/validations/materias";
import styles from "./feedback.module.css";

/** Native disclosure and buttons keep search, selection and paging keyboard accessible. */
export function ExperienciasMateriaSelector({ carrera, materiaId, nombre, disabled, onSelect }: {
  carrera?: Carrera; materiaId?: string; nombre?: string; disabled: boolean; onSelect: (id?: string) => void;
}) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const element = details.current;
    if (!open || !element) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { element.open = false; summary.current?.focus(); }
    };
    element.addEventListener("keydown", escape);
    return () => element.removeEventListener("keydown", escape);
  }, [open]);
  function select(value?: string) {
    onSelect(value);
    if (details.current) details.current.open = false;
    summary.current?.focus();
  }
  return <div className={styles.feedSubject}>
    <span id={`${id}-label`} className={styles.feedLabel}>Materia</span>
    <details ref={details} className={styles.subjectDisclosure} onToggle={(event) => setOpen(event.currentTarget.open)} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
    }}>
      <summary ref={summary} aria-labelledby={`${id}-label ${id}-value`}><span id={`${id}-value`}>{materiaId ? nombre ?? "Materia seleccionada" : "Todas las materias"}</span><ChevronDown size={18} aria-hidden="true" /></summary>
      {open ? <MateriaOptions key={carrera ?? "todas"} carrera={carrera} materiaId={materiaId} disabled={disabled} onSelect={select} /> : null}
    </details>
  </div>;
}

function MateriaOptions({ carrera, materiaId, disabled, onSelect }: { carrera?: Carrera; materiaId?: string; disabled: boolean; onSelect: (id?: string) => void }) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const invalid = validateMateriaSearch(search);
  useEffect(() => {
    if (validateMateriaSearch(search)) return;
    const timer = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const { state, retry } = usePaginatedFetch(`materias-selector:${carrera ?? ""}:${query}`, (next) => listarMaterias({ page: next, pageSize: 9, carrera, q: query }), page);
  const waiting = !invalid && search.trim() !== query;
  return <div className={styles.subjectPanel}>
    <label htmlFor={id}>Buscar materia por nombre</label>
    <div className={styles.subjectSearch}><Search size={16} aria-hidden="true" /><input id={id} type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre de la materia" aria-invalid={Boolean(invalid)} aria-describedby={invalid ? `${id}-error` : undefined} /></div>
    {invalid ? <p id={`${id}-error`} role="alert">{invalid}</p> : null}
    <button className={styles.subjectOption} type="button" disabled={disabled} aria-pressed={!materiaId} onClick={() => onSelect()}>Todas las materias</button>
    {state.status === "loading" || waiting ? <p role="status">Buscando materias…</p>
      : state.status === "error" ? <p role="alert">Lo sentimos. No pudimos recuperar las materias. <button className="button button-secondary" type="button" onClick={retry}>Reintentar materias</button></p>
        : <>
          {state.data.items.length ? <ul className={styles.subjectOptions}>{state.data.items.map((materia) => <li key={materia.id}><button className={styles.subjectOption} type="button" disabled={disabled || Boolean(invalid)} aria-pressed={materia.id === materiaId} onClick={() => onSelect(materia.id)}>{materia.nombre}</button></li>)}</ul> : <p className={styles.meta}>No hay materias para esta búsqueda.</p>}
          {state.data.total > state.data.pageSize ? <div className={styles.subjectPaging}><button className="button button-secondary" type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Materias anteriores</button><span>Página {page}</span><button className="button button-secondary" type="button" disabled={page * state.data.pageSize >= state.data.total} onClick={() => setPage(page + 1)}>Más materias</button></div> : null}
        </>}
  </div>;
}
