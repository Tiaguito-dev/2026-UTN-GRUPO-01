import { validateId } from "./academic-id.js";
import { ComisionNotFoundError, ProfesorNoAsignadoError, ProfesorNotFoundError } from "./errors.js";
import type { ComisionRepository } from "./ports/comision.repository.js";
import type { ProfesorRepository } from "./ports/profesor.repository.js";

export class QuitarProfesorComision {
  constructor(
    private readonly comisiones: ComisionRepository,
    private readonly profesores: ProfesorRepository,
  ) {}

  async execute(comisionIdInput: unknown, profesorIdInput: unknown): Promise<void> {
    const comisionId = validateId(comisionIdInput);
    const profesorId = validateId(profesorIdInput);
    if (!(await this.comisiones.findById(comisionId))) throw new ComisionNotFoundError();
    if (!(await this.profesores.findById(profesorId))) throw new ProfesorNotFoundError();
    if (!(await this.comisiones.quitarProfesor(comisionId, profesorId))) throw new ProfesorNoAsignadoError();
  }
}
