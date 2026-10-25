import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Breadcrumb } from "../src/components/ui/Breadcrumb";
import { Pagination } from "../src/components/ui/Pagination";
import { MateriasList } from "../src/components/academic/MateriasList";
import { CursadasList } from "../src/components/academic/CursadasList";
import { ComisionesList } from "../src/components/academic/ComisionesList";

const { state, detail, auth } = vi.hoisted(() => ({ state: { value: {} as Record<string, unknown> }, detail: { value: {} as Record<string, unknown> }, auth: { role: "USER" } }));
vi.mock("@/hooks/usePaginatedFetch", () => ({ usePaginatedFetch: () => state.value }));
// TASK-043: the academic screens read the role (useIsAdmin → useAuth) to show admin actions.
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: auth.role } }) }));
vi.mock("@/hooks/useCursada", () => ({ useCursada: () => detail.value }));
vi.mock("@/hooks/useUrlPagination", () => ({ useUrlPagination: () => ({ page: 1, setPage: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));

function setFetchState({ status = "loading", result, error = "", notFound = false }: Partial<{ status: string; result: unknown; error: string; notFound: boolean }>) {
  state.value = { state: { status, data: result, error, notFound }, retry: vi.fn() };
}

describe("Breadcrumb", () => {
  it("renderiza un link para cada nivel con href y texto plano para el nivel actual", () => {
    const html = renderToStaticMarkup(createElement(Breadcrumb, {
      items: [{ label: "Materias", href: "/home/materias" }, { label: "Análisis Matemático" }],
    }));
    expect(html).toContain('href="/home/materias"');
    expect(html).toContain(">Materias<");
    expect(html).toContain('aria-current="page"');
    expect(html).toContain(">Análisis Matemático<");
  });
});

describe("Pagination", () => {
  it("no renderiza nada cuando hay una sola página", () => {
    const html = renderToStaticMarkup(createElement(Pagination, { page: 1, pageSize: 10, total: 5, onChange: vi.fn() }));
    expect(html).toBe("");
  });
  it("deshabilita Anterior en la primera página y deja Siguiente habilitado", () => {
    const html = renderToStaticMarkup(createElement(Pagination, { page: 1, pageSize: 10, total: 25, onChange: vi.fn() }));
    expect(html).toContain('aria-label="Página anterior" disabled="">Anterior<');
    expect(html).toContain('aria-label="Página siguiente">Siguiente<');
    expect(html).toContain("Página 1 de 3");
  });
  it("habilita ambos botones en una página intermedia", () => {
    const html = renderToStaticMarkup(createElement(Pagination, { page: 2, pageSize: 10, total: 25, onChange: vi.fn() }));
    expect(html).toContain('aria-label="Página anterior">Anterior<');
    expect(html).toContain('aria-label="Página siguiente">Siguiente<');
  });
  it("deshabilita Siguiente en la última página", () => {
    const html = renderToStaticMarkup(createElement(Pagination, { page: 3, pageSize: 10, total: 25, onChange: vi.fn() }));
    expect(html).toContain('aria-label="Página anterior">Anterior<');
    expect(html).toContain('aria-label="Página siguiente" disabled="">Siguiente<');
  });
});

describe("MateriasList", () => {
  it("muestra el estado de carga", () => {
    setFetchState({ status: "loading" });
    const html = renderToStaticMarkup(createElement(MateriasList));
    expect(html).toContain("Cargando materias…");
  });
  it("muestra el estado vacío cuando items: []", () => {
    setFetchState({ status: "ready", result: { items: [], total: 0, page: 1, pageSize: 10 } });
    const html = renderToStaticMarkup(createElement(MateriasList));
    expect(html).toContain("No hay materias que coincidan con la búsqueda y los filtros.");
  });
  it("muestra un mensaje claro en error, no un stack", () => {
    setFetchState({ status: "error", error: "Lo sentimos. No pudimos completar la solicitud, intentá nuevamente." });
    const html = renderToStaticMarkup(createElement(MateriasList));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Lo sentimos. No pudimos completar la solicitud, intentá nuevamente.");
    expect(html).not.toMatch(/at \w+ \(/);
  });
  it("muestra el listado y la paginación cuando hay más de una página", () => {
    setFetchState({
      status: "ready",
      result: {
        items: [{ id: "m1", nombre: "Álgebra", carreras: [{ carrera: "S", anioCarrera: "1", nivelElectiva: null }], createdAt: "", deletedAt: null }],
        total: 25,
        page: 1,
        pageSize: 10,
      },
    });
    const html = renderToStaticMarkup(createElement(MateriasList));
    expect(html).toContain("Álgebra");
    expect(html).toContain('href="/home/materias/m1"');
    expect(html).toContain("Página 1 de 3");
  });
});

describe("CursadasList", () => {
  it("muestra el estado de carga", () => {
    setFetchState({ status: "loading" });
    const html = renderToStaticMarkup(createElement(CursadasList, { materiaId: "m1", materiaNombre: "Álgebra" }));
    expect(html).toContain("Cargando cursadas…");
  });
  it("muestra el estado vacío cuando items: []", () => {
    setFetchState({ status: "ready", result: { items: [], total: 0, page: 1, pageSize: 10 } });
    const html = renderToStaticMarkup(createElement(CursadasList, { materiaId: "m1", materiaNombre: "Álgebra" }));
    expect(html).toContain("Esta materia todavía no tiene cursadas cargadas.");
  });
  it("muestra un mensaje claro en error (404), no un stack", () => {
    setFetchState({ status: "error", error: "No encontramos esta materia." });
    const html = renderToStaticMarkup(createElement(CursadasList, { materiaId: "m1", materiaNombre: "Álgebra" }));
    expect(html).toContain('role="alert"');
    expect(html).toContain("No encontramos esta materia.");
    expect(html).not.toMatch(/at \w+ \(/);
  });
  it("muestra el listado y la paginación con el nombre de materia recibido", () => {
    setFetchState({
      status: "ready",
      result: { items: [{ id: "c1", anio: 2026, cuatrimestre: "PRIMERO", comisiones: 2, profesores: 3, carreras: ["S", "C"] }], total: 15, page: 1, pageSize: 10 },
    });
    const html = renderToStaticMarkup(createElement(CursadasList, { materiaId: "m1", materiaNombre: "Álgebra" }));
    expect(html).toContain(">Álgebra<");
    expect(html).toContain("1er cuatrimestre 2026");
    expect(html).toContain('href="/home/materias/m1/cursadas/c1"');
    expect(html).toContain("2 comisiones");
    expect(html).toContain("3 profesores");
    expect(html).toContain('class="academic-tag">S<');
    expect(html).toContain('class="academic-tag">C<');
    expect(html).toContain("Página 1 de 2");
  });
  it("decisión TASK-018 4.2: sin materiaNombre por query param, usa la etiqueta genérica 'Materia'", () => {
    setFetchState({ status: "ready", result: { items: [], total: 0, page: 1, pageSize: 10 } });
    const html = renderToStaticMarkup(createElement(CursadasList, { materiaId: "m1", materiaNombre: undefined }));
    expect(html).toContain(">Materia<");
    expect(html).not.toContain("Álgebra");
  });
});

describe("ComisionesList", () => {
  const baseProps = { materiaId: "m1", cursadaId: "c1" };
  const cursada = { id: "c1", anio: 2026, cuatrimestre: "PRIMERO", materia: { id: "m1", nombre: "Álgebra" } };
  beforeEach(() => { auth.role = "USER"; detail.value = { cursada, error: "", notFound: false, retry: vi.fn() }; });

  describe("rediseño (TASK-043)", () => {
    const nuevaComisionHref = (html: string) => {
      const href = html.match(/<a [^>]*href="([^"]*)"[^>]*>Nueva comisión<\/a>/)?.[1];
      return href === undefined ? undefined : new URL(href.replaceAll("&amp;", "&"), "http://local");
    };

    it("eyebrow con la materia y h1 con el período", () => {
      setFetchState({ status: "ready", result: { items: [], total: 0, page: 1, pageSize: 10 } });
      const html = renderToStaticMarkup(createElement(ComisionesList, baseProps));
      expect(html).toMatch(/<p class="eyebrow">Álgebra<\/p>/);
      expect(html).toMatch(/<h1[^>]*>1er cuatrimestre 2026<\/h1>/);
    });
    it("usuario común no ve Nueva comisión", () => {
      setFetchState({ status: "ready", result: { items: [], total: 0, page: 1, pageSize: 10 } });
      expect(nuevaComisionHref(renderToStaticMarkup(createElement(ComisionesList, baseProps)))).toBeUndefined();
    });
    it("ADMIN ve Nueva comisión hacia el alta con la cursada precargada por query (decisión 2)", () => {
      auth.role = "ADMIN";
      setFetchState({ status: "ready", result: { items: [], total: 0, page: 1, pageSize: 10 } });
      const url = nuevaComisionHref(renderToStaticMarkup(createElement(ComisionesList, baseProps)));
      expect(url?.pathname).toBe("/home/admin/comisiones/nueva");
      expect(url?.searchParams.get("cursadaId")).toBe("c1");
    });
  });

  it("muestra el estado de carga", () => {
    setFetchState({ status: "loading" });
    const html = renderToStaticMarkup(createElement(ComisionesList, baseProps));
    expect(html).toContain("Cargando comisiones…");
  });
  it("muestra el estado vacío cuando items: []", () => {
    setFetchState({ status: "ready", result: { items: [], total: 0, page: 1, pageSize: 10 } });
    const html = renderToStaticMarkup(createElement(ComisionesList, baseProps));
    expect(html).toContain("Esta cursada todavía no tiene comisiones cargadas.");
  });
  it("muestra un mensaje claro en error (404), no un stack", () => {
    setFetchState({ status: "error", error: "No encontramos esta cursada." });
    const html = renderToStaticMarkup(createElement(ComisionesList, baseProps));
    expect(html).toContain('role="alert"');
    expect(html).toContain("No encontramos esta cursada.");
    expect(html).not.toMatch(/at \w+ \(/);
  });
  it("muestra el listado y la paginación, con el breadcrumb completo de 3 niveles y enlace al detalle", () => {
    setFetchState({
      status: "ready",
      result: {
        items: [
          {
            id: "co1",
            cursadaId: "c1",
            carrera: "S",
            numero: 31,
            nombre: "S-31",
            activa: true,
            profesores: [{ id: "p1", nombreCompleto: "Prof. Rossi", cargo: "TITULAR" }],
            createdAt: "",
            deletedAt: null,
          },
        ],
        total: 12,
        page: 1,
        pageSize: 10,
      },
    });
    const html = renderToStaticMarkup(createElement(ComisionesList, baseProps));
    expect(html).toContain(">Materias<");
    expect(html).toContain(">Álgebra<");
    expect(html).toContain("1er cuatrimestre 2026");
    expect(html).toContain("S-31");
    expect(html).toContain('href="/home/materias/m1/cursadas/c1/comisiones/co1"');
    expect(html).toContain("Prof. Rossi (Titular)");
    expect(html).toContain("Página 1 de 2");
  });
  it("TASK-031: con una URL editada a mano, nombre y enlace de vuelta salen de la misma materia del detalle", () => {
    detail.value = { cursada: { ...cursada, materia: { id: "z1", nombre: "Física" } }, error: "", notFound: false, retry: vi.fn() };
    setFetchState({ status: "ready", result: { items: [], total: 0, page: 1, pageSize: 10 } });
    const html = renderToStaticMarkup(createElement(ComisionesList, baseProps));
    expect(html).toContain('href="/home/materias/z1"');
    expect(html).not.toContain('href="/home/materias/m1"');
    expect(html).toContain(">Física<");
  });
  it("TASK-031 decisión 2: mientras carga el detalle, título y breadcrumb muestran 'Cargando…'", () => {
    detail.value = { cursada: null, error: "", notFound: false, retry: vi.fn() };
    setFetchState({ status: "ready", result: { items: [], total: 0, page: 1, pageSize: 10 } });
    const html = renderToStaticMarkup(createElement(ComisionesList, baseProps));
    expect(html).toMatch(/<h1[^>]*>Cargando…<\/h1>/);
    expect(html).not.toContain("Álgebra");
  });
  it("si el detalle da 404, muestra el estado notFound con el enlace de vuelta en vez del listado", () => {
    detail.value = { cursada: null, error: "Cursada no encontrada.", notFound: true, retry: vi.fn() };
    setFetchState({ status: "ready", result: { items: [{ id: "co1", cursadaId: "c1", carrera: "S", numero: 31, nombre: "S-31", activa: true, profesores: [], createdAt: "", deletedAt: null }], total: 1, page: 1, pageSize: 10 } });
    const html = renderToStaticMarkup(createElement(ComisionesList, baseProps));
    expect(html).toContain('role="alert"');
    expect(html).toContain("Cursada no encontrada.");
    expect(html).toContain('href="/home/materias/m1"');
    expect(html).not.toContain("Reintentar");
    expect(html).not.toContain("S-31");
  });
});
