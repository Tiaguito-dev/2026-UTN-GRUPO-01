"use client";
import { useEffect, useEffectEvent, useId, useState } from "react";
import type { PaginatedResult } from "@/services/pagination";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import { AdminSearch } from "./AdminTable";
import styles from "./AdminTables.module.css";

export interface AdminOption { id: string; label: string }
interface SelectorProps {
  label: string; resourceKey: string; value: string; disabled?: boolean; searchable?: boolean;
  fetchPage: (page: number, q?: string) => Promise<PaginatedResult<AdminOption>>;
  fetchSelected: (id: string) => Promise<AdminOption>;
  onChange: (id: string) => void;
}

/** Opciones paginadas bajo demanda; la selección por URL se recupera por ID, fuera de la página. */
export function AdminParentSelector({ label, resourceKey, value, disabled, searchable, fetchPage, fetchSelected, onChange }: SelectorProps) {
  const labelId = useId(); const [open, setOpen] = useState(false); const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<{ key: string; option?: AdminOption; error?: string }>();
  const key = `${resourceKey}:${value}:${attempt}`;
  const getSelected = useEffectEvent((id: string) => fetchSelected(id));
  useEffect(() => {
    if (!value) return;
    let active = true;
    getSelected(value).then((option) => { if (active) setSettled({ key, option }); }, () => { if (active) setSettled({ key, error: "Lo sentimos. No pudimos recuperar la selección. Elegí nuevamente o reintentá." }); });
    return () => { active = false; };
  }, [key, value]);
  const selected = settled?.key === key ? settled : undefined;
  function select(id: string) { onChange(id); setOpen(false); }
  return <div className={styles.filterField}>
    <span id={labelId} className={styles.selectorLabel}>{label}</span>
    <button className={`button button-secondary ${styles.selectorButton}`} type="button" disabled={disabled} aria-labelledby={labelId} aria-haspopup="dialog" onClick={() => setOpen(true)}>{value ? selected?.option?.label ?? `${label} seleccionado` : `Elegí ${label.toLocaleLowerCase("es")}`}</button>
    {selected?.error ? <Notice tone="error">{selected.error} <button className="button button-secondary" type="button" onClick={() => setAttempt((n) => n + 1)}>Reintentar {label.toLocaleLowerCase("es")}</button></Notice> : null}
    {open ? <Dialog open title={`Elegir ${label.toLocaleLowerCase("es")}`} onClose={() => setOpen(false)}><AdminParentOptions key={resourceKey} label={label} value={value} searchable={searchable} fetchPage={fetchPage} resourceKey={resourceKey} onChange={select} /></Dialog> : null}
  </div>;
}

function AdminParentOptions({ label, value, searchable, fetchPage, resourceKey, onChange }: Pick<SelectorProps, "label" | "value" | "searchable" | "fetchPage" | "resourceKey" | "onChange">) {
  const [query, setQuery] = useState(""); const [page, setPage] = useState(1);
  const { state, retry } = usePaginatedFetch(`${resourceKey}:${query}`, (next) => fetchPage(next, query), page);
  return <>
    {searchable ? <AdminSearch query={query} label={`Buscar ${label.toLocaleLowerCase("es")} por nombre`} onSearch={(q) => { setQuery(q); setPage(1); }} /> : null}
    <button className="button button-secondary" type="button" onClick={() => onChange("")}>Quitar selección</button>
    {state.status === "loading" ? <p role="status">Cargando opciones…</p> : state.status === "error" ? <Notice tone="error">Lo sentimos. No pudimos recuperar las opciones. Intentá nuevamente. <button className="button button-secondary" type="button" onClick={retry}>Reintentar opciones</button></Notice> : <>
      <p className={styles.summary}>{state.data.total} opciones</p>
      {state.data.items.length ? <ul className={styles.selectorOptions}>{state.data.items.map((option) => <li key={option.id}><button className={`button button-secondary ${styles.selectorButton}`} type="button" aria-pressed={value === option.id} onClick={() => onChange(option.id)}>{option.label}</button></li>)}</ul> : <p>No hay opciones que coincidan con la búsqueda.</p>}
      {page > 1 && !state.data.items.length ? <button className="button button-secondary" type="button" onClick={() => setPage(1)}>Volver a la primera página de opciones</button> : null}
      <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
    </>}
  </>;
}
