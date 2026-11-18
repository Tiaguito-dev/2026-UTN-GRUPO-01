import type { Pagination, PaginatedResult } from "../../../shared/domain/pagination.js";
import type { SugerenciaAdministrativa } from "../../domain/sugerencia.js";

export interface SugerenciasAdministracionRepository {
  listar(input: Pagination & { soloMeGusta: boolean }): Promise<PaginatedResult<SugerenciaAdministrativa>>;
  cambiarMeGusta(id: string, meGusta: boolean): Promise<SugerenciaAdministrativa>;
  eliminar(id: string): Promise<void>;
}
