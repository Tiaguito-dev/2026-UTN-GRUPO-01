"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useId, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { safeAdminReturnTo } from "@/validations/admin";
import { comisionDetailHref, experienciasListReturnTo, profesorDetailBack } from "@/validations/admin-academic-navigation";
import { useAuth } from "@/hooks/useAuth";
import { cambiarEstadoUsuario } from "@/services/users";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import { useAdminDetail } from "./useAdminDetail";
import { AdminExperienceCard } from "./AdminExperienceCard";
import { UserAccountCard, userValue } from "./UserAccountCard";
import { UserAudit } from "./UserAudit";
import { useAdminCommissionOrigin, useDiscardInvalidAdminOrigin } from "./useAdminCommissionOrigin";
import userStyles from "./UserDetail.module.css";
import styles from "./AdminMateriaDetail.module.css";

const text = (value: unknown) => (typeof value === "string" && value.trim()) || typeof value === "number" ? String(value) : "No registrado";

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
  const rawReturn = safeAdminReturnTo(params.get("returnTo"));
  const record = data?.registro;
  const commissionOrigin = rawReturn && typeof record?.comisionId === "string" && new URL(rawReturn, "https://local.invalid").pathname === `/home/admin/comisiones/${encodeURIComponent(record.comisionId)}` && profesorDetailBack(rawReturn) === rawReturn;
  const candidate = rawReturn && (kind === "users" ? /^\/home\/admin\/usuarios(\?|$)/.test(rawReturn) : experienciasListReturnTo(rawReturn) || commissionOrigin) ? rawReturn : list;
  const source = useAdminCommissionOrigin(kind === "feedback" ? candidate : "");
  useDiscardInvalidAdminOrigin(kind === "feedback" && (source.error || Boolean(data && rawReturn && /^\/home\/admin\/comisiones\//.test(rawReturn) && !commissionOrigin)));
  const back = source.error ? list : candidate;
  const experienceOrigin = experienciasListReturnTo(back) ?? "/home/admin/experiencias";
  const commissionParent = source.navigation?.back ?? experienceOrigin;
  const title = kind === "users" ? "Detalle de usuario" : "Detalle de comentario";
  const breadcrumb = source.navigation && source.data && !source.error
    ? [...source.navigation.breadcrumb.slice(0, -1), { label: `Comisión ${source.data.nombre}`, href: back }, { label: title }]
    : [{ label: "Administración", href: "/home/admin" }, { label: section, href: kind === "feedback" ? experienceOrigin : back }, { label: kind === "users" ? record ? userValue(record.displayName) : "Usuario" : title }];
  const header = <PageHeader eyebrow={kind === "feedback" ? "Detalle de experiencia" : undefined} description={kind === "users" ? "Información de la cuenta y trazabilidad de sus cambios" : "Contenido publicado y contexto académico registrado"} id={headingId} title={title} back={{ href: back, label: "listado" }} breadcrumb={breadcrumb} focusKey={id} />;
  return <section className={kind === "users" ? userStyles.page : styles.page} aria-labelledby={headingId}>
    {kind === "users" ? <div className={userStyles.header}>{header}</div> : <header className={styles.header}>
      {header}
      {typeof record?.comisionId === "string" ? <div className={styles.actions}><Link className={`button button-secondary ${styles.edit}`} href={source.data?.id === record.comisionId && !source.error ? back : comisionDetailHref(record.comisionId, commissionParent)}>Ver comisión<ArrowRight size={17} aria-hidden="true" /></Link></div> : null}
    </header>}
    {message ? <Notice tone="success">{message}</Notice> : null}
    {error ? <Notice tone="error">Lo sentimos. No pudimos recuperar la información. Intentá nuevamente. <button className="button button-secondary" type="button" onClick={retry}>Reintentar</button></Notice> : !data ? <p role="status">Cargando registro…</p> : <>
      {kind === "users" ? <UserAccountCard record={data.registro} ownAccount={account?.role === "ADMIN" && account.id === id} canManage={account?.role === "ADMIN" && account.id !== id} onManage={() => setConfirm(true)} /> : <AdminExperienceCard record={data.registro} />}
      <UserAudit kind={kind} data={data} page={page} onPageChange={setPage} />
    </>}
    {confirm && record ? <AdminConfirmDialog title={record.disabledAt ? "Reactivar usuario" : "Desactivar usuario"} confirmLabel={record.disabledAt ? "Confirmar reactivación" : "Confirmar desactivación"} onClose={() => setConfirm(false)} onConfirm={async () => { await cambiarEstadoUsuario(id, Boolean(record.disabledAt)); setConfirm(false); setMessage(record.disabledAt ? "Usuario reactivado correctamente." : "Usuario desactivado correctamente."); setPage(1); retry(); }}><p>¿Querés {record.disabledAt ? "reactivar" : "desactivar"} a {text(record.displayName)} ({text(record.email)})? {record.disabledAt ? "Deberá iniciar sesión nuevamente; las sesiones revocadas no se restaurarán." : "Se cerrarán sus sesiones y no podrá acceder hasta que se reactive su cuenta. Se conservarán su cuenta, sus comentarios y su historial."}</p></AdminConfirmDialog> : null}
  </section>;
}
