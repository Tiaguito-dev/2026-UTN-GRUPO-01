import { describe, expect, it } from "vitest";
import { adminListHref, safeAdminReturnTo, safeMateriaListOrigin } from "@/validations/admin";
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
  administrativeDetailHref,
  adminEditReturnTo,
  adminNavigationSection,
  comisionNavigation,
  experienciasListReturnTo,
  profesorDetailBack,
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

describe("contexto compartido de comisión y Experiencias", () => {
  const experience = "/home/admin/experiencias?carrera=S&materiaId=m-1&page=3";
  const record = { id: "co-1", nombre: "S-31", cursada: { id: "cu-1", anio: 2026, cuatrimestre: "PRIMERO" as const, materia: { id: "m-1", nombre: "Álgebra" } } };
  const source = "/home/admin/materias?q=Plan&carrera=S&page=4";

  it("elige el listado de Experiencias para breadcrumb y Volver sin inventar padres intermedios", () => {
    const navigation = comisionNavigation(experience, record);
    expect(navigation.back).toBe(experience);
    expect(navigation.breadcrumb).toEqual([
      { label: "Administración", href: "/home/admin" },
      { label: "Experiencias", href: experience },
      { label: "Comisión S-31" },
    ]);
    expect(new URL(navigation.detailHref, "https://local.test").searchParams.get("returnTo")).toBe(experience);
    // Elegir gestión académica explícitamente abandona el contexto del feed.
    expect(navigation.materiaHref).not.toContain("experiencias");
    expect(navigation.courseHref).not.toContain("experiencias");
  });

  it("conserva el recorrido académico completo con páginas y filtros de sus listas", () => {
    const materia = materiaDetailHref("m-1", source);
    const courses = adminListHref({ seccion: "cursadas", materiaId: "m-1", materiaReturnTo: source, returnTo: materia, page: 2 });
    const course = cursadaDetailHref("cu-1", courses);
    const commissions = adminListHref({ seccion: "comisiones", materiaId: "m-1", cursadaId: "cu-1", carrera: "S", materiaReturnTo: source, returnTo: course, page: 3 });
    const navigation = comisionNavigation(commissions, record);
    expect(navigation.back).toBe(commissions);
    expect(navigation.breadcrumb.map(item => item.label)).toEqual(["Administración", "Materias", "Álgebra", "Cursadas", "Cursada 1er cuatrimestre 2026", "Comisiones", "Comisión S-31"]);
    expect(navigation.breadcrumb.find(item => item.label === "Materias")?.href).toBe(source);
    expect(navigation.breadcrumb.find(item => item.label === "Cursadas")?.href).toBe(courses);
    expect(navigation.courseHref).toBe(course);
  });

  it.each([undefined, "https://externo.test", "/home/admin/usuarios?page=3", "/home/admin/comisiones?materiaId=m-2&cursadaId=cu-2&page=8", "/home/admin/comisiones/co-1"])("rechaza origen incompatible %s y reconstruye los padres reales", (origin) => {
    const navigation = comisionNavigation(origin, record);
    const back = new URL(navigation.back, "https://local.test");
    expect(back.pathname).toBe("/home/admin/comisiones");
    expect(back.searchParams.get("materiaId")).toBe("m-1");
    expect(back.searchParams.get("cursadaId")).toBe("cu-1");
    expect(back.searchParams.get("page")).toBeNull();
    expect(navigation.breadcrumb.map(item => item.label)).not.toContain("Experiencias");
  });

  it.each([
    "https://externo.test/home/admin/experiencias", "//externo.test/home/admin/experiencias",
    "/home/admin/../admin/experiencias", "/home/admin/%2e%2e/admin/experiencias",
    "/home/admin/experiencias#tarjeta", "/home/admin/experiencias?page=0",
    "/home/admin/experiencias?page=2&page=3", "/home/admin/experiencias?carrera=X",
    "/home/admin/experiencias?returnTo=%2Fhome%2Fadmin%2Fexperiencias", "/home/admin/experiencias/f1",
    "/home/experiencias?carrera=S&page=3",
  ])("el origen de Experiencias rechaza %s", (origin) => {
    expect(experienciasListReturnTo(origin)).toBeUndefined();
  });

  it("elimina mensajes transitorios sin perder los filtros del origen", () => {
    expect(experienciasListReturnTo(`${experience}&successMessage=Guardado&creationOutsideFilters=1`)).toBe(experience);
  });

  it("limita cadenas construidas con listas además de detalles", () => {
    let nested = "/home/admin/cursadas?materiaId=m-1";
    for (let index = 0; index < 10; index += 1) nested = `/home/admin/cursadas?${new URLSearchParams({ materiaId: "m-1", returnTo: nested })}`;
    expect(safeAdminReturnTo(nested)).toBeUndefined();
  });

  it("edición reutiliza el mismo detalle sin acumular returnTo al guardar de nuevo", () => {
    const detail = administrativeDetailHref("comisiones", "co-1", experience);
    expect(adminEditReturnTo("comisiones", "co-1", detail)).toBe(detail);
    expect(administrativeDetailHref("comisiones", "co-1", detail)).toBe(detail);
    expect(administrativeDetailHref("comisiones", "co-1", administrativeDetailHref("comisiones", "co-1", detail))).toBe(detail);
    expect(adminNavigationSection("/home/admin/comisiones/co-1/editar", detail)).toBe("experiencias");
  });

  it.each(["https://externo.test", "/home/admin/comisiones/co-2", "/home/admin/usuarios?page=3"])("cancelar edición ignora destino ajeno %s", (origin) => {
    expect(adminEditReturnTo("comisiones", "co-1", origin)).toBe("/home/admin/comisiones/co-1");
  });

  it("profesor del equipo vuelve a comisión sin perder la sección de entrada", () => {
    const commission = administrativeDetailHref("comisiones", "co-1", experience);
    const professor = administrativeDetailHref("profesores", "p-1", commission);
    expect(profesorDetailBack(commission)).toBe(commission);
    expect(adminNavigationSection("/home/admin/profesores/p-1", commission)).toBe("experiencias");
    expect(adminNavigationSection("/home/admin/profesores/p-1/editar", professor)).toBe("experiencias");
    expect(adminNavigationSection("/home/admin/materias/m-1", experience)).toBeUndefined();
  });

  it.each(["https://externo.test", "/home/admin/usuarios?page=3", "/home/admin/profesores/p-2", "/home/admin/experiencias?page=3"])("profesor no adopta un contexto incompatible %s", (origin) => {
    expect(profesorDetailBack(origin)).toBe("/home/admin/profesores");
    expect(adminNavigationSection("/home/admin/profesores/p-1", origin)).toBe("profesores");
  });
});
