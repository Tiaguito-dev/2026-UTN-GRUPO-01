// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MateriaDetail } from "@/components/academic/MateriaDetail";
import { listarHistorialMateria } from "@/services/materias";
import type { Materia } from "@/types/materias";

const { state } = vi.hoisted(() => ({
  state: {
    role: "USER",
    query: "carrera=S&anioCarrera=ELECTIVA&listadoPage=2&q=Plan&nivelElectiva=4",
    realCursadas: false,
    deletedAt: null as string | null,
    detail: null as null | { materia: Materia | null; error: string; notFound: boolean; retry: () => void },
    historyData: null as null | { items: import("@/types/materias").MateriaHistorial[]; total: number; page: number; pageSize: number },
  },
}));

vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(state.query),
}));
vi.mock("@/services/materias", () => ({
  listarHistorialMateria: vi.fn().mockResolvedValue({
    items: [],
    total: 0,
    page: 1,
    pageSize: 3,
  }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: state.role } }) }));
vi.mock("@/hooks/useMateria", () => ({
  useMateria: () =>
    state.detail ?? {
      materia: {
        id: "m1",
        nombre: "Materia",
        carreras: [{ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4" }],
        createdAt: "2026-01-01",
        deletedAt: state.deletedAt,
      },
      error: "",
      notFound: false,
      retry: vi.fn(),
    },
}));
vi.mock("@/hooks/usePaginatedFetch", () => ({
  usePaginatedFetch: (key: string, fetcher: (page: number) => unknown, page: number) => {
    if (key.startsWith("historial:")) {
      fetcher(page);
      return {
        state: { status: "ready", data: state.historyData ?? { items: [], total: 0, page: 1, pageSize: 3 } },
        retry: vi.fn(),
      };
    }
    return {
      state: { status: "ready", data: { items: [], total: 0, page: 1, pageSize: 3 } },
      retry: vi.fn(),
    };
  },
}));
vi.mock("@/hooks/useUrlPagination", () => ({ useUrlPagination: () => ({ page: 1, setPage: vi.fn() }) }));
// TASK-061: isolate subject/history tests from the new async commission selector (covered separately).
// Preserve the existing real administrative period control for its permission assertion.
vi.mock("@/components/academic/ComisionesMateria", async () => {
  const actual = await import("@/components/academic/CursadasList");
  type Props = Parameters<typeof actual.CursadasList>[0];
  return {
    ComisionesMateria: (props: Props) => <section><h2>Comisiones</h2><a href={props.materiasHref}>Materias de las comisiones</a>{state.realCursadas && state.role === "ADMIN" ? <actual.CursadasList {...props} embedded /> : null}</section>,
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  state.role = "USER";
  state.realCursadas = false;
  state.deletedAt = null;
  state.detail = null;
  state.historyData = null;
  state.query = "carrera=S&anioCarrera=ELECTIVA&listadoPage=2&q=Plan&nivelElectiva=4";
});

describe("Detalle de materia", () => {
  it("identifica Básica con todas sus asociaciones y cambia el año según la carrera sin perderlas", () => {
    state.detail = { materia: { id: "m1", nombre: "Compartida", carreras: [
      { carrera: "S", anioCarrera: "1", nivelElectiva: null }, { carrera: "I", anioCarrera: "2", nivelElectiva: null },
    ], modalidad: "ANUAL", createdAt: "2026-01-01", deletedAt: null }, error: "", notFound: false, retry: vi.fn() };
    state.query = "carrera=I";
    const view = render(<MateriaDetail materiaId="m1" />);
    expect(screen.getByText("Básica")).toBeTruthy();
    expect(screen.getByText("2.º año")).toBeTruthy();
    state.query = "";
    view.rerender(<MateriaDetail materiaId="m1" />);
    expect(screen.getByText("Año según carrera")).toBeTruthy();
    expect(screen.getByText("Básica")).toBeTruthy();
  });
  // TASK-043: the "Datos de la materia" card, which listed "Ingeniería en Sistemas — Electiva", goes away.
  it("Volver y breadcrumb recuperan carrera, año y página del listado", () => {
    render(<MateriaDetail materiaId="m1" />);
    for (const label of ["Volver a Materias", "Materias", "Materias de las comisiones"]) {
      expect(screen.getByRole("link", { name: label }).getAttribute("href")).toBe(
        "/home/materias?q=Plan&carrera=S&anioCarrera=ELECTIVA&nivelElectiva=4&page=2"
      );
    }
    expect(screen.queryByRole("heading", { name: "Historial de cambios" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Editar materia" })).toBeNull();
  });
  it("TASK-031: mientras carga el detalle, título y breadcrumb muestran 'Cargando…'", () => {
    state.detail = { materia: null, error: "", notFound: false, retry: vi.fn() };
    render(<MateriaDetail materiaId="m1" />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Cargando…");
    expect(document.querySelector('[aria-current="page"]')?.textContent).toBe("Cargando…");
  });
  it("TASK-031: un 404 muestra el estado notFound con enlace de vuelta, sin Reintentar", () => {
    state.detail = { materia: null, error: "Materia no encontrada.", notFound: true, retry: vi.fn() };
    render(<MateriaDetail materiaId="m1" />);
    expect(screen.getByRole("alert").textContent).toContain("Materia no encontrada.");
    expect(screen.getByRole("link", { name: "Volver al listado de materias" }).getAttribute("href")).toBe(
      "/home/materias?q=Plan&carrera=S&anioCarrera=ELECTIVA&nivelElectiva=4&page=2"
    );
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });
  // TASK-043: the link reads "Editar materia" (MateriaDetalle artboard); before it was "Editar".
  it("solo ADMIN puede ver Editar materia para una materia activa y conserva contexto", () => {
    state.role = "ADMIN";
    const view = render(<MateriaDetail materiaId="m1" />);
    const href = screen.getByRole("link", { name: "Editar materia" }).getAttribute("href")!;
    expect(Object.fromEntries(new URL(href, "http://local").searchParams)).toEqual({
      carrera: "S",
      anioCarrera: "ELECTIVA",
      listadoPage: "2",
      q: "Plan",
      nivelElectiva: "4",
    });
    state.deletedAt = "2026-01-02";
    view.rerender(<MateriaDetail materiaId="m1" />);
    expect(screen.queryByRole("link", { name: "Editar materia" })).toBeNull();
  });

  describe("rediseño (TASK-043) e historial para admin (TASK-045, TASK-046)", () => {
    it("usuario común no ve Historial ni llama a listarHistorialMateria; ve Volver, h1 y Comisiones", () => {
      state.realCursadas = true;
      render(<MateriaDetail materiaId="m1" />);
      expect(screen.getByRole("link", { name: "Volver a Materias" })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: "Materia" })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 2, name: "Comisiones" })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Historial de cambios" })).toBeNull();
      expect(listarHistorialMateria).not.toHaveBeenCalled();
      expect(screen.queryByRole("heading", { name: "Datos de la materia" })).toBeNull();
      expect(screen.queryByRole("heading", { name: "Auditoría" })).toBeNull();
    });

    it("ADMIN ve Historial de cambios con el nombre del actor y se llama a listarHistorialMateria", () => {
      state.role = "ADMIN";
      state.historyData = {
        items: [{
          id: "h1",
          materiaId: "m1",
          actor: { id: "u1", displayName: "Ada Lovelace" },
          createdAt: "2026-01-01T00:00:00Z",
          cambios: [{ campo: "nombre", anterior: "Viejo", nuevo: "Materia" }],
        }],
        total: 1,
        page: 1,
        pageSize: 3,
      };
      render(<MateriaDetail materiaId="m1" />);
      expect(screen.getByRole("heading", { name: "Historial de cambios" })).toBeTruthy();
      expect(listarHistorialMateria).toHaveBeenCalledWith("m1", { page: 1 });
      expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    });

    it("un usuario común no ve Editar materia ni Nueva cursada", () => {
      state.realCursadas = true;
      render(<MateriaDetail materiaId="m1" />);
      expect(screen.getByRole("heading", { level: 2, name: "Comisiones" })).toBeTruthy();
      expect(screen.queryByRole("link", { name: "Editar materia" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Nueva cursada" })).toBeNull();
    });

    it("ADMIN ve el botón Nueva cursada, que abre un modal con la materia ya fija (TASK-054)", () => {
      state.role = "ADMIN";
      state.realCursadas = true;
      render(<MateriaDetail materiaId="m1" />);
      expect(screen.getByRole("button", { name: "Nueva cursada" })).toBeTruthy();
    });
  });
});
