import { z } from "zod";
import type { NormasRepository } from "./ports/normas.repository.js";
import { NormasInvalidasError } from "./errors.js";

const inputSchema = z.strictObject({
  titulo: z.string().trim().min(1).max(160),
  introduccion: z.string().trim().min(1),
  normas: z.array(z.string().trim().min(1)).min(1),
  cierre: z.string().trim().min(1),
});
const actorSchema = z.string().uuid();

export class ActualizarNormas {
  constructor(private readonly normas: Pick<NormasRepository, "actualizarVigentes">) {}

  async execute(body: unknown, actorIdInput: unknown) {
    const actor = actorSchema.safeParse(actorIdInput);
    if (!actor.success) throw new NormasInvalidasError("El administrador responsable no es válido.");
    const result = inputSchema.safeParse(body);
    if (!result.success) {
      throw new NormasInvalidasError(result.error.issues.some(issue => issue.code === "unrecognized_keys")
        ? "La solicitud contiene campos no permitidos."
        : "Completá todos los campos e incluí al menos una norma. El título admite hasta 160 caracteres.");
    }
    return this.normas.actualizarVigentes(result.data, actor.data);
  }
}
