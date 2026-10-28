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
import { cargoLabel, carreraLabel, isCarrera, parseMateriaPage } from "@/validations/materias";
import type { Carrera, MateriaCarrera } from "@/types/materias";
import { CursadasList } from "./CursadasList";
import styles from "./ComisionesMateria.module.css";
import { feedbackOriginParams } from "@/validations/feedback";

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
export function ComisionesMateria({ materiaId, materiaNombre, carreras, materiasHref = "/home/materias" }: { materiaId: string; materiaNombre: string; carreras: MateriaCarrera[]; materiasHref?: string }) {
  const headingId = useId();
  const selectorId = useId();
  const carreraId = useId();
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
  const selected = selectedId ? requested : periods?.items[0];
  const page = parseMateriaPage(params.get("comisionesPage"));
  const careerOptions = [...new Set(carreras.map((row) => row.carrera))];
  const career = careerOptions.length === 1 ? careerOptions[0] : careerOptions.find((value) => value === params.get("carrera"));
  const context = feedbackOriginParams(params);
  for (const name of ["cursadaId", "comisionesPage", "page"]) context.delete(name);
  for (const name of ["carrera", "anioCarrera", "listadoPage", "q", "nivelElectiva"]) {
    const value = params.get(name);
    if (value) context.set(name, value);
  }
  if (career) context.set("carrera", career);
  else context.delete("carrera");
  const contextQuery = context.toString();

  useEffect(() => {
    let active = true;
    loadPeriods(materiaId).then(
      (items) => { if (active) setResource({ key, items, error: "" }); },
      () => { if (active) setResource({ key, items: [], error: "Lo sentimos. No pudimos recuperar las cursadas. Intentá nuevamente." }); },
    );
    return () => { active = false; };
  }, [materiaId, key]);

  function navigate(nextCareer: Carrera | undefined, cursadaId: string | undefined, nextPage = 1) {
    const query = new URLSearchParams(contextQuery);
    if (nextCareer) query.set("carrera", nextCareer);
    else query.delete("carrera");
    if (cursadaId) query.set("cursadaId", cursadaId);
    if (nextPage > 1) query.set("comisionesPage", String(nextPage));
    router.replace(`/home/materias/${encodeURIComponent(materiaId)}?${query}`, { scroll: false });
  }

  return <section className={styles.module} aria-labelledby={headingId}>
    <div className={styles.header}><div><h2 id={headingId}>Comisiones</h2><p>Elegí una comisión para consultar y compartir experiencias. La cursada identifica el año y el período.</p></div>
      {isAdmin && selected ? <Link className="button" href={`/home/admin/comisiones/nueva?cursadaId=${encodeURIComponent(selected.id)}`}>Nueva comisión</Link> : null}
    </div>
    <div className={styles.filters}>
      <div className={styles.filter}>
        {careerOptions.length === 1 ? <><span className={styles.label}>Carrera</span><p className={styles.fixedCareer}>{carreraLabel(career)}</p></> : <>
          <label htmlFor={carreraId}>Carrera</label>
          <div className={styles.selectControl}><select id={carreraId} value={career ?? ""} disabled={!careerOptions.length} onChange={(event) => navigate(isCarrera(event.target.value) ? event.target.value : undefined, selectedId ?? selected?.id)}>
            <option value="">Seleccioná una carrera</option>{careerOptions.map((value) => <option key={value} value={value}>{carreraLabel(value)}</option>)}
          </select><ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" /></div>
        </>}
      </div>
      <div className={styles.filter}><label htmlFor={selectorId}><CalendarDays size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />Año de cursada</label>
        <div className={styles.selectControl}><select id={selectorId} value={selected?.id ?? selectedId ?? ""} disabled={!periods || Boolean(periods.error) || !periods.items.length} onChange={(event) => navigate(career, event.target.value)}>
          {!periods?.items.length ? <option value="">{!periods ? "Cargando…" : "Sin cursadas disponibles"}</option> : null}
          {periods?.items.length && selectedId && !requested ? <option value={selectedId}>Cursada no disponible</option> : null}
          {periods?.items.map((period) => <option key={period.id} value={period.id}>{periodoLabel(period.anio, period.cuatrimestre)}</option>)}
        </select><ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" /></div>
      </div>
    </div>
    {!periods ? <p role="status">Cargando cursadas…</p> : periods.error ? <Notice tone="error">{periods.error} <button className="button" type="button" onClick={() => setRevision((value) => value + 1)}>Reintentar cursadas</button></Notice>
      : selectedId && !requested ? <p>La cursada solicitada no está disponible. Elegí otro año de cursada.</p>
        : !periods.items.length ? <p>Esta materia todavía no tiene cursadas cargadas.</p>
          : !career ? <p>{careerOptions.length ? "Seleccioná una carrera para ver sus comisiones" : "Esta materia no tiene carreras asociadas."}</p>
            : selected ? <ComisionesPeriodo key={`${selected.id}:${career}`} materiaId={materiaId} carrera={career} cursada={selected} page={page} contextQuery={contextQuery} onPageChange={(next) => navigate(career, selected.id, next)} /> : null}
    {isAdmin ? <details className={styles.management} onToggle={(event) => setManageOpen(event.currentTarget.open)}><summary>Gestionar períodos</summary>{manageOpen ? <div><CursadasList materiaId={materiaId} materiaNombre={materiaNombre} materiasHref={materiasHref} embedded onCreated={() => setRevision((value) => value + 1)} /></div> : null}</details> : null}
  </section>;
}

