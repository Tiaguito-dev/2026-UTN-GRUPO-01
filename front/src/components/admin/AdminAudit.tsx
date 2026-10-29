"use client";

import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useId, useState } from "react";
import type { AdminRecord, AdminRecordKind } from "@/services/admin-detail";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import { useAdminDetail } from "./useAdminDetail";
import styles from "./AdminAcademicDetail.module.css";

const FIELDS: Record<string, string> = { resultado: "Resultado de la operación", motivo: "Motivo del bloqueo", texto: "Contenido", anonimo: "Anónimo", nombre: "Nombre", nombreCompleto: "Nombre completo", materiaId: "Materia", anio: "Año", cuatrimestre: "Período", carrera: "Carrera", numero: "Número", deletedAt: "Fecha de baja", disabledAt: "Fecha de desactivación", activa: "Estado", estado: "Estado" };
const ACTIONS: Record<string, string> = { BAJA_BLOQUEADA: "Baja bloqueada", VINCULACION: "Vinculación", DESVINCULACION: "Desvinculación", CREACION: "Creación", EDICION: "Edición", ELIMINACION: "Eliminación", DESACTIVACION: "Desactivación", REACTIVACION: "Reactivación", ACTIVACION: "Activación" };
const unavailable = "No registrado";
function date(value: string | null) {
  const parsed = value ? new Date(value) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return <span className={styles.missing}>{unavailable}</span>;
  return <time dateTime={value!}>{parsed.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}<small className={styles.time}>{parsed.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></time>;
}

export function AdminAuditPanel({ data, page, onPageChange, kind }: { kind?: AdminRecordKind; data: AdminRecord; page: number; onPageChange: (page: number) => void }) {
  const headingId = useId();
  const isAdmin = useIsAdmin();
  const audit = data.auditoria;
  if (!isAdmin) return null;
  const removal = kind === "users" ? "desactivación" : kind === "feedback" ? "eliminación" : "baja";
  const actor = (value: string | null) => value || <span className={styles.missing}>{unavailable}</span>;
  return <section className={styles.surface} aria-labelledby={headingId}>
    <h2 id={headingId}>Auditoría</h2>
    <div className={styles.auditGrid}>
      <section><h3>Creación</h3><dl className={styles.data}>
        <dt>Fecha de creación</dt><dd>{date(audit.createdAt)}</dd>
        <dt>Creado por</dt><dd>{actor(audit.createdBy)}</dd>
      </dl></section>
      <section><h3>Última modificación</h3><dl className={styles.data}>
        <dt>Fecha de modificación</dt><dd>{date(audit.updatedAt)}</dd>
        <dt>Modificado por</dt><dd>{actor(audit.updatedBy)}</dd>
      </dl></section>
      <section><h3>{kind === "users" ? "Desactivación" : kind === "feedback" ? "Eliminación" : "Baja"}</h3><dl className={styles.data}>
        <dt>Fecha de {removal}</dt><dd>{date(audit.deletedAt)}</dd>
        <dt>{kind === "users" ? "Desactivado por" : kind === "feedback" ? "Eliminado por" : "Dado de baja por"}</dt><dd>{actor(audit.deletedBy)}</dd>
      </dl></section>
    </div>
    <p className={styles.note}>La fecha de actualización no constituye un historial completo de cambios</p>
    <details className={styles.history}>
    <summary>Historial de cambios{data.historial.total > 0 ? ` (${data.historial.total})` : ""}</summary>
    {data.historial.items.length ? <ol>{data.historial.items.map((entry) => <li key={entry.id}>
      <p><strong>{ACTIONS[entry.accion] ?? entry.accion}</strong> · {date(entry.createdAt)}</p>
      <p>Actor: {entry.actorId ?? unavailable}</p>
      {entry.cambios.length ? <dl className={styles.data}>{entry.cambios.map((change, index) => <div key={`${change.campo}:${index}`}><dt>{FIELDS[change.campo] ?? change.campo}</dt><dd>Antes: {change.anterior ?? "No disponible"}<br />Después: {change.nuevo ?? "Sin valor registrado"}</dd></div>)}</dl> : <p>No se registraron cambios de campos para este evento.</p>}
    </li>)}</ol> : <p>No hay eventos registrados</p>}
    <Pagination page={page} pageSize={3} total={data.historial.total} onChange={onPageChange} />
    </details>
  </section>;
}

export function AdminAudit({ kind, id }: { kind: AdminRecordKind; id: string }) {
  const isAdmin = useIsAdmin();
  return isAdmin ? <AdminAuditContent kind={kind} id={id} /> : null;
}

function AdminAuditContent({ kind, id }: { kind: AdminRecordKind; id: string }) {
  const [page, setPage] = useState(1);
  const { data, error, retry } = useAdminDetail(kind, id, page);
  if (error) return <Notice tone="error">Lo sentimos. No pudimos recuperar la auditoría. Intentá nuevamente. <button className="button button-secondary" type="button" onClick={retry}>Reintentar auditoría</button></Notice>;
  return data ? <AdminAuditPanel kind={kind} data={data} page={page} onPageChange={setPage} /> : <p role="status">Cargando auditoría…</p>;
}
