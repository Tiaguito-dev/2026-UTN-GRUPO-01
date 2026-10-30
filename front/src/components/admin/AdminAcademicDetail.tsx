"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, CalendarDays, ChevronRight, Pencil, Trash2, Users } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { obtenerDetalleAdministrativo } from "@/services/admin-detail";
import { cursadaDetalleSchema, materiaSchema, profesorSchema } from "@/services/schemas";
import type { Materia } from "@/types/materias";
import { type CursadaDetalle, type Profesor } from "@/services/academic";
import { periodoLabel } from "@/lib/format/periodo";
import { carreraLabel } from "@/lib/format/carrera";
import { adminFormHref, safeAdminReturnTo, safeMateriaListOrigin } from "@/validations/admin";
import { academicListReturnTo, comisionesListHref, cursadasListHref, materiaDetailBack, materiaDetailHref } from "@/validations/admin-academic-navigation";
import { anioCarreraLabel, nivelElectivaLabel } from "@/validations/materias";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { AcademicDeleteDialog } from "./AcademicDeleteAction";
import { AdminSharedAudit } from "./AdminSharedAudit";
import materiaStyles from "./AdminMateriaDetail.module.css";
import profesorStyles from "./AdminProfesorDetail.module.css";

async function loadMateria(id: string) { return materiaSchema.parse((await obtenerDetalleAdministrativo("materias", id)).registro); }
async function loadProfesor(id: string) { return profesorSchema.parse((await obtenerDetalleAdministrativo("profesores", id)).registro); }
async function loadCursada(id: string) { const { registro } = await obtenerDetalleAdministrativo("cursadas", id); return { ...cursadaDetalleSchema.parse(registro), deletedAt: typeof registro.deletedAt === "string" ? registro.deletedAt : null }; }

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
  const headingId = useId();
  const isAdmin = useIsAdmin();
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [auditVersion, setAuditVersion] = useState(0);
  const params = useSearchParams();
  const origin = safeAdminReturnTo(params.get("returnTo"));
  const back = origin && new URL(origin, "https://local.invalid").pathname === "/home/admin/profesores" ? origin : "/home/admin/profesores";
  const { data: profesor, error, retry } = useAdminResource<Profesor>(profesorId, loadProfesor);
  const name = profesor?.nombreCompleto.trim() || "";
  const title = profesor ? name || "No registrado" : "Profesor";
  const parts = name ? name.split(/\s+/u) : [];
  const initials = (parts.length > 1 ? [parts[0]!, parts[parts.length - 1]!] : parts).map(part => Array.from(part)[0]).join("").toLocaleUpperCase("es-AR");
  const canManage = isAdmin && profesor && !profesor.deletedAt;
  return <section className={materiaStyles.page} aria-labelledby={headingId}>
    <header className={materiaStyles.header}>
      <PageHeader id={headingId} title={title} eyebrow="Detalle de profesor" description="Registro del catálogo de profesores" back={{ href: back, label: "listado de profesores" }} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Profesores", href: back }, { label: title }]} focusKey={profesorId} />
      {canManage ? <div className={materiaStyles.actions}>
        <Link className={`button button-secondary ${materiaStyles.edit}`} href={adminFormHref(`/home/admin/profesores/${encodeURIComponent(profesorId)}/editar`, back)}><Pencil size={17} aria-hidden="true" />Editar profesor</Link>
        <button className={`button button-secondary ${materiaStyles.remove}`} type="button" aria-label={`Dar de baja profesor ${title}`} onClick={() => setConfirmDelete(true)}><Trash2 size={17} aria-hidden="true" />Dar de baja</button>
      </div> : null}
    </header>
    {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}
    {!profesor ? <LoadState error={error} retry={retry} /> : <>
      <section className={`${materiaStyles.card} ${profesorStyles.card}`} aria-label="Información del profesor">
        <span className={profesorStyles.avatar} aria-hidden="true">{initials}</span>
        <dl className={`${materiaStyles.data} ${profesorStyles.data}`}>
          <div><dt>Nombre completo</dt><dd className={!name ? materiaStyles.missing : undefined}>{title}</dd></div>
          <div><dt>Estado</dt><dd><span className={`${materiaStyles.status} ${profesor.deletedAt ? materiaStyles.inactive : materiaStyles.active}`}>{profesor.deletedAt ? "Inactivo" : "Activo"}</span></dd></div>
        </dl>
      </section>
      <AdminSharedAudit key={`${profesorId}:${auditVersion}`} kind="profesores" id={profesorId} />
    </>}
    {canManage && confirmDelete ? <AcademicDeleteDialog kind="profesores" id={profesorId} label={title} onClose={() => setConfirmDelete(false)} onAttempt={() => setAuditVersion(value => value + 1)} onSuccess={() => { setConfirmDelete(false); setMessage("El profesor se dio de baja correctamente."); setAuditVersion(value => value + 1); retry(); }} /> : null}
  </section>;
}

