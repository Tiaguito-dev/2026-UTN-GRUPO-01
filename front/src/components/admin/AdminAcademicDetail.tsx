"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, CalendarDays, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { obtenerDetalleAdministrativo } from "@/services/admin-detail";
import { cursadaDetalleSchema, materiaSchema, profesorSchema } from "@/services/schemas";
import type { Materia } from "@/types/materias";
import { type CursadaDetalle, type Profesor } from "@/services/academic";
import { adminReturnTo } from "@/lib/navigation";
import { periodoLabel } from "@/lib/format/periodo";
import { carreraLabel } from "@/lib/format/carrera";
import { adminFormHref, safeAdminReturnTo, safeMateriaListOrigin } from "@/validations/admin";
import { academicListReturnTo, comisionesListHref, cursadasListHref, materiaDetailBack, materiaDetailHref } from "@/validations/admin-academic-navigation";
import { anioCarreraLabel, nivelElectivaLabel } from "@/validations/materias";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { AdminAudit } from "./AdminAudit";
import { AcademicDeleteAction, AcademicDeleteDialog } from "./AcademicDeleteAction";
import { AdminSharedAudit } from "./AdminSharedAudit";
import styles from "./AdminAcademicDetail.module.css";
import materiaStyles from "./AdminMateriaDetail.module.css";

async function loadMateria(id: string) { return materiaSchema.parse((await obtenerDetalleAdministrativo("materias", id)).registro); }
async function loadProfesor(id: string) { return profesorSchema.parse((await obtenerDetalleAdministrativo("profesores", id)).registro); }
async function loadCursada(id: string) { const { registro } = await obtenerDetalleAdministrativo("cursadas", id); return { ...cursadaDetalleSchema.parse(registro), deletedAt: typeof registro.deletedAt === "string" ? registro.deletedAt : null }; }

function DetailPage({ title, section, back, listHref, breadcrumb, children }: { title: string; section: "materias" | "profesores" | "cursadas"; back: string; listHref?: string; breadcrumb?: { label: string; href?: string }[]; children: ReactNode }) {
  const headingId = useId();
  const params = useSearchParams();
  const labels = { materias: "Materias", profesores: "Profesores", cursadas: "Cursadas" };
  return <section className={styles.page} aria-labelledby={headingId}>
    <PageHeader id={headingId} title={title} back={{ href: back, label: "contexto administrativo" }} breadcrumb={breadcrumb ?? [{ label: "Administración", href: "/home/admin" }, { label: labels[section], href: listHref ?? `/home/admin/${section}` }, { label: title }]} />
    {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
    {children}
  </section>;
}

function LoadState({ error, retry }: { error: string; retry: () => void }) {
  return error ? <Notice tone="error">Lo sentimos. No pudimos recuperar la información. {error} <button className="button button-secondary" type="button" onClick={retry}>Reintentar</button></Notice> : <p role="status">Cargando registro…</p>;
}

function useAdminResource<T>(id: string, load: (id: string) => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: T; error?: string }>();
  const key = `${id}:${attempt}`;
  useEffect(() => {
    let active = true;
    load(id).then((data) => { if (active) setResult({ key, data }); }, () => {
      if (active) setResult({ key, error: "Intentá nuevamente." });
    });
    return () => { active = false; };
  }, [id, key, load]);
  const current = result?.key === key ? result : undefined;
  return { data: current?.data, error: current?.error ?? "", retry: () => setAttempt((value) => value + 1) };
}

