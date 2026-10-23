import type { MateriaRepository } from "./ports/materia.repository.js";
import { validateId } from "./academic-id.js";
import { validateMateriaPagination } from "./materia-input.js";
import { MateriaNotFoundError } from "./errors.js";

export class ListarHistorialMateria {
  constructor(private readonly materias: MateriaRepository) {}
  async execute(idInput: unknown, query: unknown) {
    const id = validateId(idInput);
    const pagination = validateMateriaPagination(query, 3);
    if (!await this.materias.findById(id)) throw new MateriaNotFoundError();
    return this.materias.findHistorial(id, pagination);
  }
}
