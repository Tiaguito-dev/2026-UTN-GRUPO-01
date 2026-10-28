"use client";

import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listarComisionesPorCursada, listarCursadasPorMateria, type CursadaResumen } from "@/services/academic";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { Pagination } from "@/components/ui/Pagination";
import { Notice } from "@/components/ui/Notice";
import { periodoLabel } from "@/lib/format/periodo";
import { cargoLabel, carreraShortLabel, parseMateriaPage } from "@/validations/materias";
import { CursadasList } from "./CursadasList";
import styles from "./ComisionesMateria.module.css";
import { feedbackOriginParams } from "@/validations/feedback";
import cardStyles from "./ComisionesList.module.css";

type PeriodsResource = { key: string; items: CursadaResumen[]; error: string };

async function loadPeriods(materiaId: string): Promise<CursadaResumen[]> {
  const first = await listarCursadasPorMateria(materiaId, { page: 1, pageSize: 100 });
  const items = [...first.items];
  for (let page = 2; page <= Math.ceil(first.total / first.pageSize); page += 1) {
    const next = await listarCursadasPorMateria(materiaId, { page, pageSize: 100 });
    items.push(...next.items);
  }
  const periodOrder = { PRIMERO: 1, SEGUNDO: 2, ANUAL: 3 };
  return items.sort((a, b) => b.anio - a.anio || (b.cuatrimestre ? periodOrder[b.cuatrimestre] : 0) - (a.cuatrimestre ? periodOrder[a.cuatrimestre] : 0) || a.id.localeCompare(b.id));
}

/** Period is a filter here; commissions remain distinct resources for each academic period. */
export function ComisionesMateria({ materiaId, materiaNombre, materiasHref = "/home/materias" }: { materiaId: string; materiaNombre: string; materiasHref?: string }) {
  const headingId = useId();
  const selectorId = useId();
  const router = useRouter();
  const params = useSearchParams();
  const isAdmin = useIsAdmin();
  const [revision, setRevision] = useState(0);
  const [manageOpen, setManageOpen] = useState(false);
  const [resource, setResource] = useState<PeriodsResource | null>(null);
  const key = `${materiaId}:${revision}`;
  const periods = resource?.key === key ? resource : null;
  const selectedId = params.get("cursadaId");
  const requested = periods?.items.find((item) => item.id === selectedId);
  const selected = requested ?? periods?.items[0];
  const page = !selectedId || requested ? parseMateriaPage(params.get("comisionesPage")) : 1;
  const context = feedbackOriginParams(params);
  for (const name of ["cursadaId", "comisionesPage", "page"]) context.delete(name);
  for (const name of ["carrera", "anioCarrera", "listadoPage", "q", "nivelElectiva"]) {
    const value = params.get(name);
    if (value) context.set(name, value);
  }
  const contextQuery = context.toString();

  useEffect(() => {
    let active = true;
    loadPeriods(materiaId).then(
      (items) => { if (active) setResource({ key, items, error: "" }); },
      () => { if (active) setResource({ key, items: [], error: "Lo sentimos. No pudimos recuperar las cursadas. Intentá nuevamente." }); },
    );
    return () => { active = false; };
  }, [materiaId, key]);

  function navigate(cursadaId: string, nextPage = 1) {
    const query = new URLSearchParams(contextQuery);
    query.set("cursadaId", cursadaId);
    if (nextPage > 1) query.set("comisionesPage", String(nextPage));
    router.replace(`/home/materias/${encodeURIComponent(materiaId)}?${query}`, { scroll: false });
  }

  return <section className={styles.module} aria-labelledby={headingId}>
    <div className={styles.header}><div><h2 id={headingId}>Comisiones</h2><p>Elegí una comisión para consultar y compartir experiencias. La cursada identifica el año y el período.</p></div>
      {isAdmin && selected ? <Link className="button" href={`/home/admin/comisiones/nueva?cursadaId=${encodeURIComponent(selected.id)}`}>Nueva comisión</Link> : null}
    </div>
    {!periods ? <p role="status">Cargando cursadas…</p> : periods.error ? <Notice tone="error">{periods.error} <button className="button" type="button" onClick={() => setRevision((value) => value + 1)}>Reintentar cursadas</button></Notice> : selected ? <>
      <div className={styles.period}><label htmlFor={selectorId}><CalendarDays size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />Cursada</label><div className={styles.selectControl}><select id={selectorId} value={selected.id} onChange={(event) => navigate(event.target.value)}>{periods.items.map((period) => <option key={period.id} value={period.id}>{periodoLabel(period.anio, period.cuatrimestre)}</option>)}</select><ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" /></div></div>
      {selectedId && !requested ? <p className={styles.summary}>El período solicitado no está disponible. Se muestra el más reciente.</p> : null}
      <ComisionesPeriodo key={selected.id} materiaId={materiaId} cursada={selected} page={page} contextQuery={contextQuery} onPageChange={(next) => navigate(selected.id, next)} />
    </> : <p>Esta materia todavía no tiene cursadas cargadas.</p>}
    {isAdmin ? <details className={styles.management} onToggle={(event) => setManageOpen(event.currentTarget.open)}><summary>Gestionar períodos</summary>{manageOpen ? <div><CursadasList materiaId={materiaId} materiaNombre={materiaNombre} materiasHref={materiasHref} embedded onCreated={() => setRevision((value) => value + 1)} /></div> : null}</details> : null}
  </section>;
}

