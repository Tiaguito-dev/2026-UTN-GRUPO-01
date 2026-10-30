import type { Comision } from "../domain/comision.js";
import { validateCrearComisionInput } from "./crear-comision-input.js";
import { ComisionAlreadyExistsError, CursadaNotFoundError, InvalidAcademicInputError } from "./errors.js";
import type { ComisionRepository } from "./ports/comision.repository.js";
import type { CursadaRepository } from "./ports/cursada.repository.js";
import type { MateriaRepository } from "./ports/materia.repository.js";

export class CrearComision {
  constructor(
    private readonly cursadas: CursadaRepository,
    private readonly comisiones: ComisionRepository,
    private readonly materias: MateriaRepository,
  ) {}

  async execute(input: unknown, actorId?: string): Promise<Comision> {
    const datos = validateCrearComisionInput(input);
    const cursada = await this.cursadas.findById(datos.cursadaId);
    if (!cursada) throw new CursadaNotFoundError();
    const carreras = await this.materias.findCarreras(cursada.materiaId);
    if (!carreras.length) {
      throw new InvalidAcademicInputError("La materia no tiene carreras asociadas. Asociá al menos una carrera a la materia antes de crear una comisión.");
    }
    const carrera = datos.carrera ?? (carreras.length === 1 ? carreras[0] : undefined);
    if (!carrera) throw new InvalidAcademicInputError("Elegí una carrera de la materia para crear la comisión.");
    if (!carreras.includes(carrera)) {
      throw new InvalidAcademicInputError("La carrera no corresponde a la materia de la cursada.");
    }
    if (await this.comisiones.findByCursadaIdCarreraNumero(datos.cursadaId, carrera, datos.numero)) {
      throw new ComisionAlreadyExistsError();
    }
    return this.comisiones.create({ ...datos, carrera }, actorId);
  }
}
