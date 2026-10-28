"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { listarFeedback } from "@/services/feedback";
import { obtenerMateria } from "@/services/materias";
import { CARRERAS, isCarrera } from "@/validations/materias";
import { carreraLabel } from "@/lib/format/carrera";
import { experienciasFilters, experienciasHref, experienciasOrigin, feedbackDetalleHref } from "@/validations/feedback";
import type { Carrera } from "@/types/materias";
import { useFeedbackResource } from "./useFeedbackResource";
import { ExperienceCard } from "./ExperienceCard";
import { ExperienciasMateriaSelector } from "./ExperienciasMateriaSelector";
import styles from "./feedback.module.css";

export function ExperienciasList() {
  const headingId = useId();
  const careerId = useId();
  const router = useRouter();
  const params = useSearchParams();
  const { carrera, materiaId } = experienciasFilters(params);
  const { page, setPage } = useUrlPagination();
  const origin = experienciasOrigin(params);
  const selected = useFeedbackResource(`materia-experiencias:${materiaId ?? ""}`, () => materiaId ? obtenerMateria(materiaId) : Promise.resolve(null));
  const [changing, setChanging] = useState(false);
  const [filterError, setFilterError] = useState("");
  const pending = useRef(false);
  const { state, retry } = usePaginatedFetch(`experiencias:${carrera ?? ""}:${materiaId ?? ""}`, (next) => listarFeedback({ page: next, pageSize: 9, carrera, materiaId }), page);
  const active = Boolean(carrera || materiaId);
  function navigate(nextCareer?: Carrera, nextSubject?: string) {
    router.replace(experienciasHref(nextCareer, nextSubject), { scroll: false });
  }
  async function changeCareer(next?: Carrera) {
    if (pending.current) return;
    pending.current = true; setChanging(true); setFilterError("");
    try {
      const subject = materiaId && next ? selected.data ?? await obtenerMateria(materiaId) : null;
      navigate(next, !next || subject?.carreras.some((row) => row.carrera === next) ? materiaId : undefined);
    } catch {
      setFilterError("Lo sentimos. No pudimos comprobar la carrera de la materia. Intentá seleccionar la carrera nuevamente.");
    } finally { pending.current = false; setChanging(false); }
  }
  const clear = () => { setFilterError(""); navigate(); };
  return <section className={styles.feedPage} aria-labelledby={headingId}>
    <div className={styles.feedHeader}>
      <PageHeader id={headingId} title="Experiencias" description="Comentarios de la comunidad sobre materias, comisiones y docentes, del más reciente al más antiguo." />
      <p className={styles.meta}>Para compartir tu experiencia, elegí una comisión desde <Link href="/home/materias">Materias</Link>.</p>
    </div>
    <div className={styles.feedFilters}>
      <div className={styles.feedCareer}><label htmlFor={careerId}>Carrera</label><div className={styles.feedSelect}><select id={careerId} value={carrera ?? ""} disabled={changing} onChange={(event) => void changeCareer(isCarrera(event.target.value) ? event.target.value : undefined)}><option value="">Todas las carreras</option>{CARRERAS.map((value) => <option key={value} value={value}>{carreraLabel(value)}</option>)}</select><ChevronDown size={18} aria-hidden="true" /></div></div>
      <ExperienciasMateriaSelector carrera={carrera} materiaId={materiaId} nombre={selected.data?.nombre} disabled={changing} onSelect={(id) => navigate(carrera, id)} />
      {active ? <button className={`button button-secondary ${styles.feedClear}`} type="button" disabled={changing} onClick={clear}>Limpiar filtros</button> : null}
    </div>
    {changing ? <p role="status" className={styles.meta}>Actualizando filtros…</p> : null}
    {filterError ? <Notice tone="error">{filterError}</Notice> : null}
    {materiaId && selected.error ? <Notice tone="error">Lo sentimos. No pudimos recuperar la materia seleccionada. <button className="button button-secondary" type="button" onClick={selected.retry}>Reintentar materia</button></Notice> : null}
    {state.status === "loading" ? <p role="status">Cargando experiencias…</p> : state.status === "error" ? <Notice tone="error">Lo sentimos. No pudimos recuperar las experiencias. Intentá nuevamente. <button className="button" type="button" onClick={retry}>Reintentar</button></Notice> : <>
      <p className={styles.feedSummary}>{state.data.total === 1 ? "1 comentario" : `${state.data.total} comentarios`}{state.data.items.length ? ` · Mostrando ${(state.data.page - 1) * state.data.pageSize + 1}–${Math.min(state.data.total, (state.data.page - 1) * state.data.pageSize + state.data.items.length)}` : ""}</p>
      {state.data.items.length ? <ul className={styles.experienceList}>{state.data.items.map((feedback) => <li key={feedback.id}><ExperienceCard feedback={feedback} showContext origin={origin} onManage={() => router.push(feedbackDetalleHref(feedback.id, origin))} /></li>)}</ul> : state.data.total ? <p>No hay comentarios en esta página. <button className="button button-secondary" type="button" onClick={() => setPage(1)}>Volver a la primera página</button></p> : <div className={styles.experienceEmpty}><p>{active ? "No hay experiencias para estos filtros." : "Todavía no hay experiencias publicadas."}</p><button className="button button-secondary" type="button" onClick={clear}>Limpiar filtros</button></div>}
      <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
    </>}
  </section>;
}
