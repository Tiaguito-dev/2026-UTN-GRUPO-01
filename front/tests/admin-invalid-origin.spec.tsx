// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";
import { useDiscardInvalidAdminOrigin } from "@/components/admin/useAdminCommissionOrigin";

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, "", "/"); });

describe("descarte de origen administrativo confirmado inválido", () => {
  it.each(["/home/admin/profesores/p1", "/home/admin/experiencias/f1"])("normaliza %s preservando página y mensaje y notifica la navegación", (path) => {
    const state = { preserved: true };
    const params = new URLSearchParams({ returnTo: "/home/admin/comisiones/eliminada", page: "2", successMessage: "Guardado correctamente." });
    window.history.replaceState(state, "", `${path}?${params}`);
    const replace = vi.spyOn(window.history, "replaceState");
    renderHook(() => useDiscardInvalidAdminOrigin(true));
    const current = new URL(window.location.href);
    expect(current.pathname).toBe(path);
    expect(current.searchParams.has("returnTo")).toBe(false);
    expect(current.searchParams.get("page")).toBe("2");
    expect(current.searchParams.get("successMessage")).toBe("Guardado correctamente.");
    // Next integra llamadas nativas sin su marca interna __NA; no reutilizar estado interno.
    expect(window.history.state).toBeNull();
    expect(replace).toHaveBeenCalledOnce();
    expect(replace).toHaveBeenCalledWith(null, "", `${current.pathname}${current.search}`);
  });

  it("no modifica un origen que todavía no se confirmó inválido", () => {
    const path = "/home/admin/profesores/p1?returnTo=%2Fhome%2Fadmin%2Fcomisiones%2Fco1";
    window.history.replaceState(null, "", path);
    const replace = vi.spyOn(window.history, "replaceState");
    const view = renderHook(({ invalid }) => useDiscardInvalidAdminOrigin(invalid), { initialProps: { invalid: false } });
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.pathname + window.location.search).toBe(path);
    view.rerender({ invalid: true });
    expect(replace).toHaveBeenCalledOnce();
    expect(window.location.search).toBe("");
  });

  it.each([
    "/home/admin/profesores", "/home/admin/experiencias", "/home/admin/profesores/p1/editar",
    "/home/admin/comisiones/co1", "/home/admin/materias/m1", "/home/experiencias/f1",
  ])("no altera rutas fuera del detalle admitido: %s", (path) => {
    window.history.replaceState(null, "", `${path}?returnTo=invalid&page=2`);
    const replace = vi.spyOn(window.history, "replaceState");
    renderHook(() => useDiscardInvalidAdminOrigin(true));
    expect(replace).not.toHaveBeenCalled();
    expect(new URL(window.location.href).searchParams.get("returnTo")).toBe("invalid");
  });

  it("sin returnTo no reemplaza otra vez la URL ni genera un bucle", () => {
    window.history.replaceState(null, "", "/home/admin/experiencias/f1?page=2");
    const replace = vi.spyOn(window.history, "replaceState");
    const view = renderHook(() => useDiscardInvalidAdminOrigin(true));
    view.rerender();
    expect(replace).not.toHaveBeenCalled();
  });
});
