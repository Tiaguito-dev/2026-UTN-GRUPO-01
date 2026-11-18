import { randomUUID } from "node:crypto";
import type { Feedback, Prisma } from "../../generated/prisma/client.js";
import type { FeedbackModerationAction, FeedbackModerationTransition, FeedbackModerationState } from "../domain/feedback-moderation.js";
import { lockMateriaVote, syncMateriaVote } from "./prisma-feedback-rating.js";

/** Caller holds commission -> Feedback locks. Reuses the caller's transaction, never nests one. */
export async function persistFeedbackModeration(
  tx: Prisma.TransactionClient, row: Feedback, actorId: string,
  accion: FeedbackModerationAction, decision: FeedbackModerationTransition,
): Promise<FeedbackModerationState> {
  if (!decision.changed) return decision.state;
  await lockMateriaVote(tx, row.autorId, row.materiaId);
  const now = new Date();
  const eventId = randomUUID();
  const fields = Object.keys(decision.state) as (keyof FeedbackModerationState)[];
  const display = (value: string | number | boolean | null): string | null => value === null ? null : String(value);
  const cambios: { campo: string; anterior: string | null; nuevo: string | null }[] = fields.filter(field => row[field] !== decision.state[field]).map(field => ({
    campo: field, anterior: display(row[field]), nuevo: display(decision.state[field]),
  }));
  if (decision.motivo !== null) cambios.push({ campo: "motivo", anterior: null, nuevo: decision.motivo });
  if (accion === "OCULTAMIENTO_REPORTES" || accion === "RESTITUCION_REPORTES") {
    cambios.push({ campo: "origen", anterior: null, nuevo: accion === "OCULTAMIENTO_REPORTES" ? "AUTOMATICO" : "ADMINISTRATIVO" });
  }
  await tx.feedback.update({ where: { id: row.id }, data: {
    ...decision.state, updatedAt: now,
    historial: { create: {
      id: eventId, accion, texto: row.texto, puntuacion: row.puntuacion,
      anonimo: row.anonimo, ...decision.state, motivoModeracion: decision.motivo, createdAt: now,
    } },
  } });
  cambios.push(...await syncMateriaVote(tx, row.autorId, row.materiaId, now));
  await tx.administracionHistorial.create({ data: {
    id: eventId, entidad: "feedback", entidadId: row.id, actorId,
    accion, cambios, createdAt: now,
  } });
  return decision.state;
}
