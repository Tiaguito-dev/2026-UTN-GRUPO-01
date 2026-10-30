"use client";

import Link from "next/link";
import { CalendarDays, ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { listarComisionesPorCursada, obtenerComision, type Comision, type ComisionDetalle } from "@/services/academic";
import { obtenerMateria } from "@/services/materias";
import { obtenerDetalleAdministrativo } from "@/services/admin-detail";
import { comisionDetalleSchema } from "@/services/schemas";
import type { Materia } from "@/types/materias";
import type { PaginatedResult } from "@/services/pagination";
import { HttpError } from "@/services/http";
import { anioCarreraLabel, cargoLabel, carreraLabel, isAnioCarrera, isCarrera, materiaDetailHref as publicMateriaDetailHref, materiaListHref, modalidadLabel, parseMateriaContext, parseMateriaPage } from "@/validations/materias";
import { PageHeader } from "@/components/ui/PageHeader";
import { ComisionFeedback } from "@/components/feedback/ComisionFeedback";
import { Notice } from "@/components/ui/Notice";
import { periodoLabel } from "@/lib/format/periodo";
import { iniciales } from "./detalle";
import { DocentesComision } from "./DocentesComision";
import styles from "./ComisionDetail.module.css";
import { experienciasBack, feedbackOriginParams } from "@/validations/feedback";
import { adminFormHref } from "@/validations/admin";
import { comisionNavigation } from "@/validations/admin-academic-navigation";
import { AdminAudit } from "@/components/admin/AdminAudit";
import { AcademicDeleteAction } from "@/components/admin/AcademicDeleteAction";

interface Resource<T> { key: string; data: T | null; error: string }

async function loadOptions<T>(fetchPage: (page: number) => Promise<PaginatedResult<T>>): Promise<T[]> {
  const first = await fetchPage(1);
  const items = [...first.items];
  const pageCount = Math.ceil(first.total / first.pageSize);
  for (let page = 2; page <= pageCount; page += 1) {
    const next = await fetchPage(page);
    items.push(...next.items);
  }
  return items;
}

export function ComisionDetail({ materiaId = "", cursadaId = "", comisionId, administrative = false }: { materiaId?: string; cursadaId?: string; comisionId: string; administrative?: boolean }) {
  const headingId = useId();
  const selectorId = useId();
  const isAdmin = useIsAdmin();
  const router = useRouter();
  const params = useSearchParams();
  const rawCarrera = params.get("carrera");
  const carrera = isCarrera(rawCarrera) ? rawCarrera : undefined;
  const rawAnio = params.get("anioCarrera");
  const anio = isAnioCarrera(rawAnio) ? rawAnio : undefined;
  const listadoPage = parseMateriaPage(params.get("listadoPage"));
  const context = parseMateriaContext(params);
  const [detail, setDetail] = useState<(Resource<ComisionDetalle> & { notFound: boolean }) | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [auditVersion, setAuditVersion] = useState(0);
  const [deleteMessage, setDeleteMessage] = useState("");
  const current = detail?.key === comisionId ? detail : null;
  const comision = current?.data ?? null;
  const error = current?.error ?? "";
  const realMateriaId = comision?.cursada.materia.id ?? materiaId;
  const realCursadaId = comision?.cursada.id ?? cursadaId;
  const [materiaResult, setMateriaResult] = useState<Resource<Materia> | null>(null);
  const [materiaRetry, setMateriaRetry] = useState(0);
  const materiaKey = `${comision?.cursada.materia.id ?? ""}:${materiaRetry}`;
  const materia = materiaResult?.key === materiaKey ? materiaResult : null;
  const [optionsResult, setOptionsResult] = useState<Resource<Comision[]> | null>(null);
  const [optionsRetry, setOptionsRetry] = useState(0);
  const optionsKey = `${comision?.cursada.id ?? ""}:${optionsRetry}`;
  const options = optionsResult?.key === optionsKey ? optionsResult : null;
  useEffect(() => {
    let active = true;
    (administrative ? obtenerDetalleAdministrativo("comisiones", comisionId).then((result) => comisionDetalleSchema.parse(result.registro)) : obtenerComision(comisionId)).then((data) => {
      if (active) setDetail({ key: comisionId, data, error: "", notFound: false });
    }).catch((failure: unknown) => {
      if (active) setDetail({ key: comisionId, data: null, error: failure instanceof Error ? failure.message : "Intentá nuevamente.", notFound: failure instanceof HttpError && failure.status === 404 });
    });
    return () => { active = false; };
  }, [comisionId, retryToken, administrative]);

  const actualMateriaId = comision?.cursada.materia.id;
  useEffect(() => {
    if (!actualMateriaId) return;
    let active = true;
    obtenerMateria(actualMateriaId).then((data) => {
      if (active) setMateriaResult({ key: materiaKey, data, error: "" });
    }).catch(() => {
      if (active) setMateriaResult({ key: materiaKey, data: null, error: "No pudimos recuperar el año de la materia." });
    });
    return () => { active = false; };
  }, [actualMateriaId, materiaKey]);

  const actualCursadaId = comision?.cursada.id;
  useEffect(() => {
    if (!actualCursadaId) return;
    let active = true;
    loadOptions((page) => listarComisionesPorCursada(actualCursadaId, { page, pageSize: 100 })).then((data) => {
      if (active) setOptionsResult({ key: optionsKey, data, error: "" });
    }).catch(() => {
      if (active) setOptionsResult({ key: optionsKey, data: null, error: "Lo sentimos. No pudimos recuperar las comisiones, intentá nuevamente." });
    });
    return () => { active = false; };
  }, [actualCursadaId, optionsKey]);

  const materiasHref = materiaListHref(carrera, anio, listadoPage, context);
  const materiaBaseHref = publicMateriaDetailHref(realMateriaId, carrera, anio, listadoPage, context);
  const comisionesPage = parseMateriaPage(params.get("comisionesPage"));
  const returnQuery = new URLSearchParams(materiaBaseHref.split("?")[1]);
  returnQuery.set("cursadaId", realCursadaId);
  if (comisionesPage > 1) returnQuery.set("comisionesPage", String(comisionesPage));
  const adminNavigation = comisionNavigation(params.get("returnTo"), comision);
  const adminBack = adminNavigation.back;
  const adminContext = new URLSearchParams({ returnTo: adminBack });
  const adminDetailUrl = new URL(adminNavigation.detailHref, "https://local.invalid");
  const commentPage = parseMateriaPage(params.get("page"));
  if (commentPage > 1) adminDetailUrl.searchParams.set("page", String(commentPage));
  const adminDetailHref = `${adminDetailUrl.pathname}?${adminDetailUrl.searchParams}`;
  const materiaHref = administrative ? adminNavigation.materiaHref : `${materiaBaseHref.split("?")[0]}?${returnQuery}`;
  const contextQuery = feedbackOriginParams(params);
  if (carrera) contextQuery.set("carrera", carrera);
  if (anio) contextQuery.set("anioCarrera", anio);
  if (listadoPage > 1) contextQuery.set("listadoPage", String(listadoPage));
  if (context.q) contextQuery.set("q", context.q);
  if (context.nivelElectiva) contextQuery.set("nivelElectiva", context.nivelElectiva);
  if (comisionesPage > 1) contextQuery.set("comisionesPage", String(comisionesPage));
  const queryString = contextQuery.size ? `?${contextQuery}` : "";
  const back = <Link href={materiaHref}>Volver a las comisiones de la materia</Link>;

  const materiaLabel = comision?.cursada.materia.nombre ?? (error ? "Materia" : "Cargando…");
  const classification = materia?.data?.carreras.find((item) => item.carrera === comision?.carrera);
  const eyebrow = comision ? `${carreraLabel(comision.carrera)}${classification ? ` · ${anioCarreraLabel(classification.anioCarrera)}` : ""}` : undefined;

  return <section className={styles.page} aria-labelledby={headingId}>
    <div className={styles.header}>
      <PageHeader id={headingId} title={materiaLabel} eyebrow={eyebrow} back={administrative ? { href: adminBack, label: "contexto administrativo" } : experienciasBack(params) ?? { href: materiaHref, label: "Comisiones de la materia" }}
        breadcrumb={administrative ? adminNavigation.breadcrumb : [{ label: "Materias", href: materiasHref }, { label: comision?.cursada.materia.nombre ?? "Materia", href: materiaHref }, { label: comision ? `Comisión ${comision.nombre}` : "Comisión" }]} focusKey={comisionId} />
      {administrative && isAdmin && comision && !comision.deletedAt ? <><Link className="button button-secondary" href={adminFormHref(`/home/admin/comisiones/${encodeURIComponent(comision.id)}/editar`, adminDetailHref)}>Editar comisión</Link><AcademicDeleteAction kind="comisiones" id={comision.id} label={`${comision.nombre} de ${comision.cursada.materia.nombre} (${periodoLabel(comision.cursada.anio, comision.cursada.cuatrimestre)})`} onAttempt={() => setAuditVersion(value => value + 1)} onSuccess={() => { setDeleteMessage("La comisión se dio de baja correctamente."); setRetryToken(value => value + 1); setAuditVersion(value => value + 1); setOptionsRetry(value => value + 1); }} /></> : null}
      {comision ? <div className={styles.contextRow}>
        <div className={styles.context}>
          <span className={styles.commissionLabel}>Comisión {comision.nombre}</span>
          <span className={styles.period}><CalendarDays size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" />{periodoLabel(comision.cursada.anio)}</span>
          <span>{modalidadLabel(comision.cursada.cuatrimestre !== undefined ? comision.cursada.cuatrimestre : materia?.data?.modalidad ?? comision.cursada.materia.modalidad)}</span>
          {isAdmin ? <span className={styles.secondary}>{comision.activa ? "Activa" : "Inactiva"}</span> : null}
        </div>
        {!options ? <p className={styles.secondary} role="status">Cargando comisiones…</p>
          : options.error ? <p className={styles.secondary}>{options.error} <button className={styles.retry} type="button" onClick={() => setOptionsRetry((value) => value + 1)}>Reintentar comisiones</button></p>
          : (options.data?.length ?? 0) > 1 ? <div className={styles.selector}>
            <label htmlFor={selectorId}>Comisión del período</label>
            <div className={styles.selectorControl}><select id={selectorId} value={comision.id} onChange={(event) => { if (event.target.value !== comision.id) router.push(administrative ? `/home/admin/comisiones/${encodeURIComponent(event.target.value)}?${adminContext}` : `/home/materias/${encodeURIComponent(realMateriaId)}/cursadas/${encodeURIComponent(realCursadaId)}/comisiones/${encodeURIComponent(event.target.value)}${queryString}`); }}>
              {!options.data?.some((item) => item.id === comision.id) ? <option value={comision.id}>Comisión {comision.nombre} (actual)</option> : null}
              {options.data?.map((item) => <option key={item.id} value={item.id}>Comisión {item.nombre}{item.id === comision.id ? " (actual)" : ""}{!item.activa ? " · Inactiva" : ""}</option>)}
            </select><ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" focusable="false" /></div>
          </div> : <p className={styles.secondary}>{options.data?.length === 1 ? "Esta es la única comisión de este período." : "No hay otras comisiones disponibles en este período."}</p>}
      </div> : null}
      {comision && materia?.error ? <div className={styles.secondary} role="note"><span>{materia.error}</span> <button className={styles.retry} type="button" onClick={() => setMateriaRetry((value) => value + 1)}>Reintentar datos de materia</button></div> : null}
    </div>
    {deleteMessage ? <Notice tone="success">{deleteMessage}</Notice> : null}
    {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
    {error ? <Notice tone="error">Lo sentimos. No pudimos recuperar la comisión. {error} {current?.notFound ? back : <button className="button" type="button" onClick={() => setRetryToken((value) => value + 1)}>Reintentar</button>}</Notice> : null}
    {!comision && !error ? <p role="status">Cargando comisión…</p> : null}
    {comision ? <div className={styles.content}>
      <div className={styles.main}><ComisionFeedback comision={comision} administrative={administrative} /></div>
        <section className={styles.team} aria-labelledby={`${headingId}-equipo`}>
          <h2 id={`${headingId}-equipo`}>Equipo docente</h2>
          {comision.profesores.length === 0 ? <p className={styles.secondary}>No hay profesores asignados a esta comisión.</p> : <ul className={styles.teamList}>
            {comision.profesores.map((profesor) => <li key={profesor.id} className={styles.person}>
              <span className={styles.avatar} aria-hidden="true">{iniciales(profesor.nombreCompleto)}</span>
              <div className={styles.personText}>{administrative ? <Link className={styles.personName} href={`/home/admin/profesores/${encodeURIComponent(profesor.id)}?${new URLSearchParams({ returnTo: adminDetailHref })}`}>{profesor.nombreCompleto}</Link> : <span className={styles.personName}>{profesor.nombreCompleto}</span>}<span className={styles.personRole}>{cargoLabel(profesor.cargo)}</span></div>
            </li>)}
          </ul>}
          {isAdmin && !comision.deletedAt ? <>
            <DocentesComision key={comision.id} comisionId={comision.id} profesores={comision.profesores} gestionSolo readOnly={Boolean(comision.deletedAt)} onChange={(profesores) => {
              setDetail((current) => current?.key === comisionId && current.data ? { ...current, data: { ...current.data, profesores } } : current);
              setRetryToken((value) => value + 1);
              setAuditVersion((value) => value + 1);
              setOptionsRetry((value) => value + 1);
            }} />
            <div className={styles.adminData}><h3>Datos de la comisión</h3><dl>
              <div><dt>Estado</dt><dd>{comision.activa ? "Activa" : "Inactiva"}</dd></div>
              <div><dt>Fecha de alta</dt><dd>{new Date(comision.createdAt).toLocaleString("es-AR")}</dd></div>
            </dl><p className={styles.secondary}>Quitar una asignación sólo desvincula al docente de esta comisión; no da de baja al profesor. Dar de baja la comisión conserva las asignaciones y las experiencias registradas.</p></div>
          </> : null}
        </section>
    </div> : null}
    {administrative && comision ? <AdminAudit key={`${comisionId}:${auditVersion}`} kind="comisiones" id={comisionId} /> : null}
  </section>;
}