function ComisionesPeriodo({ materiaId, carrera, cursada, page, contextQuery, onPageChange }: { materiaId: string; carrera: Carrera; cursada: CursadaResumen; page: number; contextQuery: string; onPageChange: (page: number) => void }) {
  const { state, retry } = usePaginatedFetch(`comisiones-materia:${cursada.id}:${carrera}`, (next) => listarComisionesPorCursada(cursada.id, { page: next, pageSize: 9, carrera }), page);
  const query = new URLSearchParams(contextQuery);
  query.set("cursadaId", cursada.id);
  if (page > 1) query.set("comisionesPage", String(page));
  if (state.status === "loading") return <p role="status">Cargando comisiones…</p>;
  if (state.status === "error") return <Notice tone="error">Lo sentimos. No pudimos recuperar las comisiones. Intentá nuevamente. <button className="button" type="button" onClick={retry}>Reintentar comisiones</button></Notice>;
  return <>
    <p className={styles.summary}>{state.data.total === 1 ? "1 comisión" : `${state.data.total} comisiones`} · {periodoLabel(cursada.anio, cursada.cuatrimestre)}</p>
    {state.data.items.length ? <ul className={styles.grid}>{state.data.items.map((comision) => <li key={comision.id}>
      <Link className={`${styles.commissionCard}${!comision.activa ? ` ${styles.inactive}` : ""}`} href={`/home/materias/${encodeURIComponent(materiaId)}/cursadas/${encodeURIComponent(cursada.id)}/comisiones/${encodeURIComponent(comision.id)}?${query}`}>
      <div className={styles.cardHead}>
        <div><strong className={styles.code}>Comisión {comision.carrera}{comision.numero}</strong><span className={styles.careerName}>{carreraLabel(comision.carrera)}</span></div>
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />
      </div>
      {comision.profesores.length ? <ul className={styles.teachers}>{comision.profesores.map((profesor) => <li key={profesor.id}>{profesor.nombreCompleto} <span className={styles.teacherRole}>· {cargoLabel(profesor.cargo)}</span></li>)}</ul> : <p className={styles.noTeachers}>Sin docentes asignados</p>}
      {!comision.activa ? <span className={styles.summary}>Inactiva</span> : null}
      </Link>
    </li>)}</ul> : state.data.total ? <p>No hay comisiones en esta página. <button className="button button-secondary" type="button" onClick={() => onPageChange(1)}>Volver a la primera página</button></p> : <p>No hay comisiones para esta carrera y año de cursada. Podés cambiar los filtros.</p>}
    <Pagination page={page} pageSize={state.data.pageSize} total={state.data.total} onChange={onPageChange} />
  </>;
}
