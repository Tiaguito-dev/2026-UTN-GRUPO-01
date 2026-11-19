import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../src/generated/prisma/client.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { coincideNombre, puntajeBayesiano, rankingComisiones, rankingComisionesHistorico, rankingProfesores, type FilaValoracion } from "../src/reviews/domain/ranking.js";
import { RankingService } from "../src/reviews/application/ranking.service.js";
import { validateGeneralFeedbackQuery, validateRankingComisionesQuery, validateRankingProfesoresQuery } from "../src/reviews/application/feedback-input.js";
import { FeedbackInputError, RankingProfesorNotFoundError } from "../src/reviews/application/errors.js";
import { PrismaRankingRepository } from "../src/reviews/infrastructure/prisma-ranking.repository.js";

function fila(overrides: Partial<FilaValoracion> & Pick<FilaValoracion, "comisionId" | "suma" | "cantidad">): FilaValoracion {
  return {
    comisionNombre: `S-${overrides.comisionId}`, carrera: "S", activa: true,
    materiaId: "m1", materiaNombre: "Paradigmas", cursadaId: "c1", anio: 2026, cuatrimestre: "PRIMERO",
    profesorId: null, profesorNombre: null, cargo: null, ...overrides,
  };
}

describe("Ranking de comisiones", () => {
  it("junta los votos de la comisión aunque vengan separados por profesor", () => {
    const [primera] = rankingComisiones([
      fila({ comisionId: "a", suma: 9, cantidad: 2, profesorId: "p1", profesorNombre: "Ana" }),
      fila({ comisionId: "a", suma: 4, cantidad: 1 }),
    ], 1);
    expect(primera).toEqual({
      posicion: 1,
      comision: { id: "a", nombre: "S-a", carrera: "S", activa: true },
      materia: { id: "m1", nombre: "Paradigmas" },
      cursada: { id: "c1", anio: 2026, cuatrimestre: "PRIMERO" },
      valoracion: { promedio: 4.3, cantidad: 3 },
    });
  });

  it("ordena por promedio bayesiano: una histórica le gana a una nueva con pocos votos perfectos", () => {
    const ranking = rankingComisiones([
      fila({ comisionId: "nueva3", suma: 15, cantidad: 3 }),
      fila({ comisionId: "historica", suma: 184, cantidad: 40 }),
      fila({ comisionId: "nueva15", suma: 75, cantidad: 15 }),
      fila({ comisionId: "resto", suma: 600, cantidad: 200 }),
    ], 1);
    // Media general 874/258 ≈ 3,39: 3 votos de 5 ≈ 3,99; 40 votos de 4,6 ≈ 4,47; 15 votos de 5 ≈ 4,6.
    expect(ranking.map(item => item.comision.id)).toEqual(["nueva15", "historica", "nueva3", "resto"]);
    // Las estrellas que se muestran siguen siendo el promedio real.
    expect(ranking.find(item => item.comision.id === "nueva3")!.valoracion).toEqual({ promedio: 5, cantidad: 3 });
  });

  it("un par de votos bajos casi no mueven a una histórica y desempata por cantidad, nombre e id", () => {
    const media = 3.4;
    expect(puntajeBayesiano({ suma: 184 + 2, cantidad: 42 }, media) - puntajeBayesiano({ suma: 184, cantidad: 40 }, media)).toBeGreaterThan(-0.2);
    const ranking = rankingComisiones([
      fila({ comisionId: "d", comisionNombre: "S-2", suma: 8, cantidad: 2 }),
      fila({ comisionId: "c", comisionNombre: "S-2", suma: 8, cantidad: 2 }),
      fila({ comisionId: "b", comisionNombre: "S-1", suma: 8, cantidad: 2 }),
    ], 1);
    expect(ranking.map(item => [item.posicion, item.comision.id])).toEqual([[1, "b"], [2, "c"], [3, "d"]]);
  });

  it("descarta las comisiones por debajo del mínimo de votos", () => {
    const ranking = rankingComisiones([
      fila({ comisionId: "a", suma: 5, cantidad: 1 }),
      fila({ comisionId: "b", suma: 12, cantidad: 3 }),
    ], 2);
    expect(ranking.map(item => item.comision.id)).toEqual(["b"]);
  });
});

