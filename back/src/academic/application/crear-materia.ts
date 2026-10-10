import type { Materia } from "../domain/materia.js";
import { validateCrearMateriaInput } from "./crear-materia-input.js";
import { MateriaAlreadyExistsError } from "./errors.js";
import type { MateriaRepository } from "./ports/materia.repository.js";

export class CrearMateria {
  constructor(private readonly materias: MateriaRepository) {}

  async execute(input: unknown): Promise<Materia> {
    const { nombre } = validateCrearMateriaInput(input);
    // Consulta previa para dar un 409 claro; la restricción única de la base es el respaldo
    // real contra la carrera entre dos altas simultáneas (ver el adaptador Prisma).
    if (await this.materias.findByNombre(nombre)) throw new MateriaAlreadyExistsError();
    return this.materias.create({ nombre });
  }
}
