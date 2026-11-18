import { z } from "zod";
import { CATEGORIAS_SUGERENCIA, type SugerenciaRegistrada } from "../domain/sugerencia.js";
import type { SugerenciasRepository } from "./ports/sugerencias.repository.js";
import { SugerenciaInvalidaError } from "./errors.js";

const inputSchema = z.strictObject({
  solicitudId: z.string().uuid(),
  categoria: z.enum(CATEGORIAS_SUGERENCIA),
  contenido: z.string().trim().min(1).max(5000),
});
const usuarioSchema = z.string().uuid();

export class RegistrarSugerencia {
  constructor(private readonly sugerencias: SugerenciasRepository) {}

  async execute(body: unknown, usuarioIdInput: unknown): Promise<SugerenciaRegistrada> {
    const usuario = usuarioSchema.safeParse(usuarioIdInput);
    if (!usuario.success) throw new SugerenciaInvalidaError("No se pudo identificar la cuenta que envía la sugerencia.");
    const result = inputSchema.safeParse(body);
    if (!result.success) {
      throw new SugerenciaInvalidaError(result.error.issues.some(issue => issue.code === "unrecognized_keys")
        ? "La solicitud contiene campos no permitidos."
        : "Elegí una categoría, escribí una sugerencia de hasta 5000 caracteres y enviá una solicitud válida.");
    }
    return this.sugerencias.registrar(result.data, usuario.data);
  }
}