describe("Ranking histórico de comisiones", () => {
  const filas = [
    fila({ comisionId: "s41-2024", comisionNombre: "S-41", materiaId: "agiles", materiaNombre: "Ágiles", cursadaId: "c2024", anio: 2024, cuatrimestre: "SEGUNDO", activa: false, suma: 9, cantidad: 2 }),
    fila({ comisionId: "s41-2026", comisionNombre: "S-41", materiaId: "agiles", materiaNombre: "Ágiles", cursadaId: "c2026", anio: 2026, cuatrimestre: "SEGUNDO", suma: 10, cantidad: 2, profesorId: "p1", profesorNombre: "Sitnyk" }),
    fila({ comisionId: "s41-2026", comisionNombre: "S-41", materiaId: "agiles", materiaNombre: "Ágiles", cursadaId: "c2026", anio: 2026, cuatrimestre: "SEGUNDO", suma: 4, cantidad: 1 }),
    fila({ comisionId: "s41-otra", comisionNombre: "S-41", materiaId: "otra", materiaNombre: "Otra", cursadaId: "c9", anio: 2026, suma: 3, cantidad: 1 }),
  ];

  it("junta todas las cursadas de la misma materia y comisión, con la más reciente primero", () => {
    const [agiles, otra] = rankingComisionesHistorico(filas, 1);
    expect(agiles).toEqual({
      posicion: 1,
      comision: { nombre: "S-41", carrera: "S" },
      materia: { id: "agiles", nombre: "Ágiles" },
      cursadas: [
        { id: "c2026", anio: 2026, cuatrimestre: "SEGUNDO", comisionId: "s41-2026", activa: true },
        { id: "c2024", anio: 2024, cuatrimestre: "SEGUNDO", comisionId: "s41-2024", activa: false },
      ],
      anios: { desde: 2024, hasta: 2026 },
      valoracion: { promedio: 4.6, cantidad: 5 },
    });
    // Mismo número de comisión en otra materia: es otra comisión histórica.
    expect(otra).toMatchObject({ posicion: 2, materia: { id: "otra" }, valoracion: { cantidad: 1 } });
  });

  it("aplica el mínimo de votos a la comisión histórica completa", () => {
    expect(rankingComisionesHistorico(filas, 3).map(item => item.materia.id)).toEqual(["agiles"]);
  });
});

describe("Ranking de profesores", () => {
  const filas = [
    fila({ comisionId: "a", suma: 5, cantidad: 1, profesorId: "p1", profesorNombre: "Ana", cargo: "TITULAR" }),
    fila({ comisionId: "b", comisionNombre: "I-2", carrera: "I", suma: 60, cantidad: 20, profesorId: "p1", profesorNombre: "Ana", cargo: null }),
    fila({ comisionId: "a", suma: 18, cantidad: 4, profesorId: "p2", profesorNombre: "Beto", cargo: "JTP" }),
    fila({ comisionId: "a", suma: 30, cantidad: 6 }),
  ];

  it("agrupa por comisión y promedia el total ponderado por votos", () => {
    const [primero, segundo] = rankingProfesores(filas, 1);
    expect(primero).toMatchObject({ posicion: 1, profesor: { id: "p2", nombreCompleto: "Beto" }, valoracion: { promedio: 4.5, cantidad: 4 } });
    // Ponderado: 65 / 21 = 3.1. Un promedio de promedios daría (5 + 3) / 2 = 4.
    expect(segundo).toMatchObject({ posicion: 2, profesor: { id: "p1", nombreCompleto: "Ana" }, valoracion: { promedio: 3.1, cantidad: 21 } });
    expect(segundo!.comisiones).toEqual([
      { comision: { id: "a", nombre: "S-a", carrera: "S", activa: true }, materia: { id: "m1", nombre: "Paradigmas" },
        cursada: { id: "c1", anio: 2026, cuatrimestre: "PRIMERO" }, cargo: "TITULAR", valoracion: { promedio: 5, cantidad: 1 } },
      { comision: { id: "b", nombre: "I-2", carrera: "I", activa: true }, materia: { id: "m1", nombre: "Paradigmas" },
        cursada: { id: "c1", anio: 2026, cuatrimestre: "PRIMERO" }, cargo: null, valoracion: { promedio: 3, cantidad: 20 } },
    ]);
  });

  it("ignora los votos sin profesor y aplica el mínimo al total del profesor", () => {
    expect(rankingProfesores(filas, 5).map(item => item.profesor.id)).toEqual(["p1"]);
    expect(rankingProfesores([fila({ comisionId: "a", suma: 30, cantidad: 6 })], 1)).toEqual([]);
  });
});

