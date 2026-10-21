// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { usePaginatedFetch } from "@/hooks/usePaginatedFetch";
import { useAllPages } from "@/hooks/useAllPages";

afterEach(cleanup);

const pageOf = (page: number, total: number) => ({ items: [`item-${page}`], total, page, pageSize: 1 });

describe("usePaginatedFetch", () => {
  it("cambiar resetKey vuelve a la página 1", async () => {
    const fetchPage = vi.fn(async (page: number) => pageOf(page, 10));
    const { result, rerender } = renderHook(({ resetKey }) => usePaginatedFetch(resetKey, fetchPage, 3), { initialProps: { resetKey: "materia-a" } });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.page).toBe(3);

    rerender({ resetKey: "materia-b" });
    await waitFor(() => expect(result.current.page).toBe(1));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    // Characterization: the new resource is first requested at the stale page (3) and only then at
    // page 1. The stale response is discarded, but the extra request happens.
    expect(fetchPage.mock.calls.map(([page]) => page)).toEqual([3, 3, 1]);
    expect(result.current.result?.page).toBe(1);
  });
});

describe("useAllPages", () => {
  it("junta todas las páginas hasta completar el total", async () => {
    const fetchPage = vi.fn(async (page: number) => pageOf(page, 3));
    const { result } = renderHook(() => useAllPages("materias", fetchPage));
    await waitFor(() => expect(result.current.items).toEqual(["item-1", "item-2", "item-3"]));
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it("se detiene en el tope de 20 páginas", async () => {
    const fetchPage = vi.fn(async (page: number) => pageOf(page, 1000));
    const { result } = renderHook(() => useAllPages("materias", fetchPage));
    await waitFor(() => expect(result.current.items).toHaveLength(20));
    expect(fetchPage).toHaveBeenCalledTimes(20);
  });

  it("sin key no pide nada y devuelve una lista vacía", () => {
    const fetchPage = vi.fn();
    const { result } = renderHook(() => useAllPages("", fetchPage));
    expect(result.current.items).toEqual([]);
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
