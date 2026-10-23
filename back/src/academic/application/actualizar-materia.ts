import type { MateriaRepository } from "./ports/materia.repository.js";
import { validateId } from "./academic-id.js";
import { resolveNivelElectiva, validateActualizarMateriaInput } from "./materia-input.js";
import { InvalidAcademicInputError, MateriaAlreadyExistsError, MateriaNotFoundError } from "./errors.js";

export class ActualizarMateria {
  constructor(private readonly materias: MateriaRepository) {}
  async execute(idInput: unknown, body: unknown, actorIdInput: unknown) {
    const id = validateId(idInput);
    const actorId = validateId(actorIdInput);
    const input = validateActualizarMateriaInput(body);
    const materia = await this.materias.findById(id);
    if (!materia) throw new MateriaNotFoundError();
    if (!materia.anioCarrera && !input.anioCarrera) {
      throw new InvalidAcademicInputError("Indique un año de carrera entre 1 y 5 o Electiva.");
    }
    resolveNivelElectiva(input.anioCarrera ?? materia.anioCarrera,
      input.nivelElectiva === undefined ? materia.nivelElectiva : input.nivelElectiva);
    if (input.nombre !== undefined && input.nombre !== materia.nombre) {
      const duplicate = await this.materias.findByNombre(input.nombre);
      if (duplicate && duplicate.id !== id) throw new MateriaAlreadyExistsError();
    }
    return this.materias.update(id, input, actorId);
  }
}
