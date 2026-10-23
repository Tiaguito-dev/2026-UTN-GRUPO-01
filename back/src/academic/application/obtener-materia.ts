import type { MateriaRepository } from "./ports/materia.repository.js";
import { validateId } from "./academic-id.js";
import { MateriaNotFoundError } from "./errors.js";

export class ObtenerMateria {
  constructor(private readonly materias: MateriaRepository) {}
  async execute(id: unknown) {
    const materia = await this.materias.findById(validateId(id));
    if (!materia) throw new MateriaNotFoundError();
    return materia;
  }
}
