import type { FilaValoracion } from "../../domain/ranking.js";

export const RANKING_REPOSITORY = Symbol("RANKING_REPOSITORY");
export interface RankingRepository {
  filasValoracion(): Promise<FilaValoracion[]>;
  /** Active professors, for search results and profiles without votes. */
  profesores(): Promise<{ id: string; nombreCompleto: string }[]>;
}
