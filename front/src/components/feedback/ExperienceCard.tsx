"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Pencil, ArrowRight, Eye } from "lucide-react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import type { Feedback } from "@/types/feedback";
import { iniciales } from "@/components/academic/detalle";
import { comisionDetailHref, materiaDetailHref } from "@/validations/admin-academic-navigation";
import { feedbackComisionHref } from "@/validations/feedback";
import { periodoLabel } from "@/lib/format/periodo";
import { modalidadLabel } from "@/validations/materias";
import { carreraLabel } from "@/lib/format/carrera";
import styles from "./feedback.module.css";
import { EstrellasFeedback } from "./FeedbackCard";
import { ReportFeedbackAction } from "./ReportFeedbackAction";
import feedStyles from "./FeedPrincipal.module.css";

/** Public presentation shared by commission and general reading; private actions require propio. */
export function ExperienceCard({ feedback, onManage, onReported, showContext = false, origin, administrative = false, returnTo, readOnly = false, showTime = false, variant, footer, secondaryActions }: { feedback: Feedback; onManage?: () => void; onReported?: () => void; readOnly?: boolean; showTime?: boolean; showContext?: boolean; origin?: URLSearchParams; administrative?: boolean; returnTo?: string; variant?: "inicio"; footer?: ReactNode; secondaryActions?: ReactNode }) {
  const isAdmin = useIsAdmin();
  const author = feedback.anonimo ? "Anónimo" : feedback.autor?.displayName ?? "Usuario";
  const commissionQuery = new URLSearchParams(origin);
  const tracked = origin?.get("origen") === "inicio" || origin?.get("origen") === "experiencias";
  if (tracked) commissionQuery.set("feedbackPaso", origin?.get("feedbackPaso") === "materia" || origin?.get("feedbackPaso") === "materia-comision" ? "materia-comision" : "comision");
  const query = commissionQuery.size ? `?${commissionQuery}` : "";
  const subjectQuery = new URLSearchParams(origin);
  if (tracked) subjectQuery.set("feedbackPaso", "materia");
  if (feedback.contexto.carrera) subjectQuery.set("carrera", feedback.contexto.carrera);
  const subjectHref = administrative ? materiaDetailHref(feedback.contexto.materiaId) : `/home/materias/${encodeURIComponent(feedback.contexto.materiaId)}${subjectQuery.size ? `?${subjectQuery}` : ""}`;
  const commissionHref = administrative ? comisionDetailHref(feedback.contexto.comisionId, returnTo ?? "/home/admin/experiencias") : `${feedbackComisionHref(feedback.contexto)}${query}`;
  return <article className={`${styles.experienceCard}${feedback.propio ? ` ${styles.experienceCardOwn}` : ""}${variant === "inicio" ? ` ${feedStyles.card}` : ""}`} aria-label={`Comentario de ${author}`}>
    <header className={styles.experienceCardHeader}>
      <span className={styles.experienceAvatar} aria-hidden="true">{feedback.anonimo ? "?" : iniciales(author)}</span>
      <div className={styles.experienceAuthor}><strong>{author}</strong>{feedback.propio ? <span className={styles.experienceOwn}>Tu comentario</span> : null}</div>
      <div className={styles.experienceDate}><time dateTime={feedback.createdAt}>{showTime ? new Date(feedback.createdAt).toLocaleString("es-AR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : new Date(feedback.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</time>{feedback.updatedAt !== feedback.createdAt ? <span>Editado</span> : null}</div>
    </header>
    {showContext ? <div className={styles.experienceContext}><Link href={subjectHref}>{feedback.contexto.materiaNombre}</Link><p>Comisión {feedback.contexto.nombre}{feedback.contexto.carrera ? ` · ${carreraLabel(feedback.contexto.carrera)}` : ""} · {periodoLabel(feedback.contexto.anio)} · {modalidadLabel(feedback.contexto.modalidad ?? feedback.contexto.cuatrimestre)}</p></div> : null}
    <p className={styles.experienceTarget}>{feedback.profesor ? `Sobre ${feedback.profesor.nombreCompleto}` : "Sobre la comisión en general"}</p>
    <EstrellasFeedback puntuacion={feedback.puntuacion} />
    <p className={styles.experienceText}>{feedback.texto}</p>
    {secondaryActions ? <div className={feedStyles.secondaryActions}>{secondaryActions}</div> : null}
    {!administrative && !feedback.propio && (!feedback.estadoModeracion || feedback.estadoModeracion === "APROBADO") && !feedback.ocultoAutor && !feedback.ocultoAdministracion && !feedback.ocultoReportes ? <ReportFeedbackAction feedbackId={feedback.id} onReported={onReported} /> : null}
    {footer || (!readOnly && (isAdmin || (!administrative && feedback.propio && onManage))) || showContext ? <footer className={`${styles.experienceFooter}${variant === "inicio" ? ` ${feedStyles.cardFooter}` : ""}`}>
      {footer}
      {isAdmin && !readOnly ? <Link className="button button-secondary" href={`/home/admin/experiencias/${encodeURIComponent(feedback.id)}?${new URLSearchParams({ returnTo: returnTo ?? "/home/admin/experiencias" })}`}><Eye size={16} aria-hidden="true" />Ver detalle y auditoría</Link> : null}
      {showContext ? <Link className="button button-secondary" href={commissionHref}>Ver comisión<ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" /></Link> : null}
      {feedback.propio && !administrative && !readOnly && onManage ? <button className="button button-secondary" type="button" onClick={onManage}><Pencil size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />Administrar mi comentario</button> : null}
    </footer> : null}
  </article>;
}
