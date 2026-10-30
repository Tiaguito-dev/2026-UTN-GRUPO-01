// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useUrlPagination } from "@/hooks/useUrlPagination";

const { navigation } = vi.hoisted(() => ({ navigation: { search: "", replace: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace }),
  usePathname: () => "/home/admin/usuarios",
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

afterEach(cleanup);
beforeEach(() => { navigation.search = ""; navigation.replace.mockReset(); });

describe("useUrlPagination", () => {
  it("lee la página de la URL en cada render, sin estado propio", () => {
    navigation.search = "page=3";
    const { result, rerender } = renderHook(() => useUrlPagination());
    expect(result.current.page).toBe(3);
    navigation.search = "";
    rerender();
    expect(result.current.page).toBe(1);
  });

  it("una página inválida en la URL se lee como la 1", () => {
    navigation.search = "page=abc";
    expect(renderHook(() => useUrlPagination()).result.current.page).toBe(1);
  });

  it("setPage reemplaza la URL conservando los otros parámetros", () => {
    navigation.search = "anioCarrera=2";
    renderHook(() => useUrlPagination()).result.current.setPage(2);
    expect(navigation.replace).toHaveBeenCalledWith("/home/admin/usuarios?anioCarrera=2&page=2", { scroll: false });
  });

  it("setPage(1) borra el parámetro", () => {
    navigation.search = "page=4&q=Plan";
    renderHook(() => useUrlPagination()).result.current.setPage(1);
    expect(navigation.replace).toHaveBeenCalledWith("/home/admin/usuarios?q=Plan", { scroll: false });
    navigation.search = "page=4";
    renderHook(() => useUrlPagination()).result.current.setPage(1);
    expect(navigation.replace).toHaveBeenLastCalledWith("/home/admin/usuarios", { scroll: false });
  });
});
