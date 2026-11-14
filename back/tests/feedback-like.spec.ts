import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";
import { FeedbackLikeService } from "../src/reviews/application/feedback-like.service.js";
import { PrismaFeedbackLikeRepository } from "../src/reviews/infrastructure/prisma-feedback-like.repository.js";

const viewer = randomUUID();
const author = randomUUID();
const id = randomUUID();
const comisionId = randomUUID();

function setup(initial: { deletedAt: Date | null } | null = null) {
  let like = initial;
  const parent = { id, autorId: author, comisionId, deletedAt: null as Date | null };
  const order: string[] = [];
  const query = vi.fn().mockImplementation(async (sql: TemplateStringsArray) => {
    const text = sql.join("?");
    if (text.includes('FROM "Comision"')) { order.push("comision"); return [{ id: comisionId }]; }
    if (text.includes('FROM "Feedback"')) { order.push("feedback"); return [parent]; }
    if (text.includes('FROM "FeedbackLike"')) { order.push("like"); return like ? [like] : []; }
    throw new Error("SQL inesperado");
  });
  const create = vi.fn().mockImplementation(async () => { like = { deletedAt: null }; return like; });
  const update = vi.fn().mockImplementation(async ({ data }: { data: { deletedAt: Date | null } }) => { like = { deletedAt: data.deletedAt }; return like; });
  const count = vi.fn().mockImplementation(async () => like && like.deletedAt === null ? 1 : 0);
  const audit = vi.fn().mockResolvedValue({});
  const tx = { $queryRaw: query, feedbackLike: { create, update, count }, administracionHistorial: { create: audit } };
  const lookup = vi.fn().mockResolvedValue({ comisionId });
  const transaction = vi.fn().mockImplementation(async (callback: (value: typeof tx) => unknown) => callback(tx));
  const repository = new PrismaFeedbackLikeRepository({ feedback: { findUnique: lookup }, $transaction: transaction } as unknown as PrismaService);
  return { service: new FeedbackLikeService(repository), parent, lookup, query, order, create, update, count, audit, transaction };
}

describe("Likes reversibles", () => {
  it("crea el primer like con bloqueos comisión → comentario → like", async () => {
    const f = setup();
    expect(await f.service.put(id, viewer)).toEqual({ meGusta: true, cantidadLikes: 1 });
    expect(f.order).toEqual(["comision", "feedback", "like"]);
    expect(f.create).toHaveBeenCalledExactlyOnceWith({ data: { usuarioId: viewer, feedbackId: id } });
    expect(f.audit).toHaveBeenCalledOnce();
    expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "ReadCommitted" });
  });
  it("PUT repetido no escribe ni audita cambios ficticios", async () => {
    const f = setup({ deletedAt: null });
    expect(await f.service.put(id, viewer)).toEqual({ meGusta: true, cantidadLikes: 1 });
    expect(f.create).not.toHaveBeenCalled();
    expect(f.update).not.toHaveBeenCalled();
    expect(f.audit).not.toHaveBeenCalled();
  });
  it("reactiva la misma fila sin cambiar createdAt", async () => {
    const f = setup({ deletedAt: new Date() });
    expect(await f.service.put(id, viewer)).toEqual({ meGusta: true, cantidadLikes: 1 });
    expect(f.create).not.toHaveBeenCalled();
    expect(f.update).toHaveBeenCalledWith({ where: { usuarioId_feedbackId: { usuarioId: viewer, feedbackId: id } }, data: { deletedAt: null, updatedAt: expect.any(Date) } });
  });
  it("DELETE da de baja sin borrar físicamente", async () => {
    const f = setup({ deletedAt: null });
    expect(await f.service.remove(id, viewer)).toEqual({ meGusta: false, cantidadLikes: 0 });
    expect(f.update).toHaveBeenCalledWith(expect.objectContaining({ data: { deletedAt: expect.any(Date), updatedAt: expect.any(Date) } }));
  });
  it.each([null, { deletedAt: new Date() }])("DELETE repetido o ausente no escribe: %j", async (initial) => {
    const f = setup(initial);
    expect(await f.service.remove(id, viewer)).toEqual({ meGusta: false, cantidadLikes: 0 });
    expect(f.update).not.toHaveBeenCalled();
    expect(f.create).not.toHaveBeenCalled();
    expect(f.audit).not.toHaveBeenCalled();
  });
  it("rechaza autolike usando autorId real, sin depender del anonimato", async () => {
    const f = setup();
    f.parent.autorId = viewer;
    await expect(f.service.put(id, viewer)).rejects.toMatchObject({ httpStatus: 403 });
    expect(f.create).not.toHaveBeenCalled();
  });
  it("revalida baja del padre después del bloqueo", async () => {
    const f = setup();
    f.parent.deletedAt = new Date();
    await expect(f.service.put(id, viewer)).rejects.toMatchObject({ httpStatus: 404 });
    expect(f.create).not.toHaveBeenCalled();
  });
  it("rechaza padres inexistentes y UUID inválidos sin escribir", async () => {
    const f = setup();
    f.lookup.mockResolvedValueOnce(null);
    await expect(f.service.put(id, viewer)).rejects.toMatchObject({ httpStatus: 404 });
    expect(f.transaction).not.toHaveBeenCalled();
    expect(() => f.service.remove("invalid", viewer)).toThrow();
  });
  it("no oculta errores de escritura ni de conteo", async () => {
    const f = setup();
    f.count.mockRejectedValueOnce(new Error("fallo conteo"));
    await expect(f.service.put(id, viewer)).rejects.toThrow("fallo conteo");
    const other = setup();
    other.audit.mockRejectedValueOnce(new Error("fallo auditoría"));
    await expect(other.service.put(id, viewer)).rejects.toThrow("fallo auditoría");
  });
});
