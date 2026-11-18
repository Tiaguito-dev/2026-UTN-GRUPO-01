"use client";

import Link from "next/link";
import { useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { listarFeedbackModeracion } from "@/services/feedback";
import { listarReportesFeedback } from "@/services/feedback-reportes";
import { reporteMotivos } from "@/validations/feedback-moderation";
import { AdminListResult, AdminSelect, AdminTable } from "./AdminTable";
import { AdminModerationStatus } from "./AdminModerationActions";
import { AdminReporteDetail } from "./AdminReporteDetail";
import styles from "./AdminTables.module.css";
import moderation from "./AdminModeration.module.css";

const base = "/home/admin/experiencias";
export function AdminExperiencias() {
  const id = useId(); const params = useSearchParams(); const reports = params.get("seccion") === "reportes";
  const reportId = reports ? params.get("reporteId") : null;
  const query = new URLSearchParams(params.toString()); query.delete("reporteId");
  const list = `${base}?${query}`;
  if (reportId) return <AdminReporteDetail key={reportId} id={reportId} returnTo={list} />;
  return <section className={styles.page} aria-labelledby={id}>
    <PageHeader id={id} title="Experiencias" description="Revisión humana de experiencias y gestión de reportes de la comunidad." back={{ href: "/home/admin", label: "Administración" }} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Experiencias" }]} />
    <nav className={moderation.tabs} aria-label="Administración de experiencias">
      <Link className={`button ${reports ? "button-secondary" : ""}`} href={base} aria-current={!reports ? "page" : undefined}>Moderación</Link>
      <Link className={`button ${reports ? "" : "button-secondary"}`} href={`${base}?seccion=reportes`} aria-current={reports ? "page" : undefined}>Reportes</Link>
    </nav>
    {reports ? <AdminReportesList /> : <AdminModerationList />}
  </section>;
}

function useAdminListNavigation() {
  const params = useSearchParams(); const router = useRouter(); const pagination = useUrlPagination();
  const list = `${base}${params.size ? `?${params}` : ""}`;
  const change = (key: string, value: string) => { const next = new URLSearchParams(params.toString()); next.delete("page"); if (value) next.set(key, value); else next.delete(key); router.replace(`${base}?${next}`, { scroll: false }); };
  return { params, list, change, ...pagination };
}

function AdminModerationList() {
  const { params, page, setPage, list, change } = useAdminListNavigation();
  const raw = params.get("estadoModeracion"); const estado = raw === "APROBADO" || raw === "RECHAZADO" ? raw : "PENDIENTE";
  const { state, retry } = usePaginatedFetch(`admin-moderacion:${estado}`, next => listarFeedbackModeracion({ page: next, pageSize: 9, estado }), page);
  return <>
    <div className={styles.toolbar}><div className={styles.filters}><AdminSelect label="Estado de moderación" value={estado === "PENDIENTE" ? "" : estado} all="Pendientes de revisión" options={[{ value: "APROBADO", label: "Aprobadas" }, { value: "RECHAZADO", label: "Rechazadas" }]} onChange={value => change("estadoModeracion", value || "PENDIENTE")} /></div></div>
    <AdminListResult state={state} retry={retry} page={page} onPageChange={setPage} loadingMessage="Cargando experiencias para revisión…">{result => <AdminTable title="Experiencias para moderación" columns={["Experiencia", "Contexto académico", "Estado y visibilidad", "Fecha"]} rows={result.items.map(item => ({ id: item.id, cells: [item.texto, <>{item.contexto.materiaNombre}<br />Comisión {item.contexto.nombre}{item.profesor ? <><br />{item.profesor.nombreCompleto}</> : null}</>, <AdminModerationStatus key="estado" record={{ ...item }} />, new Date(item.createdAt).toLocaleString("es-AR")] }))} actions={row => <Link className="button button-secondary" href={`${base}/${encodeURIComponent(row.id)}?${new URLSearchParams({ returnTo: list })}`}>Ver detalle</Link>} />}</AdminListResult>
  </>;
}

function AdminReportesList() {
  const { params, page, setPage, list, change } = useAdminListNavigation();
  const rawState = params.get("estadoReporte"); const estado = rawState === "ABIERTO" || rawState === "RESUELTO" || rawState === "DESESTIMADO" ? rawState : undefined;
  const motivo = reporteMotivos.find(item => item.value === params.get("motivo"))?.value;
  const rawHidden = params.get("ocultoReportes"); const ocultoReportes = rawHidden === "true" ? true : rawHidden === "false" ? false : undefined;
  const { state, retry } = usePaginatedFetch(`admin-reportes:${estado}:${motivo}:${ocultoReportes}`, next => listarReportesFeedback({ page: next, pageSize: 9, estado, motivo, ocultoReportes }), page);
  return <>
    <div className={styles.toolbar}><div className={styles.filters}>
      <AdminSelect label="Estado del reporte" value={estado ?? ""} options={[{ value: "ABIERTO", label: "Abiertos" }, { value: "RESUELTO", label: "Resueltos" }, { value: "DESESTIMADO", label: "Desestimados" }]} onChange={value => change("estadoReporte", value)} />
      <AdminSelect label="Motivo" value={motivo ?? ""} options={[...reporteMotivos]} onChange={value => change("motivo", value)} />
      <AdminSelect label="Ocultamiento preventivo" value={rawHidden ?? ""} options={[{ value: "true", label: "Con ocultamiento preventivo" }, { value: "false", label: "Sin ocultamiento preventivo" }]} onChange={value => change("ocultoReportes", value)} />
    </div></div>
    <AdminListResult state={state} retry={retry} page={page} onPageChange={setPage} loadingMessage="Cargando reportes…">{result => <AdminTable title="Reportes de experiencias" columns={["Experiencia reportada", "Motivo", "Fecha", "Estado", "Denunciantes con reportes abiertos", "Ocultamiento preventivo"]} rows={result.items.map(item => ({ id: item.id, cells: [<>{item.experiencia.contexto.materiaNombre}<br />Comisión {item.experiencia.contexto.nombre}<br />Versión {item.versionReportada}</>, reporteMotivos.find(option => option.value === item.motivo)?.label ?? item.motivo, new Date(item.createdAt).toLocaleString("es-AR"), item.estado === "ABIERTO" ? "Abierto" : item.estado === "RESUELTO" ? "Resuelto" : "Desestimado", item.denunciantesAbiertos, item.experiencia.ocultoReportes ? "Sí" : "No"] }))} actions={row => <Link className="button button-secondary" href={`${list}${list.includes("?") ? "&" : "?"}reporteId=${encodeURIComponent(row.id)}`}>Ver reporte</Link>} />}</AdminListResult>
  </>;
}
