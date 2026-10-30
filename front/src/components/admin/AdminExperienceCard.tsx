import { MessageSquare, UserRound } from "lucide-react";
import { iniciales } from "@/components/academic/detalle";
import { cargoLabel } from "@/lib/format/cargo";
import { isModalidadMateria, modalidadLabel } from "@/validations/materias";
import shared from "./AdminMateriaDetail.module.css";
import styles from "./AdminExperienceCard.module.css";

const value = (raw: unknown) => typeof raw === "string" && raw.trim() ? raw.trim() : typeof raw === "number" && Number.isFinite(raw) ? String(raw) : null;

function Field({ label, content }: { label: string; content: string | null }) {
  return <div><dt>{label}</dt><dd className={content === null ? `${shared.missing} ${styles.missing}` : undefined}>{content ?? "No registrado"}</dd></div>;
}

/** Present only the recorded snapshot; current academic data must not rewrite its context. */
export function AdminExperienceCard({ record }: { record: Record<string, unknown> }) {
  const authorRecord = record.autor;
  const author = authorRecord && typeof authorRecord === "object" && "displayName" in authorRecord ? value(authorRecord.displayName) : null;
  const content = typeof record.texto === "string" && record.texto.trim() ? record.texto : null;
  const period = record.cuatrimestre === "PRIMERO" ? "Primer cuatrimestre" : record.cuatrimestre === "SEGUNDO" ? "Segundo cuatrimestre" : record.cuatrimestre === "ANUAL" ? "Anual" : null;
  const role = record.profesorCargo;
  const teacherRole = role === "TITULAR" || role === "ADJUNTO" || role === "JTP" ? cargoLabel(role) : null;
  const removed = Boolean(record.deletedAt);
  return <section className={shared.card} aria-label="Datos de la experiencia">
    <div className={shared.cardBody}>
      <div className={styles.identityRow}>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">{author ? iniciales(author) : <UserRound size={22} />}</span>
          <dl className={styles.author}><Field label="Autor" content={author} /></dl>
        </div>
        <dl className={styles.author}><div><dt>Estado</dt><dd><span className={`${shared.status} ${removed ? shared.inactive : shared.active}`}>{removed ? "Eliminado" : "Publicado"}</span></dd></div></dl>
      </div>
      <div className={styles.content}>
        <h2><MessageSquare size={20} aria-hidden="true" />Contenido completo</h2>
        <p className={content === null ? shared.missing : styles.comment}>{content ?? "No registrado"}</p>
      </div>
      <dl className={`${shared.data} ${styles.metadata}`}>
        <Field label="Materia" content={value(record.materiaNombre)} />
        <Field label="Comisión" content={value(record.comisionNombre)} />
        <Field label="Año" content={value(record.anio)} />
        <Field label="Período" content={period} />
        <Field label="Modalidad" content={isModalidadMateria(record.modalidad) ? modalidadLabel(record.modalidad) : null} />
        <Field label="Publicación anónima" content={typeof record.anonimo === "boolean" ? record.anonimo ? "Sí" : "No" : null} />
        <Field label="Docente mencionado" content={value(record.profesorNombre)} />
        <Field label="Cargo en esta comisión" content={teacherRole} />
      </dl>
    </div>
  </section>;
}
