import { z } from "zod";
import type { CursadaRepository } from "./ports/cursada.repository.js";
import type { MateriaRepository } from "./ports/materia.repository.js";
import { validateId } from "./academic-id.js";
import { ANIO_MINIMO, anioMaximo } from "./crear-cursada-input.js";
import { CursadaNotFoundError, MateriaNotFoundError, CursadaAlreadyExistsError, InvalidAcademicInputError, CAMPOS_NO_PERMITIDOS } from "./errors.js";
export class ActualizarCursada {
  constructor(private readonly materias: MateriaRepository, private readonly cursadas: CursadaRepository) {}
  async execute(idInput: unknown, body: unknown) {
    const id = validateId(idInput);
    const result = z.strictObject({ materiaId: z.string().uuid().optional(),
      anio: z.number().int().min(ANIO_MINIMO).max(anioMaximo()).optional(), cuatrimestre: z.enum(["PRIMERO", "SEGUNDO", "ANUAL"]).optional()
    }).refine(value => Object.values(value).some(v => v !== undefined)).safeParse(body);
    if (!result.success) throw new InvalidAcademicInputError(result.error.issues.some(i => i.code === "unrecognized_keys") ? CAMPOS_NO_PERMITIDOS : "Los campos de la cursada no son validos.");
    const current = await this.cursadas.findById(id);
    if (!current) throw new CursadaNotFoundError();
    const effective = { ...current, ...result.data };
    if (!await this.materias.findById(effective.materiaId)) throw new MateriaNotFoundError();
    const duplicate = await this.cursadas.findByPeriodo(effective.materiaId, effective.anio, effective.cuatrimestre);
    if (duplicate && duplicate.id !== id) throw new CursadaAlreadyExistsError();
    return this.cursadas.update(id, result.data);
  }
}
