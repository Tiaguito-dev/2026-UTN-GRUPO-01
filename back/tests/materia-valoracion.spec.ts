import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../src/generated/prisma/client.js";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { PrismaMateriaRepository } from "../src/academic/infrastructure/prisma-materia.repository.js";
import { ObtenerMateria } from "../src/academic/application/obtener-materia.js";
import type { MateriaRepository } from "../src/academic/application/ports/materia.repository.js";
import { InvalidIdError, MateriaNotFoundError } from "../src/academic/application/errors.js";

function fixture(size = 2) {
  const rows = Array.from({ length: size }, (_, index) => ({
    id: randomUUID(), nombre: `Materia ${index}`, modalidad: "PRIMERO", carreras: [
      { carrera: "S", anioCarrera: "1", nivelElectiva: null },
      { carrera: "I", anioCarrera: "2", nivelElectiva: null },
    ], createdAt: new Date("2026-11-12"), deletedAt: null,
  }));
  const aggregate = vi.fn().mockResolvedValue(rows.length ? [{ materiaId: rows[0]!.id, promedio: 4.3, cantidad: 12n, usuarioId: "no-publicar" }] : []);
  const tx = {
    $queryRaw: vi.fn<(query: Prisma.Sql) => Promise<unknown>>().mockImplementation(async query => {
      if (query.text.includes('FROM "ValoracionMateria"')) return aggregate(query);
      if (query.text.includes("COUNT(*) AS total")) return [{ total: BigInt(size + 3) }];
      return rows.map(({ id }) => ({ id }));
    }),
    materia: { findMany: vi.fn().mockResolvedValue([...rows].reverse()), findFirst: vi.fn().mockResolvedValue(rows[0] ?? null) },
  };
  const rootFindFirst = vi.fn().mockResolvedValue(rows[0] ?? null);
  const rootQuery = vi.fn().mockRejectedValue(new Error("Agregación fuera de transacción"));
  const transaction = vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx));
  const repository = new PrismaMateriaRepository({ $transaction: transaction, $queryRaw: rootQuery,
    materia: { findFirst: rootFindFirst },
  } as unknown as PrismaService);
  return { repository, tx, rows, aggregate, transaction, rootFindFirst, rootQuery };
}