export function AdminMateriaDetail({ materiaId }: { materiaId: string }) {
  const headingId = useId();
  const informationId = useId();
  const careersId = useId();
  const isAdmin = useIsAdmin();
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [auditVersion, setAuditVersion] = useState(0);
  const params = useSearchParams();
  const back = materiaDetailBack(params.get("returnTo")) ?? "/home/admin/materias";
  const materiaReturnTo = safeMateriaListOrigin(back) ?? "/home/admin/materias";
  const { data: materia, error, retry } = useAdminResource<Materia>(materiaId, loadMateria);
  const title = materia ? materia.nombre.trim() || "No registrado" : "Materia";
  const canManage = isAdmin && materia && !materia.deletedAt;
  const cuatrimestre = materia?.modalidad === "PRIMERO" ? "Primer cuatrimestre" : materia?.modalidad === "SEGUNDO" ? "Segundo cuatrimestre" : null;
  return <section className={materiaStyles.page} aria-labelledby={headingId}>
    <header className={materiaStyles.header}>
      <PageHeader id={headingId} title={title} eyebrow="Detalle de materia" description="Datos académicos y períodos de cursada" back={{ href: back, label: "contexto administrativo" }} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Materias", href: materiaReturnTo }, { label: title }]} />
      {canManage ? <div className={materiaStyles.actions}>
        <Link className={`button button-secondary ${materiaStyles.edit}`} href={adminFormHref(`/home/admin/materias/${encodeURIComponent(materiaId)}/editar`, safeAdminReturnTo(back) ?? "/home/admin/materias")}><Pencil size={17} aria-hidden="true" />Editar materia</Link>
        <button className={`button button-secondary ${materiaStyles.remove}`} type="button" aria-label={`Dar de baja materia ${materia.nombre}`} onClick={() => setConfirmDelete(true)}><Trash2 size={17} aria-hidden="true" />Dar de baja</button>
      </div> : null}
    </header>
    {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}
    {!materia ? <LoadState error={error} retry={retry} /> : <>
      <section className={materiaStyles.card} aria-labelledby={informationId}>
        <div className={materiaStyles.cardBody}>
          <h2 id={informationId}><BookOpen size={20} aria-hidden="true" />Información académica</h2>
          <dl className={materiaStyles.data}>
            <div><dt>Modalidad</dt><dd className={!materia.modalidad ? materiaStyles.missing : undefined}>{materia.modalidad === "ANUAL" ? "Anual" : cuatrimestre ? "Cuatrimestral" : "No registrado"}</dd></div>
            {cuatrimestre ? <div><dt>Cuatrimestre</dt><dd>{cuatrimestre}</dd></div> : null}
            <div><dt>Estado</dt><dd><span className={`${materiaStyles.status} ${materia.deletedAt ? materiaStyles.inactive : materiaStyles.active}`}>{materia.deletedAt ? "Inactiva" : "Activa"}</span></dd></div>
          </dl>
          <section className={materiaStyles.careers} aria-labelledby={careersId}>
            <h3 id={careersId}>Carreras y año</h3>
            {materia.carreras.length ? <dl className={materiaStyles.associations}>{materia.carreras.map((row) => <div key={row.carrera}><dt>{carreraLabel(row.carrera)}</dt><dd>{anioCarreraLabel(row.anioCarrera)}{row.nivelElectiva ? ` · ${nivelElectivaLabel(row.nivelElectiva)}` : ""}</dd></div>)}</dl> : <p className={materiaStyles.missing}>No hay carreras asociadas.</p>}
          </section>
        </div>
        <footer className={materiaStyles.footer}><p>Consultá los períodos de cursada de esta materia</p><Link className={`button button-secondary ${materiaStyles.periods}`} href={cursadasListHref(materiaId, materiaReturnTo)}><CalendarDays size={18} aria-hidden="true" />Ver cursadas<ChevronRight size={17} aria-hidden="true" /></Link></footer>
      </section>
      <AdminSharedAudit key={`${materiaId}:${auditVersion}`} kind="materias" id={materiaId} />
    </>}
    {canManage && confirmDelete ? <AcademicDeleteDialog kind="materias" id={materiaId} label={materia.nombre} onClose={() => setConfirmDelete(false)} onAttempt={() => setAuditVersion(value => value + 1)} onSuccess={() => { setConfirmDelete(false); setMessage("La materia se dio de baja correctamente."); setAuditVersion(value => value + 1); retry(); }} /> : null}
  </section>;
}

