"use client";

import { useId, useState } from "react";
import { UserCheck, UserX } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { adminReturnTo, internalDestination } from "@/lib/navigation";
import { ROLE_LABEL } from "@/lib/format/role";
import { useAuth } from "@/hooks/useAuth";
import { cambiarEstadoUsuario } from "@/services/users";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import { useAdminDetail } from "./useAdminDetail";
import { AdminAuditPanel } from "./AdminAudit";
import styles from "./AdminAcademicDetail.module.css";

const text = (value: unknown) => typeof value === "string" || typeof value === "number" ? String(value) : "No disponible";
const userFields = [["displayName", "Nombre visible"], ["email", "Email"]] as const;
const commentFields = [["texto", "Contenido completo"], ["comisionNombre", "Comisión"], ["comisionId", "Identificador de comisión"], ["materiaNombre", "Materia"], ["materiaId", "Identificador de materia"], ["anio", "Año"], ["cuatrimestre", "Período"], ["modalidad", "Modalidad"], ["profesorNombre", "Profesor"], ["profesorCargo", "Cargo docente"]] as const;

export function AdminRecordDetail({ kind, id }: { kind: "users" | "feedback"; id: string }) {
  const params = useSearchParams();
  const headingId = useId();
  const { account } = useAuth();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, retry } = useAdminDetail(kind, id, page);
  const section = kind === "users" ? "Usuarios" : "Experiencias";
  const list = kind === "users" ? "/home/admin/usuarios" : "/home/admin/experiencias";
  const rawReturn = internalDestination(params.get("returnTo"));
  const back = kind === "feedback" && rawReturn && /^\/home\/experiencias(\?|$)/.test(rawReturn) ? rawReturn : adminReturnTo(rawReturn, list);
  const record = data?.registro;
  const title = kind === "users" ? record ? text(record.displayName) : "Usuario" : `Comentario ${id}`;
  const fields = kind === "users" ? userFields : commentFields;
  const author = record?.autor && typeof record.autor === "object" && "displayName" in record.autor ? text(record.autor.displayName) : "No disponible";
  return <section className={styles.page} aria-labelledby={headingId}>
    <PageHeader id={headingId} title={title} back={{ href: back, label: "listado" }} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: section, href: list }, { label: title }]} />
    {message ? <Notice tone="success">{message}</Notice> : null}
    {error ? <Notice tone="error">Lo sentimos. No pudimos recuperar la información. Intentá nuevamente. <button className="button button-secondary" type="button" onClick={retry}>Reintentar</button></Notice> : !data ? <p role="status">Cargando registro…</p> : <>
      <section className={styles.surface} aria-label="Datos actuales">
        <h2>Datos actuales</h2>
        <dl className={styles.data}>{fields.map(([field, label]) => <div key={field}><dt>{label}</dt><dd className={field === "texto" ? styles.content : undefined}>{text(record?.[field])}</dd></div>)}
          {kind === "users" ? <div><dt>Rol</dt><dd>{record?.role === "ADMIN" || record?.role === "USER" ? ROLE_LABEL[record.role] : "No disponible"}</dd></div> : <><div><dt>Autor</dt><dd>{author}</dd></div><div><dt>Identificador del autor</dt><dd>{text(record?.autorId)}</dd></div><div><dt>Publicación anónima</dt><dd>{record?.anonimo ? "Sí" : "No"}</dd></div></>}
          <div><dt>Estado</dt><dd>{kind === "users" ? record?.disabledAt ? "Inactivo" : "Activo" : record?.deletedAt ? "Eliminado" : "Publicado"}</dd></div>
        </dl>
        {kind === "users" && account?.role === "ADMIN" && account.id !== id ? <div className={styles.actions}><button className="button button-secondary" type="button" aria-label={`${record?.disabledAt ? "Reactivar" : "Desactivar"} usuario ${text(record?.displayName)} (${text(record?.email)})`} onClick={() => setConfirm(true)}>{record?.disabledAt ? <UserCheck size={18} aria-hidden="true" /> : <UserX size={18} aria-hidden="true" />}{record?.disabledAt ? "Reactivar usuario" : "Desactivar usuario"}</button></div> : null}
      </section>
      <AdminAuditPanel data={data} page={page} onPageChange={setPage} />
    </>}
    {confirm && record ? <AdminConfirmDialog title={record.disabledAt ? "Reactivar usuario" : "Desactivar usuario"} confirmLabel={record.disabledAt ? "Confirmar reactivación" : "Confirmar desactivación"} onClose={() => setConfirm(false)} onConfirm={async () => { await cambiarEstadoUsuario(id, Boolean(record.disabledAt)); setConfirm(false); setMessage(record.disabledAt ? "Usuario reactivado correctamente." : "Usuario desactivado correctamente."); setPage(1); retry(); }}><p>¿Querés {record.disabledAt ? "reactivar" : "desactivar"} a {text(record.displayName)} ({text(record.email)})? {record.disabledAt ? "Deberá iniciar sesión nuevamente; las sesiones revocadas no se restaurarán." : "Se cerrarán sus sesiones y no podrá acceder hasta que se reactive su cuenta. Se conservarán su cuenta, sus comentarios y su historial."}</p></AdminConfirmDialog> : null}
  </section>;
}
