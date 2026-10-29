"use client";

import { useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { adminReturnTo, internalDestination } from "@/lib/navigation";
import { useAuth } from "@/hooks/useAuth";
import { cambiarEstadoUsuario } from "@/services/users";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import { useAdminDetail } from "./useAdminDetail";
import { AdminAuditPanel } from "./AdminAudit";
import { UserAccountCard, userValue } from "./UserAccountCard";
import { UserAudit } from "./UserAudit";
import userStyles from "./UserDetail.module.css";
import styles from "./AdminAcademicDetail.module.css";

const text = (value: unknown) => (typeof value === "string" && value.trim()) || typeof value === "number" ? String(value) : "No registrado";
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
  const back = kind === "users" ? rawReturn && /^\/home\/admin\/usuarios(\?|$)/.test(rawReturn) ? rawReturn : list : kind === "feedback" && rawReturn && /^\/home\/experiencias(\?|$)/.test(rawReturn) ? rawReturn : adminReturnTo(rawReturn, list);
  const record = data?.registro;
  const title = kind === "users" ? "Detalle de usuario" : "Detalle de comentario";
  const fields = commentFields;
  const author = record?.autor && typeof record.autor === "object" && "displayName" in record.autor ? text(record.autor.displayName) : "No registrado";
  const header = <PageHeader description={kind === "users" ? "Información de la cuenta y trazabilidad de sus cambios" : undefined} id={headingId} title={title} back={{ href: back, label: "listado" }} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: section, href: list }, { label: kind === "users" ? record ? userValue(record.displayName) : "Usuario" : title }]} />;
  return <section className={kind === "users" ? userStyles.page : styles.page} aria-labelledby={headingId}>
    {kind === "users" ? <div className={userStyles.header}>{header}</div> : header}
    {message ? <Notice tone="success">{message}</Notice> : null}
    {error ? <Notice tone="error">Lo sentimos. No pudimos recuperar la información. Intentá nuevamente. <button className="button button-secondary" type="button" onClick={retry}>Reintentar</button></Notice> : !data ? <p role="status">Cargando registro…</p> : <>
      {kind === "users" ? <UserAccountCard record={data.registro} ownAccount={account?.role === "ADMIN" && account.id === id} canManage={account?.role === "ADMIN" && account.id !== id} onManage={() => setConfirm(true)} /> : <section className={styles.surface} aria-label="Datos actuales">
        <h2>Datos actuales</h2>
        <dl className={`${styles.data} ${styles.fields}`}>{fields.map(([field, label]) => <div key={field}><dt>{label}</dt><dd className={text(record?.[field]) === "No registrado" ? styles.missing : field === "texto" ? styles.content : undefined}>{text(record?.[field])}</dd></div>)}
          <div><dt>Autor</dt><dd>{author}</dd></div><div><dt>Identificador del autor</dt><dd>{text(record?.autorId)}</dd></div><div><dt>Publicación anónima</dt><dd>{record?.anonimo ? "Sí" : "No"}</dd></div>
          {kind === "feedback" ? <div><dt>Estado</dt><dd>{record?.deletedAt ? "Eliminado" : "Publicado"}</dd></div> : null}
        </dl>
      </section>}
      {kind === "users" ? <UserAudit data={data} page={page} onPageChange={setPage} /> : <AdminAuditPanel kind={kind} data={data} page={page} onPageChange={setPage} />}
    </>}
    {confirm && record ? <AdminConfirmDialog title={record.disabledAt ? "Reactivar usuario" : "Desactivar usuario"} confirmLabel={record.disabledAt ? "Confirmar reactivación" : "Confirmar desactivación"} onClose={() => setConfirm(false)} onConfirm={async () => { await cambiarEstadoUsuario(id, Boolean(record.disabledAt)); setConfirm(false); setMessage(record.disabledAt ? "Usuario reactivado correctamente." : "Usuario desactivado correctamente."); setPage(1); retry(); }}><p>¿Querés {record.disabledAt ? "reactivar" : "desactivar"} a {text(record.displayName)} ({text(record.email)})? {record.disabledAt ? "Deberá iniciar sesión nuevamente; las sesiones revocadas no se restaurarán." : "Se cerrarán sus sesiones y no podrá acceder hasta que se reactive su cuenta. Se conservarán su cuenta, sus comentarios y su historial."}</p></AdminConfirmDialog> : null}
  </section>;
}
