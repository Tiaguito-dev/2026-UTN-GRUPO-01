import Link from "next/link";
import type { Feedback } from "@/types/feedback";
import { feedbackComisionHref, feedbackDetalleHref } from "@/validations/feedback";
import { periodoLabel } from "@/lib/format/periodo";
import { modalidadLabel } from "@/validations/materias";
import styles from "./feedback.module.css";

export function FeedbackCard({ feedback, detail = false }: { feedback: Feedback; detail?: boolean }) {
  const context = feedback.contexto;
  return <article className={styles.stack} aria-label={`Comentario de ${feedback.anonimo ? "Anónimo" : feedback.autor?.displayName ?? "Usuario"}`}>
    <div>
      <strong>{feedback.anonimo ? "Anónimo" : feedback.autor?.displayName ?? "Usuario"}</strong>
      {feedback.propio ? <span className={styles.meta}> · Tu comentario</span> : null}
      <p className={styles.meta}>{feedback.profesor ? `Sobre ${feedback.profesor.nombreCompleto}` : "Sobre la comisión en general"}</p>
      <p className={styles.meta}><Link href={feedbackComisionHref(context)}>{context.materiaNombre} · Comisión {context.nombre}</Link> · {periodoLabel(context.anio)} · {modalidadLabel(context.modalidad ?? context.cuatrimestre)}</p>
    </div>
    <p className={styles.text}>{feedback.texto}</p>
    <div className={styles.actions}>
      <time className={styles.meta} dateTime={feedback.createdAt}>{new Date(feedback.createdAt).toLocaleString("es-AR")}</time>
      {feedback.updatedAt !== feedback.createdAt ? <span className={styles.meta}>Editado</span> : null}
      {!detail ? <Link href={feedbackDetalleHref(feedback.id)}>Ver comentario{feedback.propio ? " e historial" : ""}</Link> : null}
    </div>
  </article>;
}
