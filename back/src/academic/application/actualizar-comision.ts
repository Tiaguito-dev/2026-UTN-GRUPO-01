import { z } from "zod";
import type { CursadaRepository } from "./ports/cursada.repository.js";
import type { ComisionRepository } from "./ports/comision.repository.js";
import type { MateriaRepository } from "./ports/materia.repository.js";
import { carreraSchema } from "./materia-input.js";
import { validateId } from "./academic-id.js";
import { ComisionNotFoundError, CursadaNotFoundError, ComisionAlreadyExistsError, InvalidAcademicInputError, CAMPOS_NO_PERMITIDOS } from "./errors.js";
const schema = z.strictObject({ carrera: carreraSchema.optional(), numero: z.number().int().min(1).max(999).optional() })
  .refine(value => Object.values(value).some(v => v !== undefined));
export class ActualizarComision {
  constructor(private readonly cursadas: CursadaRepository, private readonly comisiones: ComisionRepository, private readonly materias: MateriaRepository) {}
  async execute(idInput: unknown, body: unknown, actorIdInput?: unknown) {
    const id = validateId(idInput);
    const actorId = actorIdInput === undefined ? undefined : validateId(actorIdInput);
    const result = schema.safeParse(body);
    if (!result.success) throw new InvalidAcademicInputError(result.error.issues.some(i => i.code === "unrecognized_keys") ? CAMPOS_NO_PERMITIDOS : "Indique carrera y numero validos.");
    const current = await this.comisiones.findById(id);
    if (!current) throw new ComisionNotFoundError();
    const cursada = await this.cursadas.findById(current.cursadaId);
    if (!cursada) throw new CursadaNotFoundError();
    const effective = { ...current, ...result.data };
    if (!(await this.materias.findCarreras(cursada.materiaId)).includes(effective.carrera)) throw new InvalidAcademicInputError("La carrera no corresponde a la materia de la cursada.");
    const duplicate = await this.comisiones.findByCursadaIdCarreraNumero(current.cursadaId, effective.carrera, effective.numero);
    if (duplicate && duplicate.id !== id) throw new ComisionAlreadyExistsError();
    return actorId ? this.comisiones.update(id, result.data, actorId) : this.comisiones.update(id, result.data);
  }
}