describe("Materias: resumen de valoraciones sin PostgreSQL", () => {
  it("agrega resumen por ID, conserva orden de página y total sin exponer autores", async () => {
    const f = fixture();
    const result = await f.repository.findAll({ page: 2, pageSize: 9 });
    expect(result).toMatchObject({ total: 5, page: 2, pageSize: 9 });
    expect(result.items.map(item => item.id)).toEqual(f.rows.map(row => row.id));
    expect(result.items[0]).toMatchObject({ carreras: f.rows[0]!.carreras, valoracion: { promedio: 4.3, cantidad: 12 } });
    expect(result.items[1]).toMatchObject({ valoracion: { promedio: null, cantidad: 0 } });
    expect(JSON.stringify(result)).not.toContain("no-publicar");
    expect(f.transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
    expect(f.rootQuery).not.toHaveBeenCalled();
  });

  it.each([1, 9, 100])("página con %i materias usa una sola agregación parametrizada", async size => {
    const f = fixture(size);
    await f.repository.findAll({ page: 1, pageSize: size });
    expect(f.aggregate).toHaveBeenCalledTimes(1);
    const query = f.aggregate.mock.calls[0]![0] as Prisma.Sql;
    expect(query.text).toContain('"deletedAt" IS NULL');
    expect(query.text).toContain('ROUND(AVG("puntuacion"), 1)::double precision');
    expect(query.text).toContain('COUNT(*) AS cantidad');
    expect(query.text).toContain('GROUP BY "materiaId"');
    expect(query.text).not.toMatch(/JOIN|usuarioId/);
    expect(query.values).toEqual(f.rows.map(row => row.id));
    for (const row of f.rows) expect(query.text).not.toContain(row.id);
    expect(f.tx.materia.findMany).toHaveBeenCalledTimes(1);
  });

  it("página vacía no consulta votos ni hidrata materias", async () => {
    const f = fixture(0);
    expect(await f.repository.findAll({ page: 2, pageSize: 9 })).toEqual({ items: [], total: 3, page: 2, pageSize: 9 });
    expect(f.aggregate).not.toHaveBeenCalled();
    expect(f.tx.materia.findMany).not.toHaveBeenCalled();
  });

  it("filtros de carrera/año/búsqueda y paginación no restringen los votos de la materia", async () => {
    const f = fixture();
    await f.repository.findAll({ page: 2, pageSize: 9 }, { carrera: "I", anioCarrera: "ELECTIVA", nivelElectiva: "4", q: "  Plan %_  " });
    const page = f.tx.$queryRaw.mock.calls[0]![0];
    expect(page.text).toContain("EXISTS");
    expect(page.text).toContain('ORDER BY');
    expect(page.text).toContain("LIMIT");
    expect(page.text).toContain("OFFSET");
    expect(page.values).toEqual(expect.arrayContaining(["I", "ELECTIVA", "4", 9]));
    const rating = f.aggregate.mock.calls[0]![0] as Prisma.Sql;
    expect(rating.values).toEqual(f.rows.map(row => row.id));
    expect(rating.text).not.toContain("carrera");
  });

  it("detalle y resumen comparten una transacción RepeatableRead", async () => {
    const f = fixture();
    const result = await f.repository.findByIdConValoracion(f.rows[0]!.id);
    expect(result).toMatchObject({ id: f.rows[0]!.id, valoracion: { promedio: 4.3, cantidad: 12 } });
    expect(f.transaction).toHaveBeenCalledExactlyOnceWith(expect.any(Function), { isolationLevel: "RepeatableRead" });
    expect(f.tx.materia.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: f.rows[0]!.id, deletedAt: null } }));
    expect(f.rootFindFirst).not.toHaveBeenCalled();
    expect(f.rootQuery).not.toHaveBeenCalled();
    expect((f.aggregate.mock.calls[0]![0] as Prisma.Sql).values).toEqual([f.rows[0]!.id]);
  });

  it("detalle sin votos devuelve null/0; materia inexistente o eliminada no consulta votos", async () => {
    const f = fixture();
    f.aggregate.mockResolvedValue([]);
    expect(await f.repository.findByIdConValoracion(f.rows[0]!.id)).toMatchObject({ valoracion: { promedio: null, cantidad: 0 } });
    f.aggregate.mockClear();
    f.tx.materia.findFirst.mockResolvedValue(null);
    expect(await f.repository.findByIdConValoracion(randomUUID())).toBeNull();
    expect(f.aggregate).not.toHaveBeenCalled();
  });

  it("findById interno conserva su contrato y no consulta valoraciones", async () => {
    const f = fixture();
    expect(await f.repository.findById(f.rows[0]!.id)).toEqual(f.rows[0]);
    expect(f.transaction).not.toHaveBeenCalled();
    expect(f.aggregate).not.toHaveBeenCalled();
    expect(f.rootQuery).not.toHaveBeenCalled();
  });

  it.each(["listado", "detalle"])("error de agregación en %s se propaga, sin fingir cero votos", async path => {
    const f = fixture();
    const error = new Error("Falló agregación");
    f.aggregate.mockRejectedValue(error);
    await expect(path === "listado" ? f.repository.findAll({ page: 1, pageSize: 9 })
      : f.repository.findByIdConValoracion(f.rows[0]!.id)).rejects.toBe(error);
  });

  it("rechaza un conteo no representable como entero seguro JSON", async () => {
    const f = fixture();
    f.aggregate.mockResolvedValue([{ materiaId: f.rows[0]!.id, promedio: 4, cantidad: 9007199254740992n }]);
    await expect(f.repository.findAll({ page: 1, pageSize: 9 })).rejects.toThrow(RangeError);
  });

  it("ObtenerMateria delega en lectura enriquecida y conserva UUID/404", async () => {
    const id = randomUUID();
    const findById = vi.fn();
    const findByIdConValoracion = vi.fn().mockResolvedValue({ id, valoracion: { promedio: null, cantidad: 0 } });
    const service = new ObtenerMateria({ findById, findByIdConValoracion } as unknown as MateriaRepository);
    expect(await service.execute(id)).toEqual({ id, valoracion: { promedio: null, cantidad: 0 } });
    expect(findByIdConValoracion).toHaveBeenCalledExactlyOnceWith(id);
    expect(findById).not.toHaveBeenCalled();
    await expect(service.execute("inválido")).rejects.toBeInstanceOf(InvalidIdError);
    expect(findByIdConValoracion).toHaveBeenCalledTimes(1);
    findByIdConValoracion.mockResolvedValue(null);
    await expect(service.execute(id)).rejects.toBeInstanceOf(MateriaNotFoundError);
  });
});