export function AdminCursadaDetail({ cursadaId }: { cursadaId: string }) {
  const headingId = useId();
  const informationId = useId();
  const isAdmin = useIsAdmin();
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
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
  const title = cursada ? cursada.cuatrimestre ? periodoLabel(cursada.anio, cursada.cuatrimestre) : `${cursada.anio} · No registrado` : "Cursada";
  const materiaName = cursada?.materia.nombre.trim() || "No registrado";
  const canManage = isAdmin && cursada && !cursada.deletedAt;
  const breadcrumb = [{ label: "Administración", href: "/home/admin" }, { label: "Materias", href: materiaReturnTo }, ...(cursada ? [{ label: materiaName, href: materiaHref }] : []), { label: "Cursadas", href: fallback }, { label: title }];
  return <section className={materiaStyles.page} aria-labelledby={headingId}>
    <header className={materiaStyles.header}>
      <PageHeader id={headingId} title={title} eyebrow="Detalle de cursada" description={<span className={!cursada?.materia.nombre.trim() ? materiaStyles.missing : undefined}>{materiaName}</span>} back={{ href: back, label: "contexto administrativo" }} breadcrumb={breadcrumb} focusKey={cursadaId} />
      {canManage ? <div className={materiaStyles.actions}>
        <Link className={`button button-secondary ${materiaStyles.edit}`} href={adminFormHref(`/home/admin/cursadas/${encodeURIComponent(cursadaId)}/editar`, back)}><Pencil size={17} aria-hidden="true" />Editar cursada</Link>
        <button className={`button button-secondary ${materiaStyles.remove}`} type="button" aria-label={`Dar de baja cursada ${title}`} onClick={() => setConfirmDelete(true)}><Trash2 size={17} aria-hidden="true" />Dar de baja</button>
      </div> : null}
    </header>
    {params.get("successMessage") ? <Notice tone="success">{params.get("successMessage")}</Notice> : null}
    {message ? <Notice tone="success">{message}</Notice> : null}
    {!cursada ? <LoadState error={error} retry={retry} /> : <>
      <section className={materiaStyles.card} aria-labelledby={informationId}>
        <div className={materiaStyles.cardBody}>
          <h2 id={informationId}><CalendarDays size={18} aria-hidden="true" />Información de la cursada</h2>
          <dl className={materiaStyles.data}>
            <div><dt>Período</dt><dd className={!cursada.cuatrimestre ? materiaStyles.missing : undefined}>{title}</dd></div>
            <div><dt>Estado</dt><dd><span className={`${materiaStyles.status} ${cursada.deletedAt ? materiaStyles.inactive : materiaStyles.active}`}>{cursada.deletedAt ? "Inactiva" : "Activa"}</span></dd></div>
            <div><dt>Materia</dt><dd className={!cursada.materia.nombre.trim() ? materiaStyles.missing : undefined}><Link href={materiaHref}>{materiaName}</Link></dd></div>
          </dl>
        </div>
        <footer className={materiaStyles.footer}><p>Las comisiones y sus equipos docentes se consultan dentro de esta cursada</p><Link className={`button button-secondary ${materiaStyles.periods}`} href={commissionsWithReturn}><Users size={18} aria-hidden="true" />Ver comisiones<ChevronRight size={17} aria-hidden="true" /></Link></footer>
      </section>
      <AdminSharedAudit key={`${cursadaId}:${auditVersion}`} kind="cursadas" id={cursadaId} />
    </>}
    {canManage && confirmDelete ? <AcademicDeleteDialog kind="cursadas" id={cursadaId} label={`${title} de ${materiaName}`} onClose={() => setConfirmDelete(false)} onAttempt={() => setAuditVersion(value => value + 1)} onSuccess={() => { setConfirmDelete(false); setMessage("La cursada se dio de baja correctamente."); setAuditVersion(value => value + 1); retry(); }} /> : null}
  </section>;
}
