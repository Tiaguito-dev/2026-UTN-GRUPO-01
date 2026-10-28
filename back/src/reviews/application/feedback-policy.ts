import { FeedbackClosedError, FeedbackForbiddenError, FeedbackInputError } from "./errors.js";

export function assertFeedbackOwner(autorId: string, viewer: string): void {
  if (autorId !== viewer) throw new FeedbackForbiddenError();
}

export function assertFeedbackOpen(activa: boolean): void {
  if (!activa) throw new FeedbackClosedError();
}

/** The target is chosen once, at publication. Later text/visibility edits keep that target. */
export function selectFeedbackProfesor<T extends { profesorId: string | null }>(rows: T[], selected: string | null | undefined): T | undefined {
  const docentes = rows.filter((row) => row.profesorId !== null);
  const docente = selected ? docentes.find((row) => row.profesorId === selected)
    : docentes.length === 1 ? docentes[0] : undefined;
  if (selected && !docente) throw new FeedbackInputError("El docente seleccionado no pertenece a esta comisión. Actualice la información e intente nuevamente.");
  return docente;
}
