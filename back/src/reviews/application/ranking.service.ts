import type { PaginatedResult } from "../../shared/domain/pagination.js";
import { coincideNombre, rankingComisiones, rankingComisionesHistorico, rankingProfesores, todosLosProfesores, type RankingComision, type RankingComisionHistorica, type RankingProfesor } from "../domain/ranking.js";
import { RankingProfesorNotFoundError } from "./errors.js";
import { validateFeedbackId, validateRankingComisionesQuery, validateRankingProfesoresQuery } from "./feedback-input.js";
import type { RankingRepository } from "./ports/ranking.repository.js";

const paginar = <T>(items: T[], page: number, pageSize: number): PaginatedResult<T> =>
  ({ items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize });

/** Rankings are computed per request from live votes; see TASK-ranking-profesores-comisiones. */
// ponytail: ranks every commission in memory; move ORDER BY/LIMIT to SQL if the faculty outgrows it.
export class RankingService {
  constructor(private readonly repository: RankingRepository) {}

  /** Each commission across all its years, ordered by Bayesian average; see TASK-ranking-historico-comisiones. */
  async comisiones(query: unknown): Promise<PaginatedResult<RankingComisionHistorica>> {
    const { page, pageSize, minValoraciones, materiaId } = validateRankingComisionesQuery(query);
    const filas = (await this.repository.filasValoracion()).filter(fila => !materiaId || fila.materiaId === materiaId);
    return paginar(rankingComisionesHistorico(filas, minValoraciones), page, pageSize);
  }

  /** Commissions of one cursada, best first: the source of the "Mejor valorada" badge. */
  async comisionesDeCursada(id: unknown): Promise<RankingComision[]> {
    const cursadaId = validateFeedbackId(id);
    return rankingComisiones((await this.repository.filasValoracion()).filter(fila => fila.cursadaId === cursadaId), 1);
  }

  async profesores(query: unknown): Promise<PaginatedResult<RankingProfesor>> {
    const { page, pageSize, minValoraciones, q } = validateRankingProfesoresQuery(query);
    const filas = await this.repository.filasValoracion();
    if (!q) return paginar(rankingProfesores(filas, minValoraciones), page, pageSize);
    const todos = todosLosProfesores(filas, minValoraciones, await this.repository.profesores());
    return paginar(todos.filter(item => coincideNombre(item.profesor.nombreCompleto, q)), page, pageSize);
  }

  async profesor(id: unknown, query: unknown): Promise<RankingProfesor> {
    const profesorId = validateFeedbackId(id);
    const { minValoraciones } = validateRankingProfesoresQuery(query);
    const [filas, profesores] = await Promise.all([this.repository.filasValoracion(), this.repository.profesores()]);
    const item = todosLosProfesores(filas, minValoraciones, profesores).find(entry => entry.profesor.id === profesorId);
    if (!item) throw new RankingProfesorNotFoundError();
    return item;
  }
}
