import { describe, expect, it } from "vitest";
import { safeAdminReturnTo, safeMateriaListOrigin } from "@/validations/admin";
import {
  academicListReturnTo,
  comisionesListHref,
  cursadaDetailHref,
  cursadaDetailReturnTo,
  cursadaListOrigin,
  cursadasListHref,
  materiaDetailHref,
  materiaDetailBack,
  materiaDetailReturnTo,
} from "@/validations/admin-academic-navigation";

describe("contexto de navegación académica administrativa", () => {
  const origin = "/home/admin/materias?q=algoritmos&carrera=S&page=3";

  it("conserva el listado de materias dentro del recorrido hasta comisiones", () => {
    const materia = materiaDetailHref("m-1", origin);
    const cursadas = cursadasListHref("m-1", origin);
    const comisiones = comisionesListHref("m-1", "c-1", origin);
    expect(materiaDetailReturnTo(materia, "m-1")).toBe(materia);
    expect(safeMateriaListOrigin(origin)).toBe(origin);
    expect(new URL(cursadas, "https://local.test").searchParams.get("materiaReturnTo")).toBe(origin);
    expect(new URL(comisiones, "https://local.test").searchParams.get("cursadaId")).toBe("c-1");
  });

  it("acepta volver solo a la lista o al detalle padre coherente", () => {
    const list = "/home/admin/cursadas?materiaId=m-1&materiaReturnTo=" + encodeURIComponent(origin) + "&page=2";
    expect(academicListReturnTo(list, "cursadas", "m-1")).toBe(list);
    expect(academicListReturnTo(list, "cursadas", "m-2")).toBeUndefined();
    const detail = cursadaDetailHref("c-1", list);
    expect(cursadaDetailReturnTo(detail, "c-1", "m-1")).toBe(detail);
    expect(cursadaListOrigin(detail, "c-1", "m-1")).toBe(list);
    expect(cursadaDetailReturnTo(cursadaDetailHref("c-2", list), "c-1", "m-1")).toBeUndefined();
  });

  it("valida que el retorno de la cursada y el origen del listado sean el mismo", () => {
    const mismatched = "/home/admin/cursadas?materiaId=m-1&materiaReturnTo=" + encodeURIComponent(origin)
      + "&returnTo=" + encodeURIComponent("/home/admin/materias/m-1?returnTo=%2Fhome%2Fadmin%2Fmaterias%3Fpage%3D2");
    expect(academicListReturnTo(mismatched, "cursadas", "m-1")).toBeUndefined();
    expect(materiaDetailBack("/home/admin/materias?page=2")).toBe("/home/admin/materias?page=2");
    expect(materiaDetailBack("/home/admin/usuarios?page=2")).toBeUndefined();
  });

  it.each(["https://evil.test/path", "//evil.test/path", "/home/admin/otro"])("rechaza destinos no autorizados: %s", (value) => {
    expect(safeAdminReturnTo(value)).toBeUndefined();
  });

  it("rechaza el detalle de otra materia y la comisión o el padre equivocados", () => {
    expect(safeMateriaListOrigin("/home/admin/materias/m-1")).toBeUndefined();
    expect(academicListReturnTo("/home/admin/comisiones?materiaId=m-1&cursadaId=c-2", "comisiones", "m-1", "c-1")).toBeUndefined();
    expect(academicListReturnTo("/home/admin/cursadas?materiaId=m-1&returnTo=%2Fhome%2Fadmin%2Fmaterias%2Fm-2", "cursadas", "m-1")).toBeUndefined();
  });

  it("limita la cadena de contexto y preserva parámetros administrativos autorizados", () => {
    const bounded = cursadaDetailHref("c-1", "/home/admin/cursadas?materiaId=m-1&materiaReturnTo=" + encodeURIComponent(origin));
    expect(safeAdminReturnTo(bounded)).toBe(bounded);
    expect(safeAdminReturnTo("/home/admin/materias?returnTo=%2Fhome%2Fadmin%2Fm%2Fdeep")).toBeUndefined();
    expect(safeMateriaListOrigin("/home/admin/materias/m-1")).toBeUndefined();
  });
});