describe("Ranking: servicio y validación de query", () => {
  const filas = [
    fila({ comisionId: "a", suma: 5, cantidad: 1, profesorId: "p1", profesorNombre: "Ana Pérez", cargo: "TITULAR" }),
    fila({ comisionId: "b", suma: 4, cantidad: 1, cursadaId: "c2", profesorId: "p2", profesorNombre: "Beto Gómez", cargo: "JTP" }),
    fila({ comisionId: "c", suma: 3, cantidad: 1, materiaId: "m2" }),
  ];
  const repository = {
    filasValoracion: vi.fn(async () => filas),
    profesores: vi.fn(async () => [{ id: "p1", nombreCompleto: "Ana Pérez" }, { id: "p2", nombreCompleto: "Beto Gómez" }, { id: "p3", nombreCompleto: "Ana Sosa" }]),
  };
  const service = new RankingService(repository);
  const id = "00000000-0000-4000-8000-000000000001";

  it("pagina el ranking histórico conservando la posición global y el total", async () => {
    const result = await service.comisiones({ page: "2", pageSize: "2" });
    expect(result).toMatchObject({ total: 3, page: 2, pageSize: 2 });
    expect(result.items.map(item => [item.posicion, item.cursadas[0]!.comisionId])).toEqual([[3, "c"]]);
  });

  it("filtra el histórico por materia y da la vista por comisión de una cursada", async () => {
    repository.filasValoracion.mockResolvedValueOnce(filas.map(item => ({ ...item, materiaId: item.materiaId === "m2" ? "m2" : id })));
    expect((await service.comisiones({ materiaId: id })).items.map(item => [item.posicion, item.cursadas[0]!.comisionId])).toEqual([[1, "a"], [2, "b"]]);
    repository.filasValoracion.mockResolvedValueOnce(filas.map(item => ({ ...item, cursadaId: item.cursadaId === "c2" ? id : item.cursadaId })));
    expect((await service.comisionesDeCursada(id)).map(item => [item.posicion, item.comision.id])).toEqual([[1, "b"]]);
    await expect(service.comisionesDeCursada("no-uuid")).rejects.toThrow(FeedbackInputError);
  });

  it("busca profesores sin tildes ni mayúsculas e incluye a los que no tienen votos al final", async () => {
    const result = await service.profesores({ q: " ana " });
    expect(result.items.map(item => [item.posicion, item.profesor.id, item.valoracion])).toEqual([
      [1, "p1", { promedio: 5, cantidad: 1 }],
      [null, "p3", { promedio: null, cantidad: 0 }],
    ]);
    expect(coincideNombre("Beto Gómez", "GOMEZ")).toBe(true);
  });

  it("sin búsqueda, el ranking solo lista profesores con votos", async () => {
    expect((await service.profesores({})).items.map(item => item.profesor.id)).toEqual(["p1", "p2"]);
  });

  it("el detalle del profesor devuelve su posición, o null y sin desglose si no tiene votos", async () => {
    repository.profesores.mockResolvedValueOnce([{ id, nombreCompleto: "Carla Ruiz" }]);
    expect(await service.profesor(id, {})).toEqual({ posicion: null, profesor: { id, nombreCompleto: "Carla Ruiz" }, valoracion: { promedio: null, cantidad: 0 }, comisiones: [] });
    repository.profesores.mockResolvedValueOnce([]);
    await expect(service.profesor(id, {})).rejects.toThrow(RankingProfesorNotFoundError);
    await expect(service.profesor("no-uuid", {})).rejects.toThrow(FeedbackInputError);
  });

  it("usa valores por defecto y rechaza parámetros inválidos o desconocidos", () => {
    expect(validateRankingComisionesQuery(undefined)).toEqual({ page: 1, pageSize: 10, minValoraciones: 1 });
    expect(validateRankingProfesoresQuery({ q: "   " })).toEqual({ page: 1, pageSize: 10, minValoraciones: 1, q: undefined });
    expect(validateGeneralFeedbackQuery({ profesorId: id })).toMatchObject({ profesorId: id });
    for (const query of [{ pageSize: "51" }, { minValoraciones: "0" }, { minValoraciones: "101" }, { page: "x" }, { orden: "asc" }, { materiaId: "x" }, { cursadaId: id }]) {
      expect(() => validateRankingComisionesQuery(query)).toThrow(FeedbackInputError);
    }
    for (const query of [{ q: "a".repeat(151) }, { q: "a" }, { materiaId: id }]) {
      expect(() => validateRankingProfesoresQuery(query)).toThrow(FeedbackInputError);
    }
    expect(() => validateGeneralFeedbackQuery({ profesorId: "x" })).toThrow(FeedbackInputError);
  });
});

describe("Ranking: consulta PostgreSQL", () => {
  it("agrega solo votos vigentes de entidades sin baja y convierte los conteos", async () => {
    const queryRaw = vi.fn<(query: Prisma.Sql) => Promise<unknown>>().mockResolvedValue([
      { ...fila({ comisionId: "a", suma: 0, cantidad: 0 }), suma: 9n, cantidad: 2n },
    ]);
    const repository = new PrismaRankingRepository({ $queryRaw: queryRaw } as unknown as PrismaService);
    const [row] = await repository.filasValoracion();
    expect(row).toMatchObject({ comisionId: "a", suma: 9, cantidad: 2 });
    const query = queryRaw.mock.calls[0]![0];
    const sql = query.text;
    // T2: visibility uses the central policy's quoted identifier and bound state/causes.
    for (const condition of ['"f"."deletedAt" IS NULL', 'f."puntuacion" IS NOT NULL', 'c."deletedAt" IS NULL', 'cu."deletedAt" IS NULL', 'm."deletedAt" IS NULL', 'p."deletedAt" IS NULL',
      '"f"."estadoModeracion" = $1::"FeedbackEstadoModeracion"', '"f"."ocultoAutor" = $2', '"f"."ocultoAdministracion" = $3', '"f"."ocultoReportes" = $4']) {
      expect(sql).toContain(condition);
    }
    expect(query.values).toEqual(["APROBADO", false, false, false]);
    expect(sql).not.toContain("autorId");
  });
});
