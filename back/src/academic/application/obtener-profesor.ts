import type { ProfesorRepository } from "./ports/profesor.repository.js";
import { validateId } from "./academic-id.js";
import { ProfesorNotFoundError } from "./errors.js";
export class ObtenerProfesor {
  constructor(private readonly profesores: ProfesorRepository) {}
  async execute(id: unknown) {
    const profesor = await this.profesores.findById(validateId(id));
    if (!profesor) throw new ProfesorNotFoundError();
    return profesor;
  }
}
