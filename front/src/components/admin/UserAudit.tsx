"use client";

import { useId } from "react";
import { ChevronDown, Clock3, History, Lock, ShieldCheck, Trash2, UserX } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Pagination } from "@/components/ui/Pagination";
import type { AdminRecord, AdminRecordKind } from "@/services/admin-detail";
import { anioCarreraLabel, carreraLabel, isAnioCarrera, isCarrera, isModalidadMateria, isNivelElectiva, modalidadLabel, nivelElectivaLabel } from "@/validations/materias";
import styles from "./UserDetail.module.css";

function AuditDate({ value }: { value: string | null }) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return <span className={styles.missing}>No registrado</span>;
  return <time dateTime={value!}>{date.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}<small className={styles.time}>{date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</small></time>;
}

function actorName(id: string | null, name?: string | null) {
  return id ? name?.trim() || "Usuario no identificado" : "No registrado";
}

const actions: Record<string, string> = { CREACION: "Creación", EDICION: "Edición", DESACTIVACION: "Desactivación", REACTIVACION: "Reactivación", ACTIVACION: "Activación", BAJA_BLOQUEADA: "Baja bloqueada", VINCULACION: "Vinculación", DESVINCULACION: "Desvinculación" };
const fields: Record<string, string> = { texto: "Contenido", anonimo: "Publicación anónima", estado: "Estado", disabledAt: "Fecha de desactivación", displayName: "Nombre público", email: "Correo electrónico", role: "Rol", resultado: "Resultado", motivo: "Motivo", nombre: "Nombre", nombreCompleto: "Nombre completo", modalidad: "Modalidad", carreras: "Carreras", anioCarrera: "Año de carrera", nivelElectiva: "Nivel de electiva", deletedAt: "Fecha de baja", materiaId: "Materia", anio: "Año", cuatrimestre: "Cuatrimestre", carrera: "Carrera", numero: "Número", activa: "Estado" };
const values: Record<string, string> = { ACTIVO: "Activo", INACTIVO: "Inactivo", ADMIN: "Administrador", USER: "Usuario", true: "Sí", false: "No", BLOQUEADA: "Bloqueada", EXITOSA: "Exitosa" };

/** El historial de carreras usa el contrato compacto carrera:año[:nivel], separado por comas. */
function careerChanges(value: string) {
  const rows = value.split(",").map((row) => {
    const [carrera, anio, nivel, extra] = row.split(":");
    if (!isCarrera(carrera) || !isAnioCarrera(anio) || extra !== undefined || (nivel !== undefined && !isNivelElectiva(nivel))) return null;
    return `${carreraLabel(carrera)} · ${anioCarreraLabel(anio)}${nivel && isNivelElectiva(nivel) ? ` · ${nivelElectivaLabel(nivel)}` : ""}`;
  });
  return rows.every((row) => row !== null) ? rows.join("; ") : "Asociaciones no disponibles";
}

function changeValue(field: string, value: string | null) {
  if (value === null) return <span className={styles.missing}>No registrado</span>;
  if (value === "") return <span className={styles.missing}>Vacío</span>;
  if (field === "texto") return value;
  if (field === "disabledAt" || field === "deletedAt") return <AuditDate value={value} />;
  if (field === "modalidad") return isModalidadMateria(value) ? modalidadLabel(value) : "Modalidad no disponible";
  if (field === "carreras") return careerChanges(value);
  if (field === "carrera") return isCarrera(value) ? carreraLabel(value) : "Carrera no disponible";
  if (field === "anioCarrera") return isAnioCarrera(value) ? anioCarreraLabel(value) : "Año no disponible";
  if (field === "nivelElectiva") return isNivelElectiva(value) ? nivelElectivaLabel(value) : "Nivel no disponible";
  if (field === "cuatrimestre") return value === "PRIMERO" ? "Primer cuatrimestre" : value === "SEGUNDO" ? "Segundo cuatrimestre" : value === "ANUAL" ? "Anual" : "Cuatrimestre no disponible";
  // Unknown technical references must not leak through the presentation.
  return values[value] ?? value.replace(/[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}/giu, "Referencia no disponible");
}

export function UserAudit({ data, page, onPageChange, kind = "users" }: { data: AdminRecord; page: number; onPageChange: (page: number) => void; kind?: AdminRecordKind }) {
  const headingId = useId();
  const isAdmin = useIsAdmin();
  if (!isAdmin) return null;
  const audit = data.auditoria;
  const removal = kind === "users" ? { title: "Desactivación", Icon: UserX, dateLabel: "Fecha de desactivación", actorLabel: "Desactivado por" }
    : kind === "feedback" ? { title: "Eliminación", Icon: Trash2, dateLabel: "Fecha de eliminación", actorLabel: "Eliminado por" }
    : { title: "Baja", Icon: Trash2, dateLabel: "Fecha de baja", actorLabel: "Dado de baja por" };
  const blocks = [
    { title: "Creación", Icon: Clock3, dateLabel: "Fecha de creación", date: audit.createdAt, actorLabel: "Creado por", actor: audit.createdBy, name: audit.createdByName },
    { title: "Última modificación", Icon: Clock3, dateLabel: "Fecha de modificación", date: audit.updatedAt, actorLabel: "Modificado por", actor: audit.updatedBy, name: audit.updatedByName },
    { ...removal, date: audit.deletedAt, actor: audit.deletedBy, name: audit.deletedByName },
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
        <div className={styles.eventHeader}><strong>{entry.accion === "ELIMINACION" ? removal.title : actions[entry.accion] ?? "Cambio registrado"}</strong><AuditDate value={entry.createdAt} /></div>
        <p className={styles.note}>Actor: {actorName(entry.actorId, entry.actorName)}</p>
        {entry.cambios.length ? <div className={styles.tableScroll}><table><caption className="sr-only">Cambios registrados</caption><thead><tr><th scope="col">Campo</th><th scope="col">Antes</th><th scope="col">Después</th></tr></thead><tbody>{entry.cambios.map((change, index) => <tr key={index}><th scope="row">{fields[change.campo] ?? "Dato del registro"}</th><td>{changeValue(change.campo, change.anterior)}</td><td>{changeValue(change.campo, change.nuevo)}</td></tr>)}</tbody></table></div> : <p className={styles.note}>No se registraron cambios de campos para este evento.</p>}
      </li>)}</ol> : <div className={styles.empty}><p>No hay eventos registrados</p><p className={styles.note}>Solo se muestran cambios que fueron registrados por el sistema</p></div>}
      <Pagination page={page} pageSize={3} total={data.historial.total} onChange={onPageChange} />
    </details>
  </section>;
}
