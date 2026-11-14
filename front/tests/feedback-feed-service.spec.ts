import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listarFeedComentarios } from "@/services/feedback-feed";
const item = { id: "f1", texto: "Opinion", puntuacion: 4, anonimo: true, autor: null, propio: false, profesor: null,
 contexto: { comisionId: "c1", nombre: "S-31", materiaId: "m1", materiaNombre: "Materia", cursadaId: "cu1", anio: 2026, cuatrimestre: null },
 createdAt: "2026-11-01T15:42:00.000Z", updatedAt: "2026-11-01T15:42:00.000Z", cantidadLikes: 2, cantidadRespuestas: 3, meGusta: true };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => { vi.stubGlobal("window", { addEventListener: vi.fn() }); vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost:3301"); vi.stubEnv("NEXT_PUBLIC_ALLOW_LOCAL_HTTP", "true"); fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Feed service", () => {
 it("requests nine items, preserves read counters and encodes opaque cursors", async () => {
   fetchMock.mockImplementation(() => Promise.resolve(response({ items: [item], nextCursor: "next", hasMore: true })));
   expect(await listarFeedComentarios()).toEqual({ items: [item], nextCursor: "next", hasMore: true });
   const first = new URL(String(fetchMock.mock.calls[0][0])); expect(first.pathname).toBe("/feedback/feed"); expect(Object.fromEntries(first.searchParams)).toEqual({ pageSize: "9" });
   await listarFeedComentarios("a+/=?"); expect(new URL(String(fetchMock.mock.calls.at(-1)![0])).searchParams.get("cursor")).toBe("a+/=?");
   expect(fetchMock.mock.calls[0][1]).toMatchObject({ credentials: "include", cache: "no-store" });
 });
 it.each([null, 1, 5])("supports individual historical/rated values %s", async puntuacion => {
   fetchMock.mockResolvedValue(response({ items: [{ ...item, puntuacion }], nextCursor: null, hasMore: false })); expect((await listarFeedComentarios()).items[0].puntuacion).toBe(puntuacion);
 });
 it.each([{ cantidadLikes: -1 }, { cantidadRespuestas: 1.5 }, { meGusta: "true" }, { puntuacion: 0 }, { anonimo: true, autor: { displayName: "PRIVATE" } }, { createdAt: "bad" }])("rejects malformed feed items %j", async extra => {
   fetchMock.mockResolvedValue(response({ items: [{ ...item, ...extra }], nextCursor: null, hasMore: false })); await expect(listarFeedComentarios()).rejects.toMatchObject({ status: 502 });
 });
 it.each([{ nextCursor: null, hasMore: true }, { nextCursor: "next", hasMore: false }, { nextCursor: "", hasMore: true }])("rejects contradictory cursors %j", async flags => {
   fetchMock.mockResolvedValue(response({ items: [], ...flags })); await expect(listarFeedComentarios()).rejects.toMatchObject({ status: 502 });
 });
 it("removes unexpected private fields and rejects unbounded pages", async () => {
   fetchMock.mockResolvedValueOnce(response({ items: [{ ...item, autorId: "PRIVATE" }], nextCursor: null, hasMore: false })); expect((await listarFeedComentarios()).items[0]).not.toHaveProperty("autorId");
   fetchMock.mockResolvedValueOnce(response({ items: Array.from({ length: 10 }, () => item), nextCursor: null, hasMore: false })); await expect(listarFeedComentarios()).rejects.toMatchObject({ status: 502 });
 });
 it("preserves server errors for retry feedback", async () => { fetchMock.mockResolvedValue(response({ message: "Unavailable" }, 503)); await expect(listarFeedComentarios()).rejects.toMatchObject({ status: 503, message: "Unavailable" }); });
});
