import { describe, expect, it } from "vitest";
import { adminFormHref, adminListHref, joinedReturnTo, safeAdminReturnTo, safeMateriaListOrigin } from "@/validations/admin";
import {
  academicListReturnTo,
  comisionDetailHref,
  comisionesListHref,
  cursadaDetailHref,
  cursadasListHref,
  materiaDetailHref,
  materiaDetailBack,
  administrativeDetailHref,
  adminEditReturnTo,
  adminNavigationSection,
  comisionNavigation,
  experienciasListReturnTo,
  profesorDetailBack,
} from "@/validations/admin-academic-navigation";

const query = (href: string) => new URL(href, "https://local.test").searchParams;
const context = (returnTo?: string) => new URLSearchParams(returnTo ? { returnTo } : {});

describe("BUG-02: returnTo lleva un solo nivel", () => {
  const materias = "/home/admin/materias?q=algoritmos&carrera=S&page=2";
  const record = { id: "co-1", nombre: "S-31", cursada: { id: "cu-1", anio: 2026, cuatrimestre: "PRIMERO" as const, materia: { id: "m-1", nombre: "Álgebra" } } };
  // Recorrido Materias (filtradas, página 2) → Materia → Cursadas (pág. 2) → Cursada → Comisiones (pág. 3) → Comisión → Editar.
  const materia = materiaDetailHref("m-1", materias);
  const cursadas = adminListHref({ seccion: "cursadas", materiaId: "m-1", materiaReturnTo: materias, page: 2 });
  const cursada = cursadaDetailHref("cu-1", cursadas);
  const comisiones = adminListHref({ seccion: "comisiones", materiaId: "m-1", cursadaId: "cu-1", carrera: "S", materiaReturnTo: materias, page: 3 });
  const comision = comisionDetailHref("co-1", comisiones);
  const navigation = comisionNavigation(query(comision), record);
  const edit = adminFormHref("/home/admin/comisiones/co-1/editar", navigation.detailHref);
  const chain = [materia, cursadas, cursada, comisiones, comision, edit, navigation.back, navigation.detailHref, ...navigation.breadcrumb.flatMap(item => item.href ?? [])];

  it.each(chain)("%s no anida un returnTo dentro de otro", (href) => {
    expect(href).not.toContain("%25");
    expect(query(href).get("returnTo") ?? "").not.toContain("returnTo");
  });

  it("el link Editar comisión es corto", () => {
    expect(edit.length).toBeLessThan(300);
  });

  it("el breadcrumb se deriva de los IDs y Materias conserva sus filtros", () => {
    expect(navigation.breadcrumb.map(item => [item.label, item.href])).toEqual([
      ["Administración", "/home/admin"],
      ["Materias", materias],
      ["Álgebra", materiaDetailHref("m-1", materias)],
      ["Cursadas", cursadasListHref("m-1", materias)],
      ["Cursada 1er cuatrimestre 2026", cursadaDetailHref("cu-1", cursadasListHref("m-1", materias))],
      ["Comisiones", comisiones],
      ["Comisión S-31", undefined],
    ]);
  });

  it("Volver lleva al nivel anterior con su página", () => {
    expect(navigation.back).toBe(comisiones);
    expect(academicListReturnTo(joinedReturnTo(query(cursada)), "cursadas", "m-1")).toBe(cursadas);
  });

  it("Editar vuelve a la comisión y la comisión conserva los filtros de Materias", () => {
    const back = adminEditReturnTo("comisiones", "co-1", joinedReturnTo(query(edit)));
    expect(new URL(back, "https://local.test").pathname).toBe("/home/admin/comisiones/co-1");
    expect(comisionNavigation(query(back), record).breadcrumb[1]).toEqual({ label: "Materias", href: materias });
  });

  it("un link viejo con returnTo anidado degrada al recorrido por IDs", () => {
    const nested = `/home/admin/comisiones?${new URLSearchParams({ materiaId: "m-1", cursadaId: "cu-1", returnTo: cursada })}`;
    expect(safeAdminReturnTo(nested)).toBeUndefined();
    expect(comisionNavigation(context(nested), record).back).toBe(comisionesListHref("m-1", "cu-1", "/home/admin/materias"));
  });
});

