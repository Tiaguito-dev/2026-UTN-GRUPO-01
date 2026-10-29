"use client";

import { useId } from "react";
import { ChevronDown, Clock3, History, Lock, ShieldCheck, UserX } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Pagination } from "@/components/ui/Pagination";
import type { AdminRecord } from "@/services/admin-detail";
import styles from "./UserDetail.module.css";

function AuditDate({ value }: { value: string | null }) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return <span className={styles.missing}>No registrado</span>;
  return <time dateTime={value!}>{date.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}<small className={styles.time}>{date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></time>;
}

function actorName(id: string | null, name?: string | null) {
  return id ? name?.trim() || "Usuario no identificado" : "No registrado";
}

const actions: Record<string, string> = { CREACION: "Creación", EDICION: "Edición", DESACTIVACION: "Desactivación", REACTIVACION: "Reactivación", ACTIVACION: "Activación", BAJA_BLOQUEADA: "Baja bloqueada" };
const fields: Record<string, string> = { estado: "Estado", disabledAt: "Fecha de desactivación", displayName: "Nombre público", email: "Correo electrónico", role: "Rol", resultado: "Resultado", motivo: "Motivo" };
const values: Record<string, string> = { ACTIVO: "Activo", INACTIVO: "Inactivo", ADMIN: "Administrador", USER: "Usuario", true: "Sí", false: "No", BLOQUEADA: "Bloqueada" };
function changeValue(field: string, value: string | null) {
  if (!value) return <span className={styles.missing}>No registrado</span>;
  if (field === "disabledAt") return <AuditDate value={value} />;
  // Unknown technical references must not leak through the presentation.
  if (/^[\da-f]{8}-[\da-f-]{27,}$/iu.test(value)) return "Referencia no disponible";
  return values[value] ?? value;
}

export function UserAudit({ data, page, onPageChange }: { data: AdminRecord; page: number; onPageChange: (page: number) => void }) {
  const headingId = useId();
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;
  const audit = data.auditoria;
  const blocks = [
    { title: "Creación", Icon: Clock3, dateLabel: "Fecha de creación", date: audit.createdAt, actorLabel: "Creado por", actor: audit.createdBy, name: audit.createdByName },
    { title: "Última modificación", Icon: Clock3, dateLabel: "Fecha de modificación", date: audit.updatedAt, actorLabel: "Modificado por", actor: audit.updatedBy, name: audit.updatedByName },
    { title: "Desactivación", Icon: UserX, dateLabel: "Fecha de desactivación", date: audit.deletedAt, actorLabel: "Desactivado por", actor: audit.deletedBy, name: audit.deletedByName },
  ];
  return <section className={styles.card} aria-labelledby={headingId}>
    <div className={styles.auditHeader}><h2 id={headingId}><ShieldCheck size={18} aria-hidden="true" />Auditoría</h2><span><Lock size={14} aria-hidden="true" />Solo administración</span></div>
    <div className={styles.auditGrid}>{blocks.map(({ title, Icon, dateLabel, date, actorLabel, actor, name }) => <section key={title}>
      <h3><Icon size={16} aria-hidden="true" />{title}</h3>
      <dl className={styles.auditFields}><div><dt>{dateLabel}</dt><dd><AuditDate value={date} /></dd></div><div><dt>{actorLabel}</dt><dd className={!actor || !name?.trim() ? styles.missing : undefined}>{actorName(actor, name)}</dd></div></dl>
    </section>)}</div>
    <p className={styles.note}>La fecha de actualización no constituye un historial completo de cambios</p>
    <details className={styles.history}>
      <summary><History size={18} aria-hidden="true" /><span>Historial de cambios</span>{Number.isFinite(data.historial.total) ? <span className={styles.counter}>{data.historial.total}</span> : null}<ChevronDown className={styles.chevron} size={18} aria-hidden="true" /></summary>
      {data.historial.items.length ? <ol className={styles.events}>{data.historial.items.map(entry => <li key={entry.id}>
        <div className={styles.eventHeader}><strong>{actions[entry.accion] ?? "Cambio registrado"}</strong><AuditDate value={entry.createdAt} /></div>
        <p className={styles.note}>Actor: {actorName(entry.actorId, entry.actorName)}</p>
        {entry.cambios.length ? <div className={styles.tableScroll}><table><caption className="sr-only">Cambios registrados</caption><thead><tr><th scope="col">Campo</th><th scope="col">Antes</th><th scope="col">Después</th></tr></thead><tbody>{entry.cambios.map((change, index) => <tr key={index}><th scope="row">{fields[change.campo] ?? "Dato del registro"}</th><td>{changeValue(change.campo, change.anterior)}</td><td>{changeValue(change.campo, change.nuevo)}</td></tr>)}</tbody></table></div> : <p className={styles.note}>No se registraron cambios de campos para este evento.</p>}
      </li>)}</ol> : <div className={styles.empty}><p>No hay eventos registrados</p><p className={styles.note}>Solo se muestran cambios que fueron registrados por el sistema</p></div>}
      <Pagination page={page} pageSize={3} total={data.historial.total} onChange={onPageChange} />
    </details>
  </section>;
}
