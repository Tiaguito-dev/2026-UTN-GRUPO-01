import Link from "next/link";
import type { ReactNode } from "react";
import type { Feedback } from "@/types/feedback";
import { periodoLabel } from "@/lib/format/periodo";
import { carreraLabel } from "@/lib/format/carrera";
import { modalidadLabel } from "@/validations/materias";
import styles from "./feedback.module.css";

/** Own-comment presentation; the route controls authorized actions and history separately. */
export function FeedbackCard({ feedback, materiaHref, actions }: { feedback: Feedback; materiaHref: string; actions?: ReactNode }) {
  const context = feedback.contexto;
  const edited = new Date(feedback.updatedAt).getTime() > new Date(feedback.createdAt).getTime();
  const identity = feedback.anonimo ? "Anónimo" : feedback.autor?.displayName ?? "Usuario";
  return <article className={styles.privateCard} aria-label="Tu comentario">
    <header className={styles.privateCardTop}>
      <span className={styles.privateOwn}>Tu comentario</span>
      {actions ? <div className={styles.privateActions}>{actions}</div> : null}
    </header>
    <div className={styles.privateContext}>
      <h2><Link href={materiaHref}>{context.materiaNombre}</Link></h2>
      <p>Comisión {context.nombre}{context.carrera ? ` · ${carreraLabel(context.carrera)}` : ""} · {periodoLabel(context.anio)} · {modalidadLabel(context.modalidad ?? context.cuatrimestre)}</p>
      <p className={styles.privateTarget}>{feedback.profesor ? `Sobre ${feedback.profesor.nombreCompleto}` : "Sobre la comisión en general"}</p>
    </div>
    <p className={styles.privateText}>{feedback.texto}</p>
    <footer className={styles.privateFooter}><dl>
      <div><dt>Publicado</dt><dd><time dateTime={feedback.createdAt}>{new Date(feedback.createdAt).toLocaleString("es-AR")}</time></dd></div>
      {edited ? <div><dt>Última edición</dt><dd><time dateTime={feedback.updatedAt}>{new Date(feedback.updatedAt).toLocaleString("es-AR")}</time></dd></div> : null}
      <div><dt>Identidad pública</dt><dd>{identity}</dd></div>
    </dl></footer>
  </article>;
}
