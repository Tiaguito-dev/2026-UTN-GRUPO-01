import { z } from "zod";
import type { ProfesorRepository } from "./ports/profesor.repository.js";
import { validateId } from "./academic-id.js";
import { nombreSchema } from "./academic-text.js";
import { ProfesorNotFoundError, InvalidAcademicInputError, CAMPOS_NO_PERMITIDOS } from "./errors.js";
const schema = z.strictObject({ nombreCompleto: nombreSchema(150) });
export class ActualizarProfesor {
  constructor(private readonly profesores: ProfesorRepository) {}
  async execute(idInput: unknown, body: unknown) {
    const id = validateId(idInput);
    const result = schema.safeParse(body);
    if (!result.success) throw new InvalidAcademicInputError(result.error.issues.some(i => i.code === "unrecognized_keys") ? CAMPOS_NO_PERMITIDOS : "Indique un nombre valido de hasta 150 caracteres.");
    if (!await this.profesores.findById(id)) throw new ProfesorNotFoundError();
    return this.profesores.update(id, result.data);
  }
}
