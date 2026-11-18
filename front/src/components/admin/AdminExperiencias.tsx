"use client";

import Link from "next/link";
import { useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { listarReportesFeedback } from "@/services/feedback-reportes";
import { reporteMotivos } from "@/validations/feedback-moderation";
import { AdminListResult, AdminSelect, AdminTable } from "./AdminTable";
import { AdminReporteDetail } from "./AdminReporteDetail";
import styles from "./AdminTables.module.css";

const base = "/home/admin/experiencias";
export function AdminExperiencias() {
  const id = useId(); const params = useSearchParams();
  const reportId = params.get("reporteId");
  const query = new URLSearchParams(params.toString()); query.delete("reporteId");
  const list = `${base}?${query}`;
  if (reportId) return <AdminReporteDetail key={reportId} id={reportId} returnTo={list} />;
  return <section className={styles.page} aria-labelledby={id}>
    <PageHeader id={id} title="Reportes de experiencias" description="Gestión de reportes de la comunidad." back={{ href: "/home/admin", label: "Administración" }} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Experiencias" }]} />
    <AdminReportesList />
  </section>;
}

function useAdminListNavigation() {
  const params = useSearchParams(); const router = useRouter(); const pagination = useUrlPagination();
  const list = `${base}${params.size ? `?${params}` : ""}`;
  const change = (key: string, value: string) => { const next = new URLSearchParams(params.toString()); next.delete("page"); if (value) next.set(key, value); else next.delete(key); router.replace(`${base}?${next}`, { scroll: false }); };
  return { params, list, change, ...pagination };
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
