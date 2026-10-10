import type { Comision } from "../domain/comision.js";
import { validateCrearComisionInput } from "./crear-comision-input.js";
import { ComisionAlreadyExistsError, CursadaNotFoundError } from "./errors.js";
import type { ComisionRepository } from "./ports/comision.repository.js";
import type { CursadaRepository } from "./ports/cursada.repository.js";

export class CrearComision {
  constructor(
    private readonly cursadas: CursadaRepository,
    private readonly comisiones: ComisionRepository,
  ) {}

  async execute(input: unknown): Promise<Comision> {
    const { cursadaId, nombre } = validateCrearComisionInput(input);
    if (!(await this.cursadas.findById(cursadaId))) throw new CursadaNotFoundError();
    // La unicidad es por cursada: el mismo nombre en otra cursada es válido.
    if (await this.comisiones.findByCursadaIdAndNombre(cursadaId, nombre)) throw new ComisionAlreadyExistsError();
    return this.comisiones.create({ cursadaId, nombre });
  }
}
