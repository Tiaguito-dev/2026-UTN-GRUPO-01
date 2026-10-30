import { validateId } from "./academic-id.js";
import { validateMateriaPagination } from "./materia-input.js";
import type { AcademicAdministrationRepository, AcademicEntity } from "./ports/academic-administration.repository.js";

export class ListarHistorialAcademico {
  constructor(private readonly repository: AcademicAdministrationRepository) {}

  async execute(entidad: AcademicEntity, idInput: unknown, query: unknown) {
    const id = validateId(idInput);
    const pagination = validateMateriaPagination(query, 3);
    return this.repository.historial(entidad, id, pagination);
  }
}
