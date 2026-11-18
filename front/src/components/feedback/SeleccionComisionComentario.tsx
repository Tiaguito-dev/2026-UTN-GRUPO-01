"use client";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { listarMaterias } from "@/services/materias";
import { listarCursadasPorMateria, listarComisionesPorCursada, obtenerComision } from "@/services/academic";
import type { PaginatedResult } from "@/services/pagination";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { Pagination } from "@/components/ui/Pagination";
import { Notice } from "@/components/ui/Notice";
import { validateMateriaSearch } from "@/validations/materias";
import { mensajeErrorModeracion } from "@/validations/feedback-moderation";
import styles from "./SeleccionComisionComentario.module.css";
type Option = { id: string; label: string };

/** Only explicit selections open the existing publication form. No catalog is downloaded in full. */
export function SeleccionComisionComentario({ onCancel }: { onCancel: () => void }) {
  const router = useRouter();
  const [materia, setMateria] = useState<Option | null>(null);
  const [cursada, setCursada] = useState<Option | null>(null);
  const [comision, setComision] = useState<Option | null>(null);
  const [step, setStep] = useState(0);
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
        setError("La comisión ya no está disponible para esta materia y cursada. Elegí otra opción."); return;
      }
      router.push(`/home/feedback/nuevo?${new URLSearchParams({ comisionId: detail.id, origen: "inicio" })}`);
    } catch (failure) {
      if (active.current) setError(mensajeErrorModeracion(failure, "No pudimos comprobar la comisión. Intentá nuevamente."));
    } finally { if (active.current) { pending.current = false; setBusy(false); } }
  }
  const selected = step === 0 ? materia : step === 1 ? cursada : comision;
  return <div className={styles.selector}>
    <p role="status">Paso {step + 1} de 3: elegí {step === 0 ? "una materia" : step === 1 ? "una cursada" : "una comisión"}.</p>
    <ol className={styles.steps} aria-label="Pasos de selección">{["Materia", "Cursada", "Comisión"].map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
    {step > 0 ? <p className={styles.context}>{materia?.label}{step > 1 ? ` · ${cursada?.label}` : ""}</p> : null}
    <div className={styles.results}>
    {step === 0 ? <Opciones key="materias" resource="publicacion-materias" searchable selected={materia} disabled={busy} onSelect={option => { if (option.id !== materia?.id) { setCursada(null); setComision(null); } setMateria(option); }} fetchPage={async (page, q) => {
      const result = await listarMaterias({ page, pageSize: 9, q });
      return { ...result, items: result.items.filter(item => item.deletedAt === null).map(item => ({ id: item.id, label: item.nombre })) };
    }} /> : step === 1 && materia ? <Opciones key={materia.id} resource={`publicacion-cursadas:${materia.id}`} selected={cursada} disabled={busy} onSelect={option => { if (option.id !== cursada?.id) setComision(null); setCursada(option); }} fetchPage={async page => {
      const result = await listarCursadasPorMateria(materia.id, { page, pageSize: 9 });
      return { ...result, items: result.items.map(item => ({ id: item.id, label: `Cursada ${item.anio} · ${item.cuatrimestre ?? "Período sin definir"}` })) };
    }} /> : cursada ? <Opciones key={cursada.id} resource={`publicacion-comisiones:${cursada.id}`} selected={comision} disabled={busy} onSelect={setComision} fetchPage={async page => {
      const result = await listarComisionesPorCursada(cursada.id, { page, pageSize: 9 });
      return { ...result, items: result.items.filter(item => item.activa && item.deletedAt === null && item.cursadaId === cursada.id).map(item => ({ id: item.id, label: `Comisión ${item.nombre}` })) };
    }} /> : null}
    </div>
    {error ? <Notice tone="error">{error}</Notice> : null}
    {busy ? <p role="status">Comprobando comisión…</p> : null}
    <div className={styles.navigation}>
      <button className="button button-secondary" type="button" onClick={onCancel}>Cancelar selección</button>
      <button className="button button-secondary" type="button" disabled={busy || step === 0} onClick={() => { setStep(value => Math.max(0, value - 1)); setError(""); }}><ArrowLeft size={16} aria-hidden="true" />Anterior</button>
      <button className="button" type="button" disabled={busy || !selected} onClick={() => { setError(""); if (step === 2 && comision) void chooseCommission(comision); else setStep(value => value + 1); }}>{busy ? "Comprobando…" : "Siguiente"}<ArrowRight size={16} aria-hidden="true" /></button>
    </div>
  </div>;
}

function Opciones({ resource, searchable = false, disabled, fetchPage, onSelect, selected }: {
  resource: string; searchable?: boolean; disabled: boolean; selected: Option | null;
  fetchPage: (page: number, query: string) => Promise<PaginatedResult<Option>>; onSelect: (option: Option) => void;
}) {
  const searchId = useId(); const [search, setSearch] = useState(""); const [query, setQuery] = useState(""); const [page, setPage] = useState(1);
  const invalid = validateMateriaSearch(search);
  const { state, retry } = usePaginatedFetch(`${resource}:${query}`, next => fetchPage(next, query).catch(failure => { throw new Error(mensajeErrorModeracion(failure, "No pudimos recuperar las opciones. Intentá nuevamente.")); }), page);
  return <div className={styles.options}>
    {searchable ? <form className={styles.search} onSubmit={event => { event.preventDefault(); if (!invalid && !disabled) { setQuery(search.trim()); setPage(1); } }}>
      <label htmlFor={searchId}>Buscar materia por nombre</label>
      <div className={styles.searchInput}><Search size={18} aria-hidden="true" /><input id={searchId} type="search" value={search} placeholder="Buscá una materia por su nombre" disabled={disabled} onChange={event => setSearch(event.target.value)} aria-invalid={Boolean(invalid)} aria-describedby={invalid ? `${searchId}-error` : undefined} /></div>
      <button className="button button-secondary" type="submit" disabled={disabled || Boolean(invalid)}>Buscar materia</button>
      {invalid ? <p id={`${searchId}-error`} role="alert">{invalid}</p> : null}
    </form> : null}
    {state.status === "loading" ? <p role="status">Cargando opciones…</p> : state.status === "error" ? <Notice tone="error">{state.error} <button className="button button-secondary" type="button" onClick={retry}>Reintentar opciones</button></Notice> : <fieldset className={styles.fieldset} disabled={disabled}>
      <legend>Opciones disponibles</legend>
      {state.data.items.length ? <ul className={styles.optionList}>{state.data.items.map(item => <li key={item.id}><label className={styles.option}><input type="radio" name={searchId} value={item.id} checked={selected?.id === item.id} onChange={() => onSelect(item)} /><span>{item.label}</span></label></li>)}</ul> : <p>No hay opciones válidas en esta página.</p>}
      <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
    </fieldset>}
  </div>;
}
