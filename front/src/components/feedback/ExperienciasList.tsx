"use client";

import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Users, MessageSquare } from "lucide-react";
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
import { MisExperiencias } from "./MisExperiencias";
import { feedbackSuccessMessage } from "@/validations/feedback";
import styles from "./feedback.module.css";
import presentation from "./ExperienciasPresentation.module.css";

export function ExperienciasList({ administrative = false }: { administrative?: boolean }) {
  const params = useSearchParams();
  const ownHeadingId = useId();
  const own = !administrative && params.get("seccion") === "propias";
  const selector = !administrative ? <nav className={presentation.segmented} aria-label="Secciones de experiencias">
    <Link aria-current={!own ? "page" : undefined} href="/home/experiencias"><Users size={17} aria-hidden="true" />Comunidad</Link>
    <Link aria-current={own ? "page" : undefined} href="/home/experiencias?seccion=propias"><MessageSquare size={17} aria-hidden="true" />Mis experiencias</Link>
  </nav> : null;
  return own ? <section className={styles.feedPage} aria-labelledby={ownHeadingId}><div className={styles.feedHeader}><PageHeader id={ownHeadingId} title="Mis experiencias" description="Consultá tus comentarios, su revisión y las causas de ocultamiento." breadcrumb={[{ label: "Inicio", href: "/home" }, { label: "Experiencias", href: "/home/experiencias" }, { label: "Mis experiencias" }]} /></div>{selector}<MisExperiencias /></section> : <ExperienciasComunidad administrative={administrative} selector={selector} />;
}

function ExperienciasComunidad({ administrative, selector }: { administrative: boolean; selector: ReactNode }) {
  const headingId = useId();
  const careerId = useId();
  const router = useRouter();
  const params = useSearchParams();
  const { carrera, materiaId } = experienciasFilters(params);
  const { page, setPage } = useUrlPagination();
  const origin = experienciasOrigin(params);
  const listHref = experienciasHref(carrera, materiaId, page).replace("/home/experiencias", administrative ? "/home/admin/experiencias" : "/home/experiencias");
  const selected = useFeedbackResource(`materia-experiencias:${materiaId ?? ""}`, () => materiaId ? obtenerMateria(materiaId) : Promise.resolve(null));
  const [changing, setChanging] = useState(false);
  const [filterError, setFilterError] = useState("");
  const pending = useRef(false);
  const [reportNotice, setReportNotice] = useState(false);
  const { state, retry } = usePaginatedFetch(`experiencias:${carrera ?? ""}:${materiaId ?? ""}`, (next) => listarFeedback({ page: next, pageSize: 9, carrera, materiaId }), page);
  const active = Boolean(carrera || materiaId);
  function navigate(nextCareer?: Carrera, nextSubject?: string) {
    router.replace(experienciasHref(nextCareer, nextSubject).replace("/home/experiencias", administrative ? "/home/admin/experiencias" : "/home/experiencias"), { scroll: false });
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
      <PageHeader id={headingId} title="Experiencias" description="Comentarios de la comunidad sobre materias, comisiones y docentes, del más reciente al más antiguo." breadcrumb={administrative ? [{ label: "Administración", href: "/home/admin" }, { label: "Experiencias" }] : [{ label: "Inicio", href: "/home" }, { label: "Experiencias" }]} back={administrative ? { href: "/home/admin", label: "Administración" } : undefined} />
      {!administrative ? <p className={styles.meta}>Para compartir tu experiencia, elegí una comisión desde <Link href="/home/materias">Materias</Link>.</p> : null}
    </div>
    {selector}
    {feedbackSuccessMessage(params.get("successMessage")) ? <Notice tone="success">{feedbackSuccessMessage(params.get("successMessage"))}</Notice> : null}
    <div className={`${styles.feedFilters}${!administrative ? ` ${presentation.filters}` : ""}`} role="group" aria-label="Filtrar experiencias por carrera y materia">
      <div className={styles.feedCareer}><label htmlFor={careerId}>Carrera</label><div className={styles.feedSelect}><select id={careerId} value={carrera ?? ""} disabled={changing} onChange={(event) => void changeCareer(isCarrera(event.target.value) ? event.target.value : undefined)}><option value="">Todas las carreras</option>{CARRERAS.map((value) => <option key={value} value={value}>{carreraLabel(value)}</option>)}</select><ChevronDown size={18} aria-hidden="true" /></div></div>
      <ExperienciasMateriaSelector carrera={carrera} materiaId={materiaId} nombre={selected.data?.nombre} disabled={changing} onSelect={(id) => navigate(carrera, id)} />
      {active ? <button className={`button button-secondary ${styles.feedClear}`} type="button" disabled={changing} onClick={clear}>Limpiar filtros</button> : null}
    </div>
    {reportNotice ? <Notice tone="success">El reporte se envi&#243; correctamente. El equipo administrativo lo revisar&#225;.</Notice> : null}
    {changing ? <p role="status" className={styles.meta}>Actualizando filtros…</p> : null}
    {filterError ? <Notice tone="error">{filterError}</Notice> : null}
    {materiaId && selected.error ? <Notice tone="error">Lo sentimos. No pudimos recuperar la materia seleccionada. <button className="button button-secondary" type="button" onClick={selected.retry}>Reintentar materia</button></Notice> : null}
    {state.status === "loading" ? <p role="status">Cargando experiencias…</p> : state.status === "error" ? <Notice tone="error">Lo sentimos. No pudimos recuperar las experiencias. Intentá nuevamente. <button className="button" type="button" onClick={retry}>Reintentar</button></Notice> : <>
      <p className={styles.feedSummary}>{state.data.total === 1 ? "1 comentario" : `${state.data.total} comentarios`}{state.data.items.length ? ` · Mostrando ${(state.data.page - 1) * state.data.pageSize + 1}–${Math.min(state.data.total, (state.data.page - 1) * state.data.pageSize + state.data.items.length)}` : ""}</p>
      {state.data.items.length ? <ul className={styles.experienceList}>{state.data.items.map((feedback) => <li key={feedback.id}><ExperienceCard feedback={feedback} onReported={() => { setReportNotice(true); retry(); }} showContext origin={origin} administrative={administrative} returnTo={listHref} onManage={() => router.push(feedbackDetalleHref(feedback.id, origin))} /></li>)}</ul> : state.data.total ? <p>No hay comentarios en esta página. <button className="button button-secondary" type="button" onClick={() => setPage(1)}>Volver a la primera página</button></p> : <div className={styles.experienceEmpty}><p>{active ? "No hay experiencias para estos filtros." : "Todavía no hay experiencias publicadas."}</p><button className="button button-secondary" type="button" onClick={clear}>Limpiar filtros</button></div>}
      <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={setPage} />
    </>}
  </section>;
}
