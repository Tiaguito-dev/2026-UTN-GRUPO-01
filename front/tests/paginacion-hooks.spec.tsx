// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useAllPages } from "@/hooks/useAllPages";
import { HttpError } from "@/services/http";

afterEach(cleanup);

const pageOf = (page: number, total: number) => ({ items: [`item-${page}`], total, page, pageSize: 1 });

describe("usePaginatedFetch", () => {
  it("cambiar de recurso pide solo la página nueva", async () => {
    const fetchPage = vi.fn(async (page: number) => pageOf(page, 10));
    const { result, rerender } = renderHook(({ resetKey, page }) => usePaginatedFetch(resetKey, fetchPage, page), { initialProps: { resetKey: "materia-a", page: 3 } });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    // TASK-027 decision 5: the page comes from the URL, so a new resource arrives together with
    // page 1. Before, the hook kept its own page and requested the stale page (3) first: [3, 3, 1].
    rerender({ resetKey: "materia-b", page: 1 });
    expect(result.current.state.status).toBe("loading");
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([3, 1]);
    const { state } = result.current;
    expect(state.status === "ready" && state.data.page).toBe(1);
  });

  it("un error con 404 se informa como notFound y Reintentar vuelve a pedir", async () => {
    const fetchPage = vi.fn().mockRejectedValueOnce(new HttpError(404, "No encontramos esta materia.")).mockResolvedValue(pageOf(1, 1));
    const { result } = renderHook(() => usePaginatedFetch("materia-a", fetchPage, 1));
    await waitFor(() => expect(result.current.state).toEqual({ status: "error", error: "No encontramos esta materia.", notFound: true }));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});

describe("useAllPages", () => {
  // TASK-027 decision 4: same `AsyncState` as usePaginatedFetch; `items === null` is now `status: "loading"`.
  it("junta todas las páginas hasta completar el total", async () => {
    const fetchPage = vi.fn(async (page: number) => pageOf(page, 3));
    const { result } = renderHook(() => useAllPages("materias", fetchPage));
    await waitFor(() => expect(result.current.state).toEqual({ status: "ready", data: ["item-1", "item-2", "item-3"] }));
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("alcanza el tope de 20 páginas con error sin publicar opciones parciales", async () => {
    const fetchPage = vi.fn(async (page: number) => pageOf(page, 1000));
    const { result } = renderHook(() => useAllPages("materias", fetchPage));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(fetchPage).toHaveBeenCalledTimes(20);
  });

  it("una página vacía antes de completar el total produce error sin opciones parciales", async () => {
    const fetchPage = vi.fn(async (page: number) => page === 1 ? pageOf(1, 3) : { items: [], total: 3, page, pageSize: 1 });
    const { result } = renderHook(() => useAllPages("materias", fetchPage));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
  it("completar exactamente veinte páginas entrega todas las opciones sin error", async () => {
    const fetchPage = vi.fn(async (page: number) => pageOf(page, 20));
    const { result } = renderHook(() => useAllPages("materias", fetchPage));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    const { state } = result.current;
    expect(state.status === "ready" && state.data).toHaveLength(20); expect(fetchPage).toHaveBeenCalledTimes(20);
  });

  it("volver a una key después de vaciarla pasa por la carga, sin mostrar los datos viejos", async () => {
    const fetchPage = vi.fn(async (page: number) => pageOf(page, 1));
    const { result, rerender } = renderHook(({ key }) => useAllPages(key, fetchPage), { initialProps: { key: "A" } });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    rerender({ key: "" });
    expect(result.current.state).toEqual({ status: "ready", data: [] });
    rerender({ key: "A" });
    expect(result.current.state.status).toBe("loading");
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("sin key no pide nada y devuelve una lista vacía", () => {
    const fetchPage = vi.fn();
    const { result } = renderHook(() => useAllPages("", fetchPage));
    expect(result.current.state).toEqual({ status: "ready", data: [] });
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
