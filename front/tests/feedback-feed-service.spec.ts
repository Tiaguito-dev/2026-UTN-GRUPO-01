import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listarFeedComentarios, activarLikeFeedback, retirarLikeFeedback, listarRespuestasFeedback, crearRespuestaFeedback, editarRespuestaFeedback, eliminarRespuestaFeedback } from "@/services/feedback-feed";
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


describe("Interaction service contracts", () => {
 const reply = { id: "r1", feedbackId: "f1", texto: "Reply", anonimo: true, autor: null, propio: true, createdAt: item.createdAt, updatedAt: item.updatedAt };
 const account = { id: "u1", email: "person@alu.frlp.utn.edu.ar", displayName: "Persona", role: "USER" };
 const calls = () => fetchMock.mock.calls.filter(([url]) => new URL(String(url)).pathname !== "/auth/me");
 function respond(body: unknown, status = 200) { fetchMock.mockImplementation((url: unknown) => Promise.resolve(response(new URL(String(url)).pathname === "/auth/me" ? account : body, new URL(String(url)).pathname === "/auth/me" ? 200 : status))); }
 it("sends repeated explicit PUT/DELETE without toggling, with credentials and CSRF", async () => {
   respond({ meGusta: true, cantidadLikes: 5 }); await activarLikeFeedback("f/1"); await activarLikeFeedback("f/1");
   respond({ meGusta: false, cantidadLikes: 4 }); await retirarLikeFeedback("f/1"); await retirarLikeFeedback("f/1");
   expect(calls().map(([, options]) => options.method)).toEqual(["PUT", "PUT", "DELETE", "DELETE"]);
   for (const [url, options] of calls()) { expect(new URL(String(url)).pathname).toBe("/feedback/f%2F1/like"); expect(options).toMatchObject({ credentials: "include", headers: { "X-CSRF-Protection": "1" } }); }
 });
 it("reads bounded reply pages and preserves server ownership without private IDs", async () => {
   respond({ items: [{ ...reply, autorId: "PRIVATE" }], total: 21, page: 2, pageSize: 20 }); const data = await listarRespuestasFeedback("f/1", { page: 2, pageSize: 20 });
   expect(data.items[0]).toEqual(reply); const url = new URL(String(calls()[0][0])); expect(url.pathname).toBe("/feedback/f%2F1/respuestas"); expect(Object.fromEntries(url.searchParams)).toEqual({ page: "2", pageSize: "20" });
 });
 it("accepts POST 201 and retry 200 with the supplied stable key, PATCH and DELETE 204", async () => {
   const input = { solicitudId: "12345678-1234-4234-8234-123456789012", texto: "Reply", anonimo: true };
   respond(reply, 201); expect(await crearRespuestaFeedback("f1", input)).toEqual(reply); respond(reply, 200); expect(await crearRespuestaFeedback("f1", input)).toEqual(reply);
   expect(calls().slice(0, 2).map(([, options]) => JSON.parse(options.body))).toEqual([input, input]);
   await editarRespuestaFeedback("r/1", { texto: "Changed" }); expect(calls().at(-1)).toMatchObject([expect.stringContaining("/feedback/respuestas/r%2F1"), { method: "PATCH", body: JSON.stringify({ texto: "Changed" }) }]);
   fetchMock.mockImplementation((url: unknown) => Promise.resolve(new URL(String(url)).pathname === "/auth/me" ? response(account) : new Response(null, { status: 204 })));
   await expect(eliminarRespuestaFeedback("r/1")).resolves.toBeUndefined(); expect(calls().at(-1)![1].method).toBe("DELETE");
 });
 it.each([{ propio: undefined }, { propio: "true" }, { anonimo: true, autor: { displayName: "PRIVATE" } }])("rejects missing or contradictory reply ownership/privacy: %j", async extra => {
   respond({ items: [{ ...reply, ...extra }], total: 1, page: 1, pageSize: 20 }); await expect(listarRespuestasFeedback("f1")).rejects.toMatchObject({ status: 502 });
 });
 it.each([{ cantidadLikes: -1, meGusta: true }, { cantidadLikes: 3, meGusta: "true" }])("rejects invalid mutation responses: %j", async body => {
   respond(body); await expect(activarLikeFeedback("f1")).rejects.toMatchObject({ status: 502 });
 });
});
