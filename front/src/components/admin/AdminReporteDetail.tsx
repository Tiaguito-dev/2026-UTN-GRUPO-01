"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import { useFeedbackResource } from "@/components/feedback/useFeedbackResource";
import { obtenerReporteFeedback, resolverReporteFeedback } from "@/services/feedback-reportes";
import { HttpError } from "@/services/http";
import { reporteMotivos } from "@/validations/feedback-moderation";
import { explicacionModeracion, mensajeErrorModeracion } from "@/validations/feedback-moderation";
import { AdminDecisionDialog, AdminModerationActions, AdminModerationStatus } from "./AdminModerationActions";
import styles from "./AdminModeration.module.css";

export function AdminReporteDetail({ id, returnTo }: { id: string; returnTo: string }) {
  const headingId = useId(); const [page, setPage] = useState(1); const [decision, setDecision] = useState<"RESUELTO" | "DESESTIMADO" | null>(null); const [message, setMessage] = useState(""); const [operationError, setOperationError] = useState("");
  const resource = useFeedbackResource(`reporte:${id}:${page}`, () => obtenerReporteFeedback(id, { page, pageSize: 3 }));
  const data = resource.data;
  const reportOrigin = new URL(returnTo, "https://local.invalid"); reportOrigin.searchParams.set("reporteId", id);
  const label = (motivo: string) => reporteMotivos.find(option => option.value === motivo)?.label ?? motivo;
  return <section className={styles.detail} aria-labelledby={headingId}>
    <PageHeader id={headingId} title="Detalle de reporte" description="Evidencia histórica e identidad disponibles exclusivamente para administración." back={{ href: returnTo, label: "Reportes" }} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Experiencias", href: "/home/admin/experiencias" }, { label: "Reportes", href: returnTo }, { label: "Detalle" }]} />
    {message ? <Notice tone="success">{message}</Notice> : null}
    {operationError ? <Notice tone="error">{operationError}</Notice> : null}
    {resource.error ? <Notice tone="error">Lo sentimos. No pudimos recuperar el reporte. Intentá nuevamente. <button className="button button-secondary" type="button" onClick={resource.retry}>Reintentar</button></Notice> : !data ? <p role="status">Cargando reporte…</p> : <>
      <section className={styles.card} aria-label="Versión denunciada"><h2>Contenido exacto de la versión denunciada</h2><p className={styles.content}>{data.evidencia.texto}</p><dl>
        <div><dt>Versión denunciada</dt><dd>{data.reporte.versionReportada}</dd></div><div><dt>Materia</dt><dd>{data.experiencia.contexto.materiaNombre}</dd></div><div><dt>Comisión</dt><dd>{data.experiencia.contexto.nombre} · {data.experiencia.contexto.anio}</dd></div><div><dt>Valoración de esta versión</dt><dd>{data.evidencia.puntuacion ?? "Sin valoración"}</dd></div>
      </dl><Link className="button button-secondary" href={`/home/admin/experiencias/${encodeURIComponent(data.reporte.feedbackId)}?${new URLSearchParams({ returnTo: `${reportOrigin.pathname}${reportOrigin.search}` })}`}>Ver experiencia actual e historial</Link></section>
      <section className={styles.card} aria-label="Datos del reporte"><h2>Reporte</h2><dl>
        <div><dt>Motivo</dt><dd>{label(data.reporte.motivo)}</dd></div><div><dt>Descripción</dt><dd className={styles.content}>{data.reporte.descripcion ?? "Sin descripción"}</dd></div><div><dt>Denunciante</dt><dd>{data.reporte.denunciante.displayName}<br />ID: {data.reporte.denunciante.id}</dd></div><div><dt>Fecha de creación</dt><dd>{new Date(data.reporte.createdAt).toLocaleString("es-AR")}</dd></div><div><dt>Estado del reporte</dt><dd>{data.reporte.estado === "ABIERTO" ? "Abierto" : data.reporte.estado === "RESUELTO" ? "Resuelto" : "Desestimado"}</dd></div><div><dt>Denunciantes distintos con reportes abiertos</dt><dd>{data.denunciantesAbiertos}</dd></div>
      </dl>{data.reporte.justificacion ? <p>Justificación de resolución: {explicacionModeracion(data.reporte.justificacion, "La resoluci\u00f3n qued\u00f3 registrada. Consult\u00e1 el historial para revisar sus antecedentes.")}</p> : null}{data.reporte.resolvedAt ? <p>Fecha de resolución: {new Date(data.reporte.resolvedAt).toLocaleString("es-AR")}</p> : null}
        {data.reporte.estado === "ABIERTO" ? <div className={styles.actions}><button className="button button-secondary" type="button" onClick={() => setDecision("RESUELTO")}>Resolver reporte</button><button className="button button-secondary" type="button" onClick={() => setDecision("DESESTIMADO")}>Desestimar reporte</button></div> : null}
        <p>Cerrar un reporte no vuelve a publicar la experiencia ni levanta el ocultamiento preventivo.</p>
      </section>
      <section className={styles.card} aria-label="Situación actual de la experiencia"><h2>Situación actual de la experiencia</h2><AdminModerationStatus record={{ ...data.experiencia }} /><AdminModerationActions id={data.reporte.feedbackId} record={{ ...data.experiencia }} own denunciantesAbiertos={data.denunciantesAbiertos} onRefresh={conflict => { setOperationError(conflict ? "La experiencia cambió. Actualizamos la información; revisá su estado antes de decidir nuevamente." : ""); if (!conflict) setMessage("La decisión de moderación se registró correctamente."); resource.retry(); }} /></section>
      <section className={styles.card} aria-label="Historial de resoluciones"><h2>Historial de resoluciones de esta experiencia</h2>{data.resolucionesAnteriores.items.length ? <ul>{data.resolucionesAnteriores.items.map(item => <li key={item.id}><p>{label(item.motivo)} · {item.estado === "RESUELTO" ? "Resuelto" : "Desestimado"}</p><p>{explicacionModeracion(item.justificacion, "La resoluci\u00f3n qued\u00f3 registrada. Su justificaci\u00f3n no est\u00e1 disponible en un formato legible.")}</p><p>{item.resolvedAt ? new Date(item.resolvedAt).toLocaleString("es-AR") : "Fecha no registrada"}</p></li>)}</ul> : <p>No hay resoluciones anteriores.</p>}<Pagination page={page} pageSize={3} total={data.resolucionesAnteriores.total} onChange={setPage} /></section>
      {decision ? <AdminDecisionDialog title={decision === "RESUELTO" ? "Resolver reporte" : "Desestimar reporte"} impact="El reporte dejará de contar como abierto. La moderación y las causas de ocultamiento de la experiencia permanecerán sin cambios." onClose={() => setDecision(null)} onConfirm={async motivo => {
        try { await resolverReporteFeedback(id, { estado: decision, motivo }); }
        catch (error) {
          if (error instanceof HttpError && error.status === 409) { setOperationError(mensajeErrorModeracion(error)); setDecision(null); resource.retry(); }
          throw error;
        }
        setOperationError(""); setDecision(null); setMessage("El reporte se cerró correctamente. Revisá la situación de la experiencia antes de decidir una restitución."); resource.retry();
      }} /> : null}
    </>}
  </section>;
}