export function AdminProfesorDetail({ profesorId }: { profesorId: string }) {
  const [message, setMessage] = useState("");
  const [auditVersion, setAuditVersion] = useState(0);
  const params = useSearchParams();
  const back = adminReturnTo(params.get("returnTo"), "/home/admin/profesores");
  const { data: profesor, error, retry } = useAdminResource<Profesor>(profesorId, loadProfesor);
  return <DetailPage title={profesor?.nombreCompleto ?? "Profesor"} section="profesores" back={back}>
    {message ? <Notice tone="success">{message}</Notice> : null}
    {!profesor ? <LoadState error={error} retry={retry} /> : <div className={styles.surface}>
      <dl className={styles.data}><div><dt>Nombre completo</dt><dd>{profesor.nombreCompleto}</dd></div><div><dt>Estado</dt><dd>{profesor.deletedAt ? "Inactivo" : "Activo"}</dd></div></dl>
      {!profesor.deletedAt ? <div className={styles.actions}><Link className="button button-secondary" href={adminFormHref(`/home/admin/profesores/${encodeURIComponent(profesorId)}/editar`, safeAdminReturnTo(back) ?? "/home/admin/profesores")}>Editar profesor</Link><AcademicDeleteAction kind="profesores" id={profesorId} label={profesor.nombreCompleto} onAttempt={() => setAuditVersion(value => value + 1)} onSuccess={() => { setMessage("El profesor se dio de baja correctamente."); setAuditVersion(value => value + 1); retry(); }} /></div> : null}
    </div>}
    {profesor ? <AdminAudit key={`${profesorId}:${auditVersion}`} kind="profesores" id={profesorId} /> : null}
  </DetailPage>;
}

export function AdminCursadaDetail({ cursadaId }: { cursadaId: string }) {
  const [message, setMessage] = useState("");
  const [auditVersion, setAuditVersion] = useState(0);
  const params = useSearchParams();
  const { data: cursada, error, retry } = useAdminResource<CursadaDetalle & { deletedAt: string | null }>(cursadaId, loadCursada);
  const query = new URLSearchParams(params.toString());
  const rawList = safeAdminReturnTo(params.get("returnTo"));
  const rawOrigin = rawList ? new URL(rawList, "https://local.invalid").searchParams.get("materiaReturnTo") : null;
  const materiaReturnTo = safeMateriaListOrigin(rawOrigin) ?? "/home/admin/materias";
  const fallback = cursadasListHref(cursada?.materia.id ?? query.get("materiaId") ?? "", materiaReturnTo);
  const back = (cursada && academicListReturnTo(params.get("returnTo"), "cursadas", cursada.materia.id)) || fallback;
  const materiaHref = cursada ? materiaDetailHref(cursada.materia.id, materiaReturnTo) : materiaDetailHref(query.get("materiaId") ?? "", materiaReturnTo);
  const commissionsHref = cursada ? comisionesListHref(cursada.materia.id, cursadaId, materiaReturnTo) : fallback;
  const commissionsWithReturn = cursada ? `${commissionsHref}&returnTo=${encodeURIComponent(`/home/admin/cursadas/${encodeURIComponent(cursadaId)}?${new URLSearchParams({ returnTo: back })}`)}` : commissionsHref;
  const title = cursada ? `Cursada ${periodoLabel(cursada.anio, cursada.cuatrimestre)}` : "Cursada";
  const breadcrumb = cursada ? [{ label: "Administración", href: "/home/admin" }, { label: "Materias", href: materiaReturnTo }, { label: cursada.materia.nombre, href: materiaHref }, { label: "Cursadas", href: fallback }, { label: title }] : undefined;
  return <DetailPage title={title} section="cursadas" back={back} listHref={fallback} breadcrumb={breadcrumb}>
    {message ? <Notice tone="success">{message}</Notice> : null}
    {!cursada ? <LoadState error={error} retry={retry} /> : <div className={styles.surface}>
      <dl className={styles.data}><div><dt>Materia</dt><dd><Link href={materiaHref}>{cursada.materia.nombre}</Link></dd></div><div><dt>Período</dt><dd>{periodoLabel(cursada.anio, cursada.cuatrimestre)}</dd></div><div><dt>Estado</dt><dd>{cursada.deletedAt ? "Inactiva" : "Activa"}</dd></div></dl>
      <div className={styles.actions}><Link className="button button-secondary" href={commissionsWithReturn}>Ver comisiones</Link>{!cursada.deletedAt ? <><Link className="button button-secondary" href={adminFormHref(`/home/admin/cursadas/${encodeURIComponent(cursadaId)}/editar`, back)}>Editar cursada</Link><AcademicDeleteAction kind="cursadas" id={cursadaId} label={`${periodoLabel(cursada.anio, cursada.cuatrimestre)} de ${cursada.materia.nombre}`} onAttempt={() => setAuditVersion(value => value + 1)} onSuccess={() => { setMessage("El período se dio de baja correctamente."); setAuditVersion(value => value + 1); retry(); }} /></> : null}</div>
    </div>}
    {cursada ? <AdminAudit key={`${cursadaId}:${auditVersion}`} kind="cursadas" id={cursadaId} /> : null}
  </DetailPage>;
}
