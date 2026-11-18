import { z } from "zod";
import { validatePagination } from "../../shared/domain/pagination-input.js";
import { SugerenciaInvalidaError } from "./errors.js";
import type { SugerenciasAdministracionRepository } from "./ports/sugerencias-administracion.repository.js";

const querySchema = z.object({
  page: z.unknown().optional(), pageSize: z.unknown().optional(),
  soloMeGusta: z.enum(["true", "false"]).default("false"),
}).strict();
const idSchema = z.uuid();
const meGustaSchema = z.object({ meGusta: z.boolean() }).strict();

export class AdministrarSugerencias {
  constructor(private readonly repository: SugerenciasAdministracionRepository) {}

  async listar(query: unknown) {
    const input = querySchema.safeParse(query ?? {});
    if (!input.success) throw new SugerenciaInvalidaError("Los filtros de sugerencias no son válidos.");
    const pagination = validatePagination(query);
    return this.repository.listar({ ...pagination, soloMeGusta: input.data.soloMeGusta === "true" });
  }

  async cambiarMeGusta(id: unknown, body: unknown) {
    const parsedId = this.id(id);
    const input = meGustaSchema.safeParse(body);
    if (!input.success) throw new SugerenciaInvalidaError("Indicá Me gusta como verdadero o falso.");
    return this.repository.cambiarMeGusta(parsedId, input.data.meGusta);
  }

  async eliminar(id: unknown): Promise<void> {
    await this.repository.eliminar(this.id(id));
  }

  private id(value: unknown): string {
    const result = idSchema.safeParse(value);
    if (!result.success) throw new SugerenciaInvalidaError("El identificador de la sugerencia no es válido.");
    return result.data;
  }
}
