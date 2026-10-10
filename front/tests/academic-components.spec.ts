import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumb } from "../src/components/academic/Breadcrumb";
import { Pagination } from "../src/components/academic/Pagination";
import { MateriasList } from "../src/components/academic/MateriasList";
import { CursadasList } from "../src/components/academic/CursadasList";
import { ComisionesList } from "../src/components/academic/ComisionesList";

const { state } = vi.hoisted(() => ({ state: { value: {} as Record<string, unknown> } }));
vi.mock("@/hooks/usePaginatedFetch", () => ({ usePaginatedFetch: () => state.value }));
vi.mock("@/hooks/useUrlPageParam", () => ({ useUrlPageParam: () => [1, vi.fn()] }));

function setFetchState(overrides: Partial<{ status: string; result: unknown; error: string; notFound: boolean; page: number; setPage: (page: number) => void; retry: () => void }>) {
  state.value = { status: "loading", result: null, error: "", notFound: false, page: 1, setPage: vi.fn(), retry: vi.fn(), ...overrides };
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
    expect(html).toContain("Todavía no hay materias cargadas.");
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
      page: 1,
      result: { items: [{ id: "m1", nombre: "Álgebra", createdAt: "", deletedAt: null }], total: 25, page: 1, pageSize: 10 },
    });
    const html = renderToStaticMarkup(createElement(MateriasList));
    expect(html).toContain("Álgebra");
    expect(html).toContain('href="/home/materias/m1?nombre=%C3%81lgebra"');
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
      page: 1,
      result: { items: [{ id: "c1", anio: 2026, cuatrimestre: "PRIMERO", profesor: "Prof. Rossi" }], total: 15, page: 1, pageSize: 10 },
    });
    const html = renderToStaticMarkup(createElement(CursadasList, { materiaId: "m1", materiaNombre: "Álgebra" }));
    expect(html).toContain(">Álgebra<");
    expect(html).toContain("1er cuatrimestre 2026");
    expect(html).toContain("Prof. Rossi");
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
  const baseProps = { materiaId: "m1", cursadaId: "c1", materiaNombre: "Álgebra", anio: 2026, cuatrimestre: "PRIMERO" as const };

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
  it("muestra el listado y la paginación, con el breadcrumb completo de 3 niveles", () => {
    setFetchState({
      status: "ready",
      page: 1,
      result: { items: [{ id: "co1", cursadaId: "c1", nombre: "Comisión A", activa: true, createdAt: "", deletedAt: null }], total: 12, page: 1, pageSize: 10 },
    });
    const html = renderToStaticMarkup(createElement(ComisionesList, baseProps));
    expect(html).toContain(">Materias<");
    expect(html).toContain(">Álgebra<");
    expect(html).toContain("1er cuatrimestre 2026");
    expect(html).toContain("Comisión A");
    expect(html).toContain("Página 1 de 2");
  });
  it("decisión TASK-018 4.2: sin materiaNombre/anio/cuatrimestre por query param, usa etiquetas genéricas", () => {
    setFetchState({ status: "ready", result: { items: [], total: 0, page: 1, pageSize: 10 } });
    const html = renderToStaticMarkup(createElement(ComisionesList, { materiaId: "m1", cursadaId: "c1", materiaNombre: undefined, anio: undefined, cuatrimestre: undefined }));
    expect(html).toContain(">Materia<");
    expect(html).toContain(">Período<");
  });
});
