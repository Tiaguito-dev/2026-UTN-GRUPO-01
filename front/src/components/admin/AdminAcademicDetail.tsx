"use client";

import Link from "next/link";
import { useEffect, useId, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { obtenerDetalleAdministrativo } from "@/services/admin-detail";
import { cursadaDetalleSchema, materiaSchema, profesorSchema } from "@/services/schemas";
import type { Materia } from "@/types/materias";
import { type CursadaDetalle, type Profesor } from "@/services/academic";
import { adminReturnTo } from "@/lib/navigation";
import { periodoLabel } from "@/lib/format/periodo";
import { carreraLabel } from "@/lib/format/carrera";
import { adminFormHref, adminListHref, safeAdminReturnTo } from "@/validations/admin";
import { anioCarreraLabel, modalidadLabel, nivelElectivaLabel } from "@/validations/materias";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { AdminAudit } from "./AdminAudit";
import styles from "./AdminAcademicDetail.module.css";

async function loadMateria(id: string) { return materiaSchema.parse((await obtenerDetalleAdministrativo("materias", id)).registro); }
async function loadProfesor(id: string) { return profesorSchema.parse((await obtenerDetalleAdministrativo("profesores", id)).registro); }
async function loadCursada(id: string) { const { registro } = await obtenerDetalleAdministrativo("cursadas", id); return { ...cursadaDetalleSchema.parse(registro), deletedAt: typeof registro.deletedAt === "string" ? registro.deletedAt : null }; }

function DetailPage({ title, section, back, listHref, children }: { title: string; section: "materias" | "profesores" | "cursadas"; back: string; listHref?: string; children: ReactNode }) {
  const headingId = useId();
  const params = useSearchParams();
  const labels = { materias: "Materias", profesores: "Profesores", cursadas: "Cursadas" };
  return <section className={styles.page} aria-labelledby={headingId}>
    <PageHeader id={headingId} title={title} back={{ href: back, label: "contexto administrativo" }} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: labels[section], href: listHref ?? `/home/admin/${section}` }, { label: title }]} />
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
  const params = useSearchParams();
  const back = adminReturnTo(params.get("returnTo"), "/home/admin/materias");
  const { data: materia, error, retry } = useAdminResource<Materia>(materiaId, loadMateria);
  return <DetailPage title={materia?.nombre ?? "Materia"} section="materias" back={back}>
    {!materia ? <LoadState error={error} retry={retry} /> : <>
      <div className={styles.surface}>
        <dl className={styles.data}><div><dt>Modalidad</dt><dd>{modalidadLabel(materia.modalidad)}</dd></div><div><dt>Estado</dt><dd>{materia.deletedAt ? "Inactiva" : "Activa"}</dd></div></dl>
        <h2>Carreras</h2>
        {materia.carreras.length ? <ul className={styles.associations}>{materia.carreras.map((row) => <li key={row.carrera}><strong>{carreraLabel(row.carrera)}</strong><span>{anioCarreraLabel(row.anioCarrera)}{row.nivelElectiva ? ` · ${nivelElectivaLabel(row.nivelElectiva)}` : ""}</span></li>)}</ul> : <p>No hay carreras asociadas.</p>}
        <div className={styles.actions}>
          <Link className="button button-secondary" href={adminListHref({ seccion: "cursadas", materiaId, page: 1 })}>Ver cursadas</Link>
          {!materia.deletedAt ? <Link className="button button-secondary" href={adminFormHref(`/home/admin/materias/${encodeURIComponent(materiaId)}/editar`, safeAdminReturnTo(back) ?? "/home/admin/materias")}>Editar materia</Link> : null}
        </div>
      </div>
      <AdminAudit key={materiaId} kind="materias" id={materiaId} />
    </>}
  </DetailPage>;
}

export function AdminProfesorDetail({ profesorId }: { profesorId: string }) {
  const params = useSearchParams();
  const back = adminReturnTo(params.get("returnTo"), "/home/admin/profesores");
  const { data: profesor, error, retry } = useAdminResource<Profesor>(profesorId, loadProfesor);
  return <DetailPage title={profesor?.nombreCompleto ?? "Profesor"} section="profesores" back={back}>
    {!profesor ? <LoadState error={error} retry={retry} /> : <div className={styles.surface}>
      <dl className={styles.data}><div><dt>Nombre completo</dt><dd>{profesor.nombreCompleto}</dd></div><div><dt>Estado</dt><dd>{profesor.deletedAt ? "Inactivo" : "Activo"}</dd></div></dl>
      {!profesor.deletedAt ? <div className={styles.actions}><Link className="button button-secondary" href={adminFormHref(`/home/admin/profesores/${encodeURIComponent(profesorId)}/editar`, safeAdminReturnTo(back) ?? "/home/admin/profesores")}>Editar profesor</Link></div> : null}
    </div>}
    {profesor ? <AdminAudit key={profesorId} kind="profesores" id={profesorId} /> : null}
  </DetailPage>;
}

export function AdminCursadaDetail({ cursadaId }: { cursadaId: string }) {
  const params = useSearchParams();
  const { data: cursada, error, retry } = useAdminResource<CursadaDetalle & { deletedAt: string | null }>(cursadaId, loadCursada);
  const fallback = adminListHref({ seccion: "cursadas", materiaId: cursada?.materia.id, page: 1 });
  const back = adminReturnTo(params.get("returnTo"), fallback);
  return <DetailPage title={cursada ? `Cursada ${periodoLabel(cursada.anio, cursada.cuatrimestre)}` : "Cursada"} section="cursadas" back={back} listHref={fallback}>
    {!cursada ? <LoadState error={error} retry={retry} /> : <div className={styles.surface}>
      <dl className={styles.data}><div><dt>Materia</dt><dd><Link href={`/home/admin/materias/${encodeURIComponent(cursada.materia.id)}?${new URLSearchParams({ returnTo: back })}`}>{cursada.materia.nombre}</Link></dd></div><div><dt>Período</dt><dd>{periodoLabel(cursada.anio, cursada.cuatrimestre)}</dd></div><div><dt>Estado</dt><dd>{cursada.deletedAt ? "Inactiva" : "Activa"}</dd></div></dl>
      <div className={styles.actions}><Link className="button button-secondary" href={adminListHref({ seccion: "comisiones", materiaId: cursada.materia.id, cursadaId, page: 1 })}>Ver comisiones</Link>{!cursada.deletedAt ? <><Link className="button button-secondary" href={adminFormHref(`/home/admin/cursadas/${encodeURIComponent(cursadaId)}/editar`, safeAdminReturnTo(back) ?? fallback)}>Editar cursada</Link></> : null}</div>
    </div>}
    {cursada ? <AdminAudit key={cursadaId} kind="cursadas" id={cursadaId} /> : null}
  </DetailPage>;
}
