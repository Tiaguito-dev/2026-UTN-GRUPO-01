import type { MateriaRepository } from "./ports/materia.repository.js";
import { validateId } from "./academic-id.js";
import { validateMateriaPagination } from "./materia-input.js";

export class ListarHistorialMateria {
  constructor(private readonly materias: MateriaRepository) {}
  async execute(idInput: unknown, query: unknown) {
    const id = validateId(idInput);
    const pagination = validateMateriaPagination(query, 3);
    // El repositorio valida existencia física: la auditoría sigue disponible tras la baja.
    return this.materias.findHistorial(id, pagination);
  }
}
