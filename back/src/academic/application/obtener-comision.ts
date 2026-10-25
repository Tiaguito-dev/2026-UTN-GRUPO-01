import { validateId } from "./academic-id.js";
import { ComisionNotFoundError } from "./errors.js";
import type { ComisionDetalle } from "../domain/comision.js";
import type { ComisionRepository } from "./ports/comision.repository.js";

export class ObtenerComision {
  constructor(private readonly comisiones: ComisionRepository) {}

  async execute(id: unknown): Promise<ComisionDetalle> {
    const comision = await this.comisiones.findDetalleById(validateId(id));
    if (!comision) throw new ComisionNotFoundError();
    return comision;
  }
}
