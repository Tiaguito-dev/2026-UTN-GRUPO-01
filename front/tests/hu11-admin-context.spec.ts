import { describe, expect, it } from "vitest";
import { adminListHref, safeAdminReturnTo } from "@/validations/admin";

describe("HU11 contexto administrativo", () => {
  it("conserva materia, cursada y página en comisiones", () => {
    const href = adminListHref({ seccion: "comisiones", materiaId: "m1", cursadaId: "c1", page: 3 });
    const url = new URL(href, "http://localhost");
    expect(url.pathname).toBe("/home/admin/comisiones");
    expect(Object.fromEntries(url.searchParams)).toEqual({ materiaId: "m1", cursadaId: "c1", page: "3" });
  });
  it.each(["https://evil.test", "//evil.test", "/home/admin/usuarios/nuevo", "/home/admin/usuarios?role=ADMIN"])('rechaza retorno no autorizado %s', (value) => {
    expect(safeAdminReturnTo(value)).toBeUndefined();
  });
  it("acepta volver al listado de profesores", () => {
    expect(safeAdminReturnTo("/home/admin/profesores?page=2")).toBe("/home/admin/profesores?page=2");
  });
  // TASK-068: edición desde Experiencias debe conservar la consulta administrativa.
  it("acepta regresar al feed administrativo con carrera, materia y página", () => {
    const origin = "/home/admin/experiencias?carrera=S&materiaId=mat-1&page=3";
    expect(safeAdminReturnTo(origin)).toBe(origin);
  });
  it.each([
    "/home/admin/experiencias?carrera=OTRA",
    "/home/admin/experiencias?page=0",
    "/home/admin/experiencias?page=1&page=2",
    "/home/admin/experiencias?materiaId=",
    "/home/admin/experiencias?role=ADMIN",
    "/home/admin/experiencias?returnTo=https%3A%2F%2Fevil.test",
    "/home/experiencias?carrera=S&page=3",
  ])('rechaza contextos del feed administrativo inválidos: %s', (origin) => {
    expect(safeAdminReturnTo(origin)).toBeUndefined();
  });
});
