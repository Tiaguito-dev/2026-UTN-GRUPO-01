import { z } from "zod";
import type { ProfesorAsignado } from "../domain/comision.js";
import { validateId } from "./academic-id.js";
import { CAMPOS_NO_PERMITIDOS, ComisionNotFoundError, InvalidAcademicInputError, ProfesorNotFoundError } from "./errors.js";
import type { ComisionRepository } from "./ports/comision.repository.js";
import type { ProfesorRepository } from "./ports/profesor.repository.js";

const cargoSchema = z.strictObject({ cargo: z.enum(["TITULAR", "ADJUNTO", "JTP"]) });

export function validateAsignarProfesorInput(value: unknown): z.infer<typeof cargoSchema> {
  const result = cargoSchema.safeParse(value);
  if (result.success) return result.data;
  if (result.error.issues[0]?.code === "unrecognized_keys") throw new InvalidAcademicInputError(CAMPOS_NO_PERMITIDOS);
  throw new InvalidAcademicInputError("El cargo debe ser TITULAR, ADJUNTO o JTP.");
}

export class AsignarProfesorComision {
  constructor(
    private readonly comisiones: ComisionRepository,
    private readonly profesores: ProfesorRepository,
  ) {}

  async execute(comisionIdInput: unknown, profesorIdInput: unknown, body: unknown): Promise<ProfesorAsignado> {
    const comisionId = validateId(comisionIdInput);
    const profesorId = validateId(profesorIdInput);
    const { cargo } = validateAsignarProfesorInput(body);
    if (!(await this.comisiones.findById(comisionId))) throw new ComisionNotFoundError();
    const profesor = await this.profesores.findById(profesorId);
    if (!profesor) throw new ProfesorNotFoundError();
    await this.comisiones.asignarProfesor(comisionId, profesorId, cargo);
    return { id: profesor.id, nombreCompleto: profesor.nombreCompleto, cargo };
  }
}
