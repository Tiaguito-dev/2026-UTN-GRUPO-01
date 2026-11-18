"use client";

import Link from "next/link";
import { useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useUrlPagination } from "@/hooks/useUrlPagination";
import { listarReportesFeedback } from "@/services/feedback-reportes";
import { reporteMotivos } from "@/validations/feedback-moderation";
import { AdminListResult, AdminSelect } from "./AdminTable";
import { AdminReporteDetail } from "./AdminReporteDetail";
import { AdminReporteEstado } from "./AdminReporteEstado";
import styles from "./AdminReportes.module.css";

const base = "/home/admin/experiencias";
export function AdminExperiencias() {
  const id = useId(); const params = useSearchParams();
  const reportId = params.get("reporteId");
  const query = new URLSearchParams(params.toString()); query.delete("reporteId");
  const list = `${base}?${query}`;
  if (reportId) return <AdminReporteDetail key={reportId} id={reportId} returnTo={list} />;
  return <section className={styles.page} aria-labelledby={id}>
    <header className={styles.header}><PageHeader id={id} title="Reportes de experiencias" description="Revisá las denuncias de la comunidad y consultá la evidencia antes de tomar una decisión." back={{ href: "/home/admin", label: "Administración" }} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Experiencias" }]} /></header>
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
    <section className={styles.filters} aria-label="Filtros de reportes">
      <AdminSelect label="Estado del reporte" value={estado ?? ""} options={[{ value: "ABIERTO", label: "Abiertos" }, { value: "RESUELTO", label: "Resueltos" }, { value: "DESESTIMADO", label: "Desestimados" }]} onChange={value => change("estadoReporte", value)} />
      <AdminSelect label="Motivo" value={motivo ?? ""} options={[...reporteMotivos]} onChange={value => change("motivo", value)} />
      <AdminSelect label="Ocultamiento preventivo" value={rawHidden ?? ""} options={[{ value: "true", label: "Con ocultamiento preventivo" }, { value: "false", label: "Sin ocultamiento preventivo" }]} onChange={value => change("ocultoReportes", value)} />
    </section>
    <AdminListResult state={state} retry={retry} page={page} onPageChange={setPage} loadingMessage="Cargando reportes…">{result => <ul className={styles.reportList} aria-label="Reportes de experiencias">{result.items.map(item => <li key={item.id} className={styles.reportRow}>
      <div className={styles.rowContext}><h2>{item.experiencia.contexto.materiaNombre}</h2><p>Comisión {item.experiencia.contexto.nombre} · {item.experiencia.contexto.anio} · Versión {item.versionReportada}</p></div>
      <div className={styles.rowReason}><strong>{reporteMotivos.find(option => option.value === item.motivo)?.label ?? item.motivo}</strong><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("es-AR")}</time></div>
      <div className={styles.rowState}><AdminReporteEstado estado={item.estado} /><Badge tone={item.experiencia.ocultoReportes ? "soft" : "outline"}>{item.experiencia.ocultoReportes ? "Oculta preventivamente" : "Sin ocultamiento preventivo"}</Badge><span>{item.denunciantesAbiertos} {item.denunciantesAbiertos === 1 ? "denunciante con reportes abiertos" : "denunciantes con reportes abiertos"}</span></div>
      <Link className="button button-secondary" href={`${list}${list.includes("?") ? "&" : "?"}reporteId=${encodeURIComponent(item.id)}`}>Ver reporte<span className={styles.srOnly}> de {item.experiencia.contexto.materiaNombre}, comisión {item.experiencia.contexto.nombre}</span></Link>
    </li>)}</ul>}</AdminListResult>
  </>;
}
