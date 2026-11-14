"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { listarMaterias } from "@/services/materias";
import { listarCursadasPorMateria, listarComisionesPorCursada, obtenerComision } from "@/services/academic";
import type { PaginatedResult } from "@/services/pagination";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { Pagination } from "@/components/ui/Pagination";
import { Notice } from "@/components/ui/Notice";
import { validateMateriaSearch } from "@/validations/materias";
import styles from "./feedback.module.css";
type Option = { id: string; label: string };

/** Only explicit selections open the existing publication form. No catalog is downloaded in full. */
export function SeleccionComisionComentario({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [materia, setMateria] = useState<Option | null>(null);
  const [cursada, setCursada] = useState<Option | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false); const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  async function chooseCommission(option: Option) {
    if (!materia || !cursada || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const detail = await obtenerComision(option.id);
      if (!active.current) return;
      if (detail.id !== option.id || !detail.activa || detail.deletedAt !== null || detail.cursadaId !== cursada.id || detail.cursada.id !== cursada.id || detail.cursada.materia.id !== materia.id) {
        throw new Error("La comisión ya no está disponible para esta materia y cursada. Elegí otra opción.");
      }
      router.push(`/home/feedback/nuevo?${new URLSearchParams({ comisionId: detail.id, origen: "inicio" })}`);
    } catch (failure) {
      if (active.current) setError(failure instanceof Error ? failure.message : "No pudimos comprobar la comisión. Intentá nuevamente.");
    } finally { if (active.current) { pending.current = false; setBusy(false); } }
  }
  return <div className={styles.stack}>
    <p>Elegí la materia, la cursada y una comisión para compartir tu experiencia.</p>
    {materia ? <p>Materia: <strong>{materia.label}</strong> <button className="button button-secondary" type="button" disabled={busy} onClick={() => { setMateria(null); setCursada(null); setError(""); }}>Cambiar materia</button></p> : null}
    {cursada ? <p>{cursada.label} <button className="button button-secondary" type="button" disabled={busy} onClick={() => { setCursada(null); setError(""); }}>Cambiar cursada</button></p> : null}
    {!materia ? <Opciones key="materias" resource="publicacion-materias" searchable disabled={busy} onSelect={setMateria} fetchPage={async (page, q) => {
      const result = await listarMaterias({ page, pageSize: 9, q });
      return { ...result, items: result.items.filter(item => item.deletedAt === null).map(item => ({ id: item.id, label: item.nombre })) };
    }} /> : !cursada ? <Opciones key={materia.id} resource={`publicacion-cursadas:${materia.id}`} disabled={busy} onSelect={setCursada} fetchPage={async page => {
      const result = await listarCursadasPorMateria(materia.id, { page, pageSize: 9 });
      return { ...result, items: result.items.map(item => ({ id: item.id, label: `Cursada ${item.anio} · ${item.cuatrimestre ?? "Período sin definir"}` })) };
    }} /> : <Opciones key={cursada.id} resource={`publicacion-comisiones:${cursada.id}`} disabled={busy} onSelect={option => void chooseCommission(option)} fetchPage={async page => {
      const result = await listarComisionesPorCursada(cursada.id, { page, pageSize: 9 });
      return { ...result, items: result.items.filter(item => item.activa && item.deletedAt === null && item.cursadaId === cursada.id).map(item => ({ id: item.id, label: `Comisión ${item.nombre}` })) };
    }} />}
    {error ? <Notice tone="error">{error}</Notice> : null}
    {busy ? <p role="status">Comprobando comisión…</p> : null}
    <button className="button button-secondary" type="button" onClick={onCancel}>Cancelar selección</button>
  </div>;
}

function Opciones({ resource, searchable = false, disabled, fetchPage, onSelect }: {
  resource: string; searchable?: boolean; disabled: boolean;
  fetchPage: (page: number, query: string) => Promise<PaginatedResult<Option>>; onSelect: (option: Option) => void;
}) {
  const searchId = useId(); const [search, setSearch] = useState(""); const [query, setQuery] = useState(""); const [page, setPage] = useState(1);
  const invalid = validateMateriaSearch(search);
  const { state, retry } = usePaginatedFetch(`${resource}:${query}`, next => fetchPage(next, query), page);
  return <div className={styles.stack}>
    {searchable ? <form onSubmit={event => { event.preventDefault(); if (!invalid && !disabled) { setQuery(search.trim()); setPage(1); } }}>
      <label htmlFor={searchId}>Buscar materia por nombre</label>
      <input id={searchId} type="search" value={search} disabled={disabled} onChange={event => setSearch(event.target.value)} aria-invalid={Boolean(invalid)} aria-describedby={invalid ? `${searchId}-error` : undefined} />
      <button className="button button-secondary" type="submit" disabled={disabled || Boolean(invalid)}>Buscar materia</button>
      {invalid ? <p id={`${searchId}-error`} role="alert">{invalid}</p> : null}
    </form> : null}
    {state.status === "loading" ? <p role="status">Cargando opciones…</p> : state.status === "error" ? <Notice tone="error">{state.error} <button className="button button-secondary" type="button" onClick={retry}>Reintentar opciones</button></Notice> : <fieldset disabled={disabled}>
      <legend>Opciones disponibles</legend>
      {state.data.items.length ? <ul>{state.data.items.map(item => <li key={item.id}><button className="button button-secondary" type="button" onClick={() => onSelect(item)}>{item.label}</button></li>)}</ul> : <p>No hay opciones válidas en esta página.</p>}
      <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
    </fieldset>}
  </div>;
}