describe("contexto de navegación académica administrativa", () => {
  const origin = "/home/admin/materias?q=algoritmos&carrera=S&page=3";

  it("conserva el listado de materias dentro del recorrido hasta comisiones", () => {
    const materia = materiaDetailHref("m-1", origin);
    const cursadas = cursadasListHref("m-1", origin);
    const comisiones = comisionesListHref("m-1", "c-1", origin);
    expect(materiaDetailBack(query(materia).get("returnTo"))).toBe(origin);
    expect(safeMateriaListOrigin(origin)).toBe(origin);
    expect(new URL(cursadas, "https://local.test").searchParams.get("materiaReturnTo")).toBe(origin);
    expect(new URL(comisiones, "https://local.test").searchParams.get("cursadaId")).toBe("c-1");
  });

  it("acepta volver solo a la lista de la misma materia, con sus filtros de Materias", () => {
    const list = adminListHref({ seccion: "cursadas", materiaId: "m-1", materiaReturnTo: origin, page: 2 });
    expect(academicListReturnTo(list, "cursadas", "m-1")).toBe(list);
    expect(academicListReturnTo(list, "cursadas", "m-2")).toBeUndefined();
    const detail = cursadaDetailHref("c-1", list);
    expect(query(detail).get("materiaReturnTo")).toBe(origin);
    expect(academicListReturnTo(joinedReturnTo(query(detail)), "cursadas", "m-1")).toBe(list);
    expect(academicListReturnTo(joinedReturnTo(query(detail)), "cursadas", "m-2")).toBeUndefined();
  });

  it("rechaza un retorno con otro returnTo adentro y acepta el origen de Materias", () => {
    const nested = "/home/admin/cursadas?materiaId=m-1&materiaReturnTo=" + encodeURIComponent(origin)
      + "&returnTo=" + encodeURIComponent("/home/admin/materias/m-1");
    expect(academicListReturnTo(nested, "cursadas", "m-1")).toBeUndefined();
    expect(materiaDetailBack("/home/admin/materias?page=2")).toBe("/home/admin/materias?page=2");
    expect(materiaDetailBack("/home/admin/usuarios?page=2")).toBeUndefined();
  });

  it.each(["https://evil.test/path", "//evil.test/path", "/home/admin/otro"])("rechaza destinos no autorizados: %s", (value) => {
    expect(safeAdminReturnTo(value)).toBeUndefined();
  });

  it("rechaza el detalle de otra materia y la comisión o el padre equivocados", () => {
    expect(safeMateriaListOrigin("/home/admin/materias/m-1")).toBeUndefined();
    expect(academicListReturnTo("/home/admin/comisiones?materiaId=m-1&cursadaId=c-2", "comisiones", "m-1", "c-1")).toBeUndefined();
    expect(academicListReturnTo("/home/admin/cursadas?materiaId=m-2&page=2", "cursadas", "m-1")).toBeUndefined();
  });

  it("limita la cadena de contexto y preserva parámetros administrativos autorizados", () => {
    const bounded = joinedReturnTo(query(cursadaDetailHref("c-1", "/home/admin/cursadas?materiaId=m-1&materiaReturnTo=" + encodeURIComponent(origin))))!;
    expect(new URL(bounded, "https://local.test").pathname).toBe("/home/admin/cursadas");
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
    const commission = comisionDetailHref("co-1", experience);
    expect(Object.fromEntries(query(commission))).toEqual({ origen: "experiencias", experienciasCarrera: "S", experienciasMateriaId: "m-1", experienciasPage: "3" });
    for (const params of [query(commission), context(experience)]) {
      const navigation = comisionNavigation(params, record);
      expect(navigation.back).toBe(experience);
      expect(navigation.breadcrumb).toEqual([
        { label: "Administración", href: "/home/admin" },
        { label: "Experiencias", href: experience },
        { label: "Comisión S-31" },
      ]);
      expect(navigation.detailHref).toBe(commission);
    }
    const navigation = comisionNavigation(query(commission), record);
    // Elegir gestión académica explícitamente abandona el contexto del feed.
    expect(navigation.materiaHref).not.toContain("experiencias");
    expect(navigation.courseHref).not.toContain("experiencias");
  });

  it("conserva el recorrido académico completo con páginas y filtros de sus listas", () => {
    const courses = cursadasListHref("m-1", source);
    const commissions = adminListHref({ seccion: "comisiones", materiaId: "m-1", cursadaId: "cu-1", carrera: "S", materiaReturnTo: source, page: 3 });
    const navigation = comisionNavigation(query(comisionDetailHref("co-1", commissions)), record);
    expect(navigation.back).toBe(commissions);
    expect(navigation.breadcrumb.map(item => item.label)).toEqual(["Administración", "Materias", "Álgebra", "Cursadas", "Cursada 1er cuatrimestre 2026", "Comisiones", "Comisión S-31"]);
    expect(navigation.breadcrumb.find(item => item.label === "Materias")?.href).toBe(source);
    expect(navigation.breadcrumb.find(item => item.label === "Cursadas")?.href).toBe(courses);
    expect(navigation.courseHref).toBe(cursadaDetailHref("cu-1", courses));
  });

  it.each([undefined, "https://externo.test", "/home/admin/usuarios?page=3", "/home/admin/comisiones?materiaId=m-2&cursadaId=cu-2&page=8", "/home/admin/comisiones/co-1"])("rechaza origen incompatible %s y reconstruye los padres reales", (origin) => {
    const navigation = comisionNavigation(context(origin), record);
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

  it("rechaza cualquier lista o detalle con un returnTo adentro", () => {
    const nested = `/home/admin/cursadas?${new URLSearchParams({ materiaId: "m-1", returnTo: "/home/admin/cursadas?materiaId=m-1" })}`;
    expect(safeAdminReturnTo(nested)).toBeUndefined();
    expect(safeAdminReturnTo(`/home/admin/comisiones/co-1?${new URLSearchParams({ returnTo: experience })}`)).toBeUndefined();
  });

  it("edición reutiliza el mismo detalle sin acumular returnTo al guardar de nuevo", () => {
    const detail = administrativeDetailHref("comisiones", "co-1", experience);
    const edit = query(adminFormHref("/home/admin/comisiones/co-1/editar", detail));
    expect(edit.get("returnTo")).toBe(detail);
    expect(adminEditReturnTo("comisiones", "co-1", joinedReturnTo(edit))).toBe(detail);
    expect(administrativeDetailHref("comisiones", "co-1", detail)).toBe(detail);
    expect(administrativeDetailHref("comisiones", "co-1", administrativeDetailHref("comisiones", "co-1", detail))).toBe(detail);
    expect(adminNavigationSection("/home/admin/comisiones/co-1", query(detail))).toBe("experiencias");
    expect(adminNavigationSection("/home/admin/comisiones/co-1/editar", edit)).toBe("experiencias");
  });

  it.each(["https://externo.test", "/home/admin/comisiones/co-2", "/home/admin/usuarios?page=3"])("cancelar edición ignora destino ajeno %s", (origin) => {
    expect(adminEditReturnTo("comisiones", "co-1", origin)).toBe("/home/admin/comisiones/co-1");
  });

  it("profesor del equipo vuelve a comisión sin perder la sección de entrada", () => {
    const commission = administrativeDetailHref("comisiones", "co-1", experience);
    const professor = query(administrativeDetailHref("profesores", "p-1", commission));
    expect(profesorDetailBack(joinedReturnTo(professor))).toBe(commission);
    expect(adminNavigationSection("/home/admin/profesores/p-1", professor)).toBe("experiencias");
    // Un nivel: la edición vuelve al profesor; su comisión ya no viaja en la URL.
    const edit = query(adminFormHref("/home/admin/profesores/p-1/editar", administrativeDetailHref("profesores", "p-1", commission)));
    expect(edit.get("returnTo")).toBe("/home/admin/profesores/p-1");
    expect(adminNavigationSection("/home/admin/profesores/p-1/editar", edit)).toBe("profesores");
    expect(adminNavigationSection("/home/admin/materias/m-1", context(experience))).toBeUndefined();
  });

  it("profesor de una comisión académica marca Materias", () => {
    const commission = comisionDetailHref("co-1", comisionesListHref("m-1", "cu-1", source));
    expect(adminNavigationSection("/home/admin/profesores/p-1", query(administrativeDetailHref("profesores", "p-1", commission)))).toBe("materias");
    expect(adminNavigationSection("/home/admin/comisiones/co-1", query(commission))).toBe("materias");
  });

  it.each(["https://externo.test", "/home/admin/usuarios?page=3", "/home/admin/profesores/p-2", "/home/admin/experiencias?page=3"])("profesor no adopta un contexto incompatible %s", (origin) => {
    expect(profesorDetailBack(origin)).toBe("/home/admin/profesores");
    expect(adminNavigationSection("/home/admin/profesores/p-1", context(origin))).toBe("profesores");
  });
});
