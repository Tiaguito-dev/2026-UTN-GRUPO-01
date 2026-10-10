import type { Profesor } from "../domain/profesor.js";
import { validateCrearProfesorInput } from "./crear-profesor-input.js";
import type { ProfesorRepository } from "./ports/profesor.repository.js";

export class CrearProfesor {
  constructor(private readonly profesores: ProfesorRepository) {}

  // Sin chequeo de duplicado: los homónimos son reales y válidos (no hay restricción única).
  async execute(input: unknown): Promise<Profesor> {
    const { nombreCompleto } = validateCrearProfesorInput(input);
    return this.profesores.create({ nombreCompleto });
  }
}
