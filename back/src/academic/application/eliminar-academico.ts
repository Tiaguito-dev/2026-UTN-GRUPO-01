import { validateId } from "./academic-id.js";
import type { AcademicAdministrationRepository, AcademicEntity } from "./ports/academic-administration.repository.js";

export class EliminarAcademico {
  constructor(private readonly repository: AcademicAdministrationRepository) {}

  async execute(entidad: AcademicEntity, idInput: unknown, actorIdInput: unknown): Promise<void> {
    const id = validateId(idInput);
    const actorId = validateId(actorIdInput);
    return this.repository.eliminar(entidad, id, actorId);
  }
}
