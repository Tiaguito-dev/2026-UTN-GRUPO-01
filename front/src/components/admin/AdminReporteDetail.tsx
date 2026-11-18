"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { useId, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Notice } from "@/components/ui/Notice";
import { Pagination } from "@/components/ui/Pagination";
import { useFeedbackResource } from "@/components/feedback/useFeedbackResource";
import { obtenerReporteFeedback, resolverReporteFeedback } from "@/services/feedback-reportes";
import { HttpError } from "@/services/http";
import { reporteMotivos, explicacionModeracion, mensajeErrorModeracion } from "@/validations/feedback-moderation";
import { AdminDecisionDialog, AdminModerationActions, AdminModerationStatus } from "./AdminModerationActions";
import { AdminReporteEstado } from "./AdminReporteEstado";
import styles from "./AdminReportes.module.css";

const fecha = (value: string) => new Date(value).toLocaleString("es-AR");
const motivoLabel = (value: string) => reporteMotivos.find(option => option.value === value)?.label ?? value;

export function AdminReporteDetail({ id, returnTo }: { id: string; returnTo: string }) {
  const headingId = useId();
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<"RESUELTO" | "DESESTIMADO" | null>(null);
  const [message, setMessage] = useState("");
  const [operationError, setOperationError] = useState("");
  const resource = useFeedbackResource(`reporte:${id}:${page}`, () => obtenerReporteFeedback(id, { page, pageSize: 3 }));
  const data = resource.data;
  const reportOrigin = new URL(returnTo, "https://local.invalid"); reportOrigin.searchParams.set("reporteId", id);
  return <section className={styles.page} aria-labelledby={headingId}>
    <header className={styles.header}>
      <PageHeader id={headingId} title="Detalle de reporte" description="Revisá la evidencia de esta denuncia y distinguí su resolución de las decisiones sobre la experiencia." back={{ href: returnTo, label: "Reportes" }} breadcrumb={[{ label: "Administración", href: "/home/admin" }, { label: "Experiencias", href: "/home/admin/experiencias" }, { label: "Reportes", href: returnTo }, { label: "Detalle" }]} />
      {data ? <div className={styles.headerState}><span>Estado del reporte</span><AdminReporteEstado estado={data.reporte.estado} /></div> : null}
    </header>
    {message ? <Notice tone="success">{message}</Notice> : null}
    {operationError ? <Notice tone="error">{operationError}</Notice> : null}
    {resource.error ? <Notice tone="error">Lo sentimos. No pudimos recuperar el reporte. Intentá nuevamente. <button className="button button-secondary" type="button" onClick={resource.retry}>Reintentar</button></Notice> : !data ? <p role="status">Cargando reporte…</p> : <>
      <div className={styles.detailGrid}>
        <div className={styles.primaryColumn}>
          <section className={`${styles.card} ${styles.evidence}`} aria-label="Versión denunciada">
            <h2>Contenido denunciado</h2>
            <p className={styles.helper}>Evidencia histórica · Versión {data.reporte.versionReportada}. Puede diferir del contenido actual.</p>
            <blockquote className={styles.snapshot}>{data.evidencia.texto}</blockquote>
            <dl className={styles.metadata}>
              <div><dt>Materia</dt><dd>{data.experiencia.contexto.materiaNombre}</dd></div>
              <div><dt>Comisión</dt><dd>{data.experiencia.contexto.nombre} · {data.experiencia.contexto.anio}</dd></div>
              <div><dt>Versión denunciada</dt><dd>{data.reporte.versionReportada}</dd></div>
              <div><dt>Valoración de esta versión</dt><dd>{data.evidencia.puntuacion === null ? "Sin valoración" : `${data.evidencia.puntuacion} / 5`}</dd></div>
            </dl>
            <Link className="button button-secondary" href={`/home/admin/experiencias/${encodeURIComponent(data.reporte.feedbackId)}?${new URLSearchParams({ returnTo: `${reportOrigin.pathname}${reportOrigin.search}` })}`}>Ver experiencia actual e historial</Link>
          </section>
          <section className={`${styles.card} ${data.experiencia.ocultoReportes ? styles.preventive : ""}`} aria-label="Situación actual de la experiencia">
            <h2>Situación actual de la experiencia</h2>
            <AdminModerationStatus record={{ ...data.experiencia }} detailed />
            <p className={styles.count}><strong>{data.denunciantesAbiertos}</strong> {data.denunciantesAbiertos === 1 ? "denunciante distinto con reportes abiertos" : "denunciantes distintos con reportes abiertos"}</p>
            {data.experiencia.ocultoReportes ? <Notice tone="warning">Esta experiencia permanece oculta para la comunidad mientras administración revisa los reportes recibidos.</Notice> : null}
            <h3 className={styles.sectionTitle}>Acciones sobre la experiencia</h3>
            <AdminModerationActions id={data.reporte.feedbackId} record={{ ...data.experiencia }} own reportPresentation denunciantesAbiertos={data.denunciantesAbiertos} onRefresh={conflict => {
              setOperationError(conflict ? "La experiencia cambió. Actualizamos la información; revisá su estado antes de decidir nuevamente." : "");
              if (!conflict) setMessage("La decisión de moderación se registró correctamente."); resource.retry();
            }} />
          </section>
          <section className={styles.card} aria-label="Historial de resoluciones">
            <h2>Historial de resoluciones de esta experiencia</h2>
            <p className={styles.helper}>Decisiones registradas sobre los reportes recibidos.</p>
            {data.resolucionesAnteriores.items.length ? <ol className={styles.timeline}>{data.resolucionesAnteriores.items.map(item => <li key={item.id}>
              <div className={styles.eventHeading}><AdminReporteEstado estado={item.estado} /><span>{motivoLabel(item.motivo)}</span></div>
              <p>{explicacionModeracion(item.justificacion, "La resolución quedó registrada. Su justificación no está disponible en un formato legible.")}</p>
              <p className={styles.helper}>{item.resolvedAt ? <time dateTime={item.resolvedAt}>{fecha(item.resolvedAt)}</time> : "Fecha no registrada"}</p>
              {item.administradorId ? <p className={styles.identifier}>Administrador responsable · ID: {item.administradorId}</p> : null}
            </li>)}</ol> : <p className={styles.empty}>No hay resoluciones anteriores.</p>}
            <Pagination page={page} pageSize={3} total={data.resolucionesAnteriores.total} onChange={setPage} />
          </section>
        </div>
        <div className={styles.secondaryColumn}>
          <section className={styles.card} aria-label="Datos del reporte">
            <h2>Información del reporte</h2>
            <dl className={styles.facts}>
              <div><dt>Motivo</dt><dd><strong>{motivoLabel(data.reporte.motivo)}</strong></dd></div>
              <div><dt>Descripción</dt><dd className={styles.content}>{data.reporte.descripcion ?? "Sin descripción"}</dd></div>
              <div><dt>Fecha de creación</dt><dd><time dateTime={data.reporte.createdAt}>{fecha(data.reporte.createdAt)}</time></dd></div>
            </dl>
          </section>
          <section className={styles.card} aria-label="Identidad del denunciante">
            <h2>Denunciante</h2>
            <div className={styles.identity}><span className={styles.avatar}><UserRound size={22} aria-hidden="true" /></span><strong>{data.reporte.denunciante.displayName}</strong></div>
            <p className={styles.identifier}>ID: {data.reporte.denunciante.id}</p>
            <p className={styles.helper}>Identidad disponible exclusivamente para administración.</p>
          </section>
          <section className={styles.card} aria-label="Estado y resolución del reporte">
            <h2>Resolución del reporte</h2>
            <AdminReporteEstado estado={data.reporte.estado} />
            {data.reporte.estado === "ABIERTO" ? <div className={styles.reportActions}>
              <button className="button button-secondary" type="button" onClick={() => setDecision("RESUELTO")}>Resolver reporte</button>
              <button className="button button-secondary" type="button" onClick={() => setDecision("DESESTIMADO")}>Desestimar reporte</button>
            </div> : <dl className={styles.facts}>
              <div><dt>Decisión administrativa</dt><dd>{data.reporte.estado === "RESUELTO" ? "Reporte resuelto" : "Reporte desestimado"}</dd></div>
              <div><dt>Justificación de resolución</dt><dd className={styles.content}>{explicacionModeracion(data.reporte.justificacion, "La resolución quedó registrada. Consultá el historial para revisar sus antecedentes.")}</dd></div>
              {data.reporte.resolvedAt ? <div><dt>Fecha de resolución</dt><dd><time dateTime={data.reporte.resolvedAt}>{fecha(data.reporte.resolvedAt)}</time></dd></div> : null}
              {data.reporte.administradorId ? <div><dt>Administrador responsable</dt><dd className={styles.identifier}>ID: {data.reporte.administradorId}</dd></div> : null}
            </dl>}
            <p className={styles.helper}>Cerrar un reporte no vuelve a publicar la experiencia ni levanta el ocultamiento preventivo.</p>
            {data.experiencia.ocultoReportes ? <p className={styles.helper}>{data.denunciantesAbiertos < 2 ? "Para levantar esta restricción, usá Restituir ocultamiento preventivo en Situación actual de la experiencia y confirmá la justificación. Las demás causas de ocultamiento seguirán vigentes." : "Resolvé o desestimá reportes hasta que haya menos de dos denunciantes distintos con reportes abiertos. Después podrás usar Restituir ocultamiento preventivo en Situación actual de la experiencia."}</p> : null}
          </section>
        </div>
      </div>
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
