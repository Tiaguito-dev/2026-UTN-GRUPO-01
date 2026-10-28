"use client";

import Link from "next/link";
import { Pencil, ArrowRight } from "lucide-react";
import type { Feedback } from "@/types/feedback";
import { iniciales } from "@/components/academic/detalle";
import { feedbackComisionHref } from "@/validations/feedback";
import { periodoLabel } from "@/lib/format/periodo";
import { modalidadLabel } from "@/validations/materias";
import { carreraLabel } from "@/lib/format/carrera";
import styles from "./feedback.module.css";

/** Public presentation shared by commission and general reading; private actions require propio. */
export function ExperienceCard({ feedback, onManage, showContext = false, origin }: { feedback: Feedback; onManage: () => void; showContext?: boolean; origin?: URLSearchParams }) {
  const author = feedback.anonimo ? "Anónimo" : feedback.autor?.displayName ?? "Usuario";
  const query = origin?.size ? `?${origin}` : "";
  const subjectQuery = new URLSearchParams(origin);
  if (feedback.contexto.carrera) subjectQuery.set("carrera", feedback.contexto.carrera);
  return <article className={`${styles.experienceCard}${feedback.propio ? ` ${styles.experienceCardOwn}` : ""}`} aria-label={`Comentario de ${author}`}>
    <header className={styles.experienceCardHeader}>
      <span className={styles.experienceAvatar} aria-hidden="true">{feedback.anonimo ? "?" : iniciales(author)}</span>
      <div className={styles.experienceAuthor}><strong>{author}</strong>{feedback.propio ? <span className={styles.experienceOwn}>Tu comentario</span> : null}</div>
      <div className={styles.experienceDate}><time dateTime={feedback.createdAt}>{new Date(feedback.createdAt).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })}</time>{feedback.updatedAt !== feedback.createdAt ? <span>Editado</span> : null}</div>
    </header>
    {showContext ? <div className={styles.experienceContext}><Link href={`/home/materias/${encodeURIComponent(feedback.contexto.materiaId)}${subjectQuery.size ? `?${subjectQuery}` : ""}`}>{feedback.contexto.materiaNombre}</Link><p>Comisión {feedback.contexto.nombre}{feedback.contexto.carrera ? ` · ${carreraLabel(feedback.contexto.carrera)}` : ""} · {periodoLabel(feedback.contexto.anio)} · {modalidadLabel(feedback.contexto.modalidad ?? feedback.contexto.cuatrimestre)}</p></div> : null}
    <p className={styles.experienceTarget}>{feedback.profesor ? `Sobre ${feedback.profesor.nombreCompleto}` : "Sobre la comisión en general"}</p>
    <p className={styles.experienceText}>{feedback.texto}</p>
    {feedback.propio || showContext ? <footer className={styles.experienceFooter}>
      {showContext ? <Link className="button button-secondary" href={`${feedbackComisionHref(feedback.contexto)}${query}`}>Ver comisión<ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" /></Link> : null}
      {feedback.propio ? <button className="button button-secondary" type="button" onClick={onManage}><Pencil size={16} strokeWidth={1.75} aria-hidden="true" focusable="false" />Administrar mi comentario</button> : null}
    </footer> : null}
  </article>;
}
