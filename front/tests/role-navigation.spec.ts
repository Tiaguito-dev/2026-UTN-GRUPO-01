import { describe, expect, it } from "vitest";
import { roleDestination, roleHome } from "@/lib/navigation";
import { experienciasOriginHref, safeAdminReturnTo } from "@/validations/admin";

describe("TASK-068: destinos según el rol confirmado", () => {
  it("conserva el origen administrativo filtrado para volver desde un detalle", () => {
    const origin = "/home/admin/experiencias?carrera=I&materiaId=mat1&page=3";
    expect(safeAdminReturnTo(origin)).toBe(origin);
  });

  it.each(["https://evil.test", "//evil.test", "/home/experiencias?carrera=S", "/home/admin/../materias", "/home/admin/%2e%2e/materias", "/home/administer"])('el retorno administrativo rechaza %s', (origin) => {
    expect(safeAdminReturnTo(origin)).toBeUndefined();
  });

  it("define un inicio separado para administración", () => {
    expect(roleHome("ADMIN")).toBe("/home/admin");
    expect(roleHome("USER")).toBe("/home");
    expect(roleDestination("ADMIN", "/home")).toBe("/home/admin");
  });

  it.each([
    ["/home/materias", "/home/admin/materias"],
    ["/home/materias/materia-1", "/home/admin/materias/materia-1"],
    ["/home/materias/materia-1/cursadas/cursada-2", "/home/admin/cursadas/cursada-2"],
    ["/home/materias/materia-1/cursadas/cursada-2/comisiones/comision-3", "/home/admin/comisiones/comision-3"],
    ["/home/profesores", "/home/admin/profesores"],
    ["/home/experiencias", "/home/admin/experiencias"],
  ])("traduce %s preservando el identificador real", (source, target) => {
    expect(new URL(roleDestination("ADMIN", source), "https://local.test").pathname).toBe(target);
  });

  it("mantiene filtros y página al abrir el listado de experiencias administrativo", () => {
    const destination = new URL(roleDestination("ADMIN", "/home/experiencias?carrera=S&materiaId=materia-1&page=3"), "https://local.test");
    expect(destination.pathname).toBe("/home/admin/experiencias");
    expect(Object.fromEntries(destination.searchParams)).toEqual({ carrera: "S", materiaId: "materia-1", page: "3" });
  });

  it("traduce el origen de Experiencias al abrir directamente una comisión estudiantil", () => {
    const url = new URL(roleDestination("ADMIN", "/home/materias/m1/cursadas/cu1/comisiones/co1?origen=experiencias&experienciasCarrera=S&experienciasMateriaId=m1&experienciasPage=3"), "https://local.test");
    expect(url.pathname).toBe("/home/admin/comisiones/co1");
    // BUG-02: el origen viaja plano (origen=experiencias), sin un returnTo armado aparte.
    expect(url.searchParams.get("returnTo")).toBeNull();
    expect(experienciasOriginHref(url.searchParams)).toBe("/home/admin/experiencias?carrera=S&materiaId=m1&page=3");
  });

  it("un enlace de publicación ADMIN conserva la comisión pero no abre el formulario", () => {
    expect(roleDestination("ADMIN", "/home/feedback/nuevo?comisionId=co1")).toBe("/home/admin/comisiones/co1");
    expect(roleDestination("ADMIN", "/home/feedback/f1/editar")).toBe("/home/admin/experiencias");
  });

  it.each([
    "/home/admin",
    "/home/admin/materias/materia-1?returnTo=%2Fhome%2Fadmin%2Fmaterias%3Fpage%3D2",
    "/home/admin/comisiones/comision-3/editar",
    "/account",
    "/account/change-password",
  ])("no vuelve a traducir un destino administrativo o personal: %s", (path) => {
    expect(roleDestination("ADMIN", path)).toBe(path);
  });

  it.each([
    "/home",
    "/home/materias?carrera=S&anioCarrera=2&page=3",
    "/home/materias/materia-1/cursadas/cursada-2/comisiones/comision-3",
    "/home/experiencias?materiaId=materia-1&page=2",
    "/home/feedback/comentario-1/editar",
    "/account",
  ])("conserva el recorrido habitual de USER: %s", (path) => {
    expect(roleDestination("USER", path)).toBe(path);
  });

  it.each([
    "https://evil.test/home",
    "//evil.test/home",
    "/home\\evil.test",
    "/home/%2F%2Fevil.test",
    "/home/%2e%2e/account",
    "/home/../account",
    "/home\n/admin",
    "/home#admin",
    "/homepage",
  ])("rechaza un destino ajeno o ambiguo: %s", (path) => {
    expect(roleDestination("ADMIN", path)).toBe("/home/admin");
    expect(roleDestination("USER", path)).toBe("/home");
  });
});