function ComisionesPeriodo({ materiaId, cursada, page, contextQuery, onPageChange }: { materiaId: string; cursada: CursadaResumen; page: number; contextQuery: string; onPageChange: (page: number) => void }) {
  const { state, retry } = usePaginatedFetch(`comisiones-materia:${cursada.id}`, (next) => listarComisionesPorCursada(cursada.id, { page: next, pageSize: 9 }), page);
  const query = new URLSearchParams(contextQuery);
  query.set("cursadaId", cursada.id);
  if (page > 1) query.set("comisionesPage", String(page));
  if (state.status === "loading") return <p role="status">Cargando comisiones…</p>;
  if (state.status === "error") return <Notice tone="error">Lo sentimos. No pudimos recuperar las comisiones. Intentá nuevamente. <button className="button" type="button" onClick={retry}>Reintentar comisiones</button></Notice>;
  return <>
    <p className={styles.summary}>{state.data.total === 1 ? "1 comisión" : `${state.data.total} comisiones`} · {periodoLabel(cursada.anio)}</p>
    {state.data.items.length ? <ul className={cardStyles.grid}>{state.data.items.map((comision) => <li key={comision.id} className={`${cardStyles.card}${!comision.activa ? ` ${cardStyles.inactive}` : ""}`}>
      <div className={cardStyles.cardHead}>
        <span className={cardStyles.letter} aria-hidden="true">{comision.carrera}</span>
        <div className={cardStyles.cardTitle}><Link href={`/home/materias/${encodeURIComponent(materiaId)}/cursadas/${encodeURIComponent(cursada.id)}/comisiones/${encodeURIComponent(comision.id)}?${query}`}>Comisión {comision.nombre}</Link><span className={cardStyles.carrera}>{carreraShortLabel(comision.carrera)}</span></div>
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
      </div>
      {comision.profesores.length ? <ul className={cardStyles.profesores}>{comision.profesores.map((profesor) => <li key={profesor.id}>{profesor.nombreCompleto} <span className={cardStyles.carrera}>· {cargoLabel(profesor.cargo)}</span></li>)}</ul> : <p className={cardStyles.sinProfesores}>Sin profesores asignados</p>}
      {!comision.activa ? <span className={styles.summary}>Inactiva</span> : null}
    </li>)}</ul> : state.data.total ? <p>No hay comisiones en esta página. <button className="button button-secondary" type="button" onClick={() => onPageChange(1)}>Volver a la primera página</button></p> : <p>Esta cursada todavía no tiene comisiones cargadas.</p>}
    <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={onPageChange} />
  </>;
}
