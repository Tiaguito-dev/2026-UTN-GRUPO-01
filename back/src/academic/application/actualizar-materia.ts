import type { MateriaRepository } from "./ports/materia.repository.js";
import type { ComisionRepository } from "./ports/comision.repository.js";
import { validateId } from "./academic-id.js";
import { validateActualizarMateriaInput } from "./materia-input.js";
import { CarreraConComisionesError, MateriaAlreadyExistsError, MateriaNotFoundError } from "./errors.js";

export class ActualizarMateria {
  constructor(private readonly materias: MateriaRepository, private readonly comisiones: ComisionRepository) {}
  async execute(idInput: unknown, body: unknown, actorIdInput: unknown) {
    const id = validateId(idInput);
    const actorId = validateId(actorIdInput);
    const input = validateActualizarMateriaInput(body);
    const materia = await this.materias.findById(id);
    if (!materia) throw new MateriaNotFoundError();
    if (input.carreras) {
      const nuevas = new Set(input.carreras.map((fila) => fila.carrera));
      for (const carrera of await this.materias.findCarreras(id)) {
        // ponytail: chequeo fuera del lock de update; una comisión creada en paralelo puede colarse.
        if (!nuevas.has(carrera) && await this.comisiones.existsByMateriaAndCarrera(id, carrera)) throw new CarreraConComisionesError();
      }
    }
    if (input.nombre !== undefined && input.nombre !== materia.nombre) {
      const duplicate = await this.materias.findByNombre(input.nombre);
      if (duplicate && duplicate.id !== id) throw new MateriaAlreadyExistsError();
    }
    return this.materias.update(id, input, actorId);
  }
}
