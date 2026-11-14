// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FeedPrincipal } from "@/components/feedback/FeedPrincipal";
import { InicioSection } from "@/components/home/InicioSection";
import { listarFeedComentarios } from "@/services/feedback-feed";
import type { FeedbackFeedItem, FeedbackFeed } from "@/types/feedback-feed";
vi.mock("@/services/feedback-feed", () => ({ listarFeedComentarios: vi.fn() }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => false }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { displayName: "Persona" } }) }));
const item = (id: string, extra: Partial<FeedbackFeedItem> = {}): FeedbackFeedItem => ({
  id, texto: "Texto " + id, puntuacion: 4, anonimo: true, autor: null, propio: true, profesor: null,
  contexto: { comisionId: "c1", nombre: "S-31", materiaId: "m1", materiaNombre: "Materia", cursadaId: "cu1", anio: 2026, cuatrimestre: "ANUAL" },
  createdAt: "2026-11-01T15:42:00.000Z", updatedAt: "2026-11-01T15:42:00.000Z", cantidadLikes: 2, cantidadRespuestas: 3, meGusta: false, ...extra,
});
const page = (items: FeedbackFeedItem[], nextCursor: string | null = null): FeedbackFeed => ({ items, nextCursor, hasMore: nextCursor !== null });
const deferred = () => { let resolve!: (p: FeedbackFeed) => void; let reject!: (e: Error) => void; const promise = new Promise<FeedbackFeed>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let intersect: (visible: boolean) => void;
let disconnect: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(listarFeedComentarios).mockResolvedValue(page([])); disconnect = vi.fn();
  vi.stubGlobal("IntersectionObserver", class {
    observe = vi.fn(); disconnect = disconnect;
    constructor(callback: IntersectionObserverCallback) { intersect = visible => callback([{ isIntersecting: visible } as IntersectionObserverEntry], this as unknown as IntersectionObserver); }
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Feed principal", () => {
  it("loads nine initially and renders backend order, context, time, stars and read-only counts", async () => {
    vi.mocked(listarFeedComentarios).mockResolvedValue(page([item("new"), item("old", { anonimo: false, autor: { displayName: "Ada" }, propio: false })]));
    render(<FeedPrincipal />);
    expect(await screen.findByText("Texto new")).toBeTruthy();
    expect(listarFeedComentarios).toHaveBeenCalledExactlyOnceWith();
    expect(screen.getAllByRole("article").map(a => a.textContent)).toEqual([expect.stringContaining("Texto new"), expect.stringContaining("Texto old")]);
    expect(screen.getByText("Anónimo")).toBeTruthy(); expect(screen.getByText("Ada")).toBeTruthy();
    expect(screen.getAllByText("4 de 5 estrellas")).toHaveLength(2);
    expect(screen.getAllByText("2 Me gusta")).toHaveLength(2); expect(screen.getAllByText("3 respuestas")).toHaveLength(2);
    expect(screen.getAllByText("Materia")).toHaveLength(2); expect(screen.getAllByText(/Comisión S-31/)).toHaveLength(2);
    const time = document.querySelector("time")!;
    expect(time.getAttribute("datetime")).toBe(item("new").createdAt);
    expect(time.textContent).toBe(new Date(item("new").createdAt).toLocaleString("es-AR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }));
    expect(screen.queryByRole("button", { name: /Administrar|Responder/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Dar Me gusta" })).toHaveLength(1);
  });
  it("mounts the feed in Inicio without changing its greeting", async () => {
    render(<InicioSection />); expect(screen.getByRole("heading", { name: "Hola, Persona." })).toBeTruthy();
    expect(await screen.findByText("Todavía no hay comentarios.")).toBeTruthy();
  });
  it("keeps historical null stars and never renders a private author even with malformed mock data", async () => {
    vi.mocked(listarFeedComentarios).mockResolvedValue(page([item("historic", { puntuacion: null, autor: { displayName: "PRIVATE" } })]));
    render(<FeedPrincipal />); await screen.findByText("Texto historic");
    expect(screen.queryByText("PRIVATE")).toBeNull(); expect(screen.queryByText(/de 5 estrellas/)).toBeNull();
  });
  it("appends pages in order, deduplicates IDs and sends the previous cursor", async () => {
    vi.mocked(listarFeedComentarios).mockResolvedValueOnce(page([item("a"), item("b")], "cursor1")).mockResolvedValueOnce(page([item("b"), item("c")], "cursor2")).mockResolvedValueOnce(page([item("d")]));
    render(<FeedPrincipal />); await screen.findByText("Texto a");
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" })); await screen.findByText("Texto c");
    expect(listarFeedComentarios).toHaveBeenLastCalledWith("cursor1"); expect(screen.getAllByText("Texto b")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" })); await screen.findByText("Texto d");
    expect(listarFeedComentarios).toHaveBeenLastCalledWith("cursor2"); expect(screen.getByText("Llegaste al final de los comentarios.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });
  it("allows only one request when observer and repeated clicks overlap", async () => {
    const pending = deferred(); vi.mocked(listarFeedComentarios).mockResolvedValueOnce(page([item("a")], "cursor1")).mockReturnValueOnce(pending.promise);
    render(<FeedPrincipal />); await screen.findByText("Texto a");
    act(() => { intersect(true); intersect(true); });
    fireEvent.click(screen.getByRole("button", { name: /Cargando/ }));
    expect(listarFeedComentarios).toHaveBeenCalledTimes(2);
    await act(async () => pending.resolve(page([item("b")], "cursor2")));
    act(() => intersect(true)); expect(listarFeedComentarios).toHaveBeenCalledTimes(2);
  });
  it("retries an initial error and announces empty results", async () => {
    vi.mocked(listarFeedComentarios).mockRejectedValueOnce(new Error("Error inicial")).mockResolvedValueOnce(page([]));
    render(<FeedPrincipal />); expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Error inicial"));
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); await screen.findByText("Todavía no hay comentarios.");
    expect(listarFeedComentarios).toHaveBeenCalledTimes(2);
  });
  it("preserves existing items and cursor on incremental failure and retries the same page", async () => {
    vi.mocked(listarFeedComentarios).mockResolvedValueOnce(page([item("a")], "cursor1")).mockRejectedValueOnce(new Error("Error siguiente")).mockResolvedValueOnce(page([item("b")]));
    render(<FeedPrincipal />); await screen.findByText("Texto a"); fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText("Error siguiente"); expect(screen.getByText("Texto a")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" })); await screen.findByText("Texto b");
    expect(vi.mocked(listarFeedComentarios).mock.calls.slice(1)).toEqual([["cursor1"], ["cursor1"]]);
  });
  it.each([false, true])("ignores a late old window success/error after refresh: error=%s", async fail => {
    const pending = deferred(); vi.mocked(listarFeedComentarios).mockResolvedValueOnce(page([item("old")], "cursor1")).mockReturnValueOnce(pending.promise).mockResolvedValueOnce(page([item("fresh")]));
    render(<FeedPrincipal />); await screen.findByText("Texto old"); fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar feed" })); await screen.findByText("Texto fresh");
    await act(async () => { if (fail) pending.reject(new Error("Old failure")); else pending.resolve(page([item("late")])); });
    expect(screen.queryByText("Texto late")).toBeNull(); expect(screen.queryByText("Texto old")).toBeNull(); expect(screen.queryByRole("alert")).toBeNull();
    expect(listarFeedComentarios).toHaveBeenLastCalledWith();
  });
  it("disconnects its observer when unmounted", async () => {
    const view = render(<FeedPrincipal />); await screen.findByText("Todavía no hay comentarios."); view.unmount(); expect(disconnect).toHaveBeenCalledOnce();
  });
  it("keeps the manual fallback when IntersectionObserver is unavailable", async () => {
    vi.stubGlobal("IntersectionObserver", undefined); vi.mocked(listarFeedComentarios).mockResolvedValue(page([item("a")], "cursor1"));
    render(<FeedPrincipal />); await screen.findByRole("button", { name: "Cargar más" });
  });
  it("stops a repeated cursor without replacing the loaded window", async () => {
    vi.mocked(listarFeedComentarios).mockResolvedValueOnce(page([item("a")], "cursor1")).mockResolvedValueOnce(page([item("b")], "cursor1"));
    render(<FeedPrincipal />); await screen.findByText("Texto a"); fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByRole("alert"); expect(screen.getByText("Texto a")).toBeTruthy(); expect(listarFeedComentarios).toHaveBeenCalledTimes(2);
  });
});
