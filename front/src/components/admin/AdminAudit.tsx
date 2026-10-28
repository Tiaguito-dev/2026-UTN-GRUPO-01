"use client";

import { useId, useState } from "react";
import type { AdminRecord, AdminRecordKind } from "@/services/admin-detail";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import { useAdminDetail } from "./useAdminDetail";
import styles from "./AdminAcademicDetail.module.css";

const FIELDS: Record<string, string> = { resultado: "Resultado de la operación", motivo: "Motivo del bloqueo", texto: "Contenido", anonimo: "Anónimo", nombre: "Nombre", nombreCompleto: "Nombre completo", materiaId: "Materia", anio: "Año", cuatrimestre: "Período", carrera: "Carrera", numero: "Número", deletedAt: "Fecha de baja", disabledAt: "Fecha de desactivación", activa: "Estado", estado: "Estado" };
const ACTIONS: Record<string, string> = { BAJA_BLOQUEADA: "Baja bloqueada", VINCULACION: "Vinculación", DESVINCULACION: "Desvinculación", CREACION: "Creación", EDICION: "Edición", ELIMINACION: "Eliminación", DESACTIVACION: "Desactivación", REACTIVACION: "Reactivación", ACTIVACION: "Activación" };
const unavailable = "No disponible: no fue registrado.";
const date = (value: string | null) => value ? new Date(value).toLocaleString("es-AR") : unavailable;

export function AdminAuditPanel({ data, page, onPageChange }: { data: AdminRecord; page: number; onPageChange: (page: number) => void }) {
  const headingId = useId();
  const audit = data.auditoria;
  return <section className={styles.surface} aria-labelledby={headingId}>
    <h2 id={headingId}>Auditoría</h2>
    <dl className={styles.data}>
      <div><dt>Identificador</dt><dd>{audit.id}</dd></div>
      <div><dt>Fecha de creación</dt><dd>{date(audit.createdAt)}</dd></div>
      <div><dt>Actor de creación</dt><dd>{audit.createdBy ?? unavailable}</dd></div>
      <div><dt>Última actualización registrada</dt><dd>{date(audit.updatedAt)}</dd></div>
      <div><dt>Actor de modificación</dt><dd>{audit.updatedBy ?? unavailable}</dd></div>
      <div><dt>Baja, desactivación o eliminación</dt><dd>{audit.deletedAt ? date(audit.deletedAt) : "Sin fecha registrada."}</dd></div>
      <div><dt>Actor de baja</dt><dd>{audit.deletedBy ?? unavailable}</dd></div>
    </dl>
    <p>La fecha de actualización no constituye un historial completo. Solo se muestran eventos realmente registrados.</p>
    <h3>Historial de cambios</h3>
    {data.historial.items.length ? <ol>{data.historial.items.map((entry) => <li key={entry.id}>
      <p><strong>{ACTIONS[entry.accion] ?? entry.accion}</strong> · {date(entry.createdAt)}</p>
      <p>Actor: {entry.actorId ?? unavailable}</p>
      {entry.cambios.length ? <dl className={styles.data}>{entry.cambios.map((change, index) => <div key={`${change.campo}:${index}`}><dt>{FIELDS[change.campo] ?? change.campo}</dt><dd>Antes: {change.anterior ?? "No disponible"}<br />Después: {change.nuevo ?? "Sin valor registrado"}</dd></div>)}</dl> : <p>No se registraron cambios de campos para este evento.</p>}
    </li>)}</ol> : <p>No hay eventos registrados disponibles.</p>}
    <Pagination page={page} pageSize={3} total={data.historial.total} onChange={onPageChange} />
  </section>;
}

export function AdminAudit({ kind, id }: { kind: AdminRecordKind; id: string }) {
  const [page, setPage] = useState(1);
  const { data, error, retry } = useAdminDetail(kind, id, page);
  if (error) return <Notice tone="error">Lo sentimos. No pudimos recuperar la auditoría. Intentá nuevamente. <button className="button button-secondary" type="button" onClick={retry}>Reintentar auditoría</button></Notice>;
  return data ? <AdminAuditPanel data={data} page={page} onPageChange={setPage} /> : <p role="status">Cargando auditoría…</p>;
}
