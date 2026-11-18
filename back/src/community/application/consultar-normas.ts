import type { NormasConvivencia } from "../domain/normas-convivencia.js";
import type { NormasRepository } from "./ports/normas.repository.js";
import { NormasNoDisponiblesError } from "./errors.js";

export class ConsultarNormas {
  constructor(private readonly normas: NormasRepository) {}

  async execute(): Promise<NormasConvivencia> {
    const documento = await this.normas.obtenerVigentes();
    if (!documento) throw new NormasNoDisponiblesError();
    return documento;
  }
}
