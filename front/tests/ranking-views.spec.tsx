// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ProfesoresRanking } from "@/components/ranking/ProfesoresRanking";
import { PerfilProfesor } from "@/components/ranking/PerfilProfesor";
import { ComisionesRanking } from "@/components/ranking/ComisionesRanking";
import { ValoracionComision, useValoracionesCursada } from "@/components/ranking/ValoracionComision";
import { listarRankingComisiones, listarRankingProfesores, obtenerRankingProfesor, type RankingComision, type RankingProfesor } from "@/services/ranking";
import { listarFeedback } from "@/services/feedback";
import { HttpError } from "@/services/http";

vi.mock("next/link", () => import("./support/next-link"));
const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
  usePathname: () => "/home/profesores",
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
}));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => false }));
vi.mock("@/services/ranking", () => ({ listarRankingComisiones: vi.fn(), listarRankingProfesores: vi.fn(), obtenerRankingProfesor: vi.fn() }));
vi.mock("@/services/feedback", () => ({ listarFeedback: vi.fn() }));

const contexto = {
  comision: { id: "c1", nombre: "S-31", carrera: "S" as const, activa: true },
  materia: { id: "m1", nombre: "Paradigmas" },
  cursada: { id: "cu1", anio: 2026, cuatrimestre: "PRIMERO" as const },
};
const profesor = (overrides: Partial<RankingProfesor> = {}): RankingProfesor => ({
  posicion: 1, profesor: { id: "p1", nombreCompleto: "Ana Pérez" }, valoracion: { promedio: 4.3, cantidad: 12 },
  comisiones: [{ ...contexto, cargo: "TITULAR", valoracion: { promedio: 4.5, cantidad: 10 } }, { ...contexto, comision: { ...contexto.comision, id: "c2", nombre: "S-32" }, cargo: "TITULAR", valoracion: { promedio: 3, cantidad: 2 } }],
  ...overrides,
});
const page = <T,>(items: T[], total = items.length) => ({ items, total, page: 1, pageSize: 10 });

beforeEach(() => { vi.clearAllMocks(); navigation.query = ""; });
afterEach(cleanup);

describe("Profesores: ranking y búsqueda", () => {
  it("lista el ranking con puesto, cargos, estrellas y enlace al perfil", async () => {
    vi.mocked(listarRankingProfesores).mockResolvedValue(page([profesor(), profesor({ posicion: 4, profesor: { id: "p2", nombreCompleto: "Beto Gómez" }, comisiones: [] })], 21));
    render(<ProfesoresRanking />);
    const ranking = await screen.findByRole("list", { name: "Ranking de profesores" });
    const [primero, segundo] = within(ranking).getAllByRole("link");
    expect(primero!.getAttribute("href")).toBe("/home/profesores/p1");
    expect(within(primero!).getByLabelText("Puesto 1")).toBeTruthy();
    expect(within(primero!).getByText("Titular en 2 comisiones")).toBeTruthy();
    expect(within(primero!).getByText("4,3 de 5 estrellas")).toBeTruthy();
    expect(within(segundo!).getByLabelText("Puesto 4")).toBeTruthy();
    expect(screen.getByText("21 profesores con valoraciones")).toBeTruthy();
    expect(listarRankingProfesores).toHaveBeenCalledWith({ page: 1, pageSize: 10, q: undefined });
  });

  it("busca por la URL y muestra al final, sin puesto, a quien no tiene votos", async () => {
    navigation.query = "q=ana";
    vi.mocked(listarRankingProfesores).mockResolvedValue(page([profesor(), profesor({ posicion: null, profesor: { id: "p3", nombreCompleto: "Ana Sosa" }, valoracion: { promedio: null, cantidad: 0 }, comisiones: [] })]));
    render(<ProfesoresRanking />);
    const resultados = await screen.findByRole("list", { name: "Profesores encontrados" });
    expect(within(resultados).getByLabelText("Sin puesto")).toBeTruthy();
    expect(within(resultados).getByText("Sin valoraciones")).toBeTruthy();
    expect(screen.getByText("Los profesores con pocas o ninguna valoración aparecen al final, sin puesto.")).toBeTruthy();
    expect(listarRankingProfesores).toHaveBeenCalledWith({ page: 1, pageSize: 10, q: "ana" });
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar por nombre" }), { target: { value: "  beto " } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(navigation.replace).toHaveBeenCalledWith("/home/profesores?q=beto", { scroll: false });
  });

  it("sin resultados ofrece limpiar la búsqueda", async () => {
    navigation.query = "q=zzz";
    vi.mocked(listarRankingProfesores).mockResolvedValue(page([]));
    render(<ProfesoresRanking />);
    expect(await screen.findByText("No hay profesores que coincidan con “zzz”.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(navigation.replace).toHaveBeenCalledWith("/home/profesores", { scroll: false });
  });

  it("rechaza una búsqueda con caracteres de control sin navegar", async () => {
    vi.mocked(listarRankingProfesores).mockResolvedValue(page([]));
    render(<ProfesoresRanking />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar por nombre" }), { target: { value: "a\u0007" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect((await screen.findByRole("alert")).textContent).toContain("caracteres de control");
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

describe("Ranking en el espacio de administración", () => {
  it("los enlaces del ADMIN quedan dentro de /home/admin", async () => {
    vi.mocked(listarRankingProfesores).mockResolvedValue(page([profesor()]));
    render(<ProfesoresRanking admin />);
    expect(screen.getByRole("heading", { level: 1, name: "Ranking de profesores" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Ranking de comisiones" }).getAttribute("href")).toBe("/home/admin/ranking/comisiones");
    const ranking = await screen.findByRole("list", { name: "Ranking de profesores" });
    expect(within(ranking).getByRole("link").getAttribute("href")).toBe("/home/admin/ranking/profesores/p1");
    cleanup();
    vi.mocked(listarRankingComisiones).mockResolvedValue(page([{ ...contexto, posicion: 1, valoracion: { promedio: 4, cantidad: 3 } }]));
    render(<ComisionesRanking admin />);
    const row = (await screen.findByRole("list", { name: "Ranking de comisiones" })).querySelector("a")!;
    expect(row.getAttribute("href")).toMatch(/^\/home\/admin\/comisiones\/c1/);
  });
});

describe("Perfil del profesor", () => {
  it("muestra el resumen, el desglose por comisión y solo sus comentarios", async () => {
    vi.mocked(obtenerRankingProfesor).mockResolvedValue(profesor());
    vi.mocked(listarFeedback).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 9 });
    render(<PerfilProfesor profesorId="p1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Ana Pérez" })).toBeTruthy();
    expect(screen.getByText("12 valoraciones en 2 comisiones")).toBeTruthy();
    expect(screen.getByText("Puesto 1 del ranking")).toBeTruthy();
    const comisiones = screen.getByRole("list", { name: "Valoración por comisión" });
    expect(within(comisiones).getAllByRole("link")[0]!.getAttribute("href")).toBe("/home/materias/m1/cursadas/cu1/comisiones/c1");
    expect(within(comisiones).getByText("Comisión S-31 · Paradigmas")).toBeTruthy();
    expect(await screen.findByText("Todavía no hay comentarios sobre este profesor.")).toBeTruthy();
    expect(listarFeedback).toHaveBeenCalledWith({ page: 1, pageSize: 9, profesorId: "p1" });
  });

  it("sin votos no muestra puesto y explica que nadie lo valoró", async () => {
    vi.mocked(obtenerRankingProfesor).mockResolvedValue(profesor({ posicion: null, valoracion: { promedio: null, cantidad: 0 }, comisiones: [] }));
    vi.mocked(listarFeedback).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 9 });
    render(<PerfilProfesor profesorId="p1" />);
    expect(await screen.findByText("Todavía nadie lo valoró en sus comisiones.")).toBeTruthy();
    expect(screen.queryByText(/Puesto/)).toBeNull();
  });

  it("un profesor inexistente ofrece volver a Profesores", async () => {
    vi.mocked(obtenerRankingProfesor).mockRejectedValue(new HttpError(404, "El profesor solicitado no existe."));
    render(<PerfilProfesor profesorId="p9" />);
    expect((await screen.findByRole("link", { name: "Volver a Profesores" })).getAttribute("href")).toBe("/home/profesores");
    expect(listarFeedback).not.toHaveBeenCalled();
  });
});

describe("Ranking de comisiones", () => {
  const item = (posicion: number, id: string): RankingComision => ({ ...contexto, comision: { ...contexto.comision, id }, posicion, valoracion: { promedio: 4, cantidad: 3 } });

  it("enlaza cada comisión a su detalle y filtra por mínimo de valoraciones desde la URL", async () => {
    navigation.query = "min=3";
    vi.mocked(listarRankingComisiones).mockResolvedValue(page([item(1, "c1")]));
    render(<ComisionesRanking />);
    const row = (await screen.findByRole("list", { name: "Ranking de comisiones" })).querySelector("a")!;
    expect(row.getAttribute("href")).toBe("/home/materias/m1/cursadas/cu1/comisiones/c1");
    expect(listarRankingComisiones).toHaveBeenCalledWith({ page: 1, pageSize: 10, minValoraciones: 3 });
    expect(screen.getByRole("button", { name: "Con 3 o más" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Todas" }));
    expect(navigation.replace).toHaveBeenCalledWith("/home/profesores", { scroll: false });
  });
});

function Tarjetas({ ids }: { ids: string[] }) {
  const valoraciones = useValoracionesCursada("cu1");
  return <>{ids.map((id) => <div key={id} data-testid={id}><ValoracionComision comisionId={id} valoraciones={valoraciones} /></div>)}</>;
}

describe("Valoración en las tarjetas de comisión", () => {
  it("marca como mejor valorada solo a la primera cuando hay con quién comparar", async () => {
    vi.mocked(listarRankingComisiones).mockResolvedValue(page([
      { ...contexto, comision: { ...contexto.comision, id: "c2" }, posicion: 1, valoracion: { promedio: 4.7, cantidad: 3 } },
      { ...contexto, posicion: 2, valoracion: { promedio: 4, cantidad: 1 } },
    ]));
    render(<Tarjetas ids={["c1", "c2", "c3"]} />);
    expect(await within(screen.getByTestId("c2")).findByText("Mejor valorada")).toBeTruthy();
    expect(within(screen.getByTestId("c1")).getByText("4,0 de 5 estrellas")).toBeTruthy();
    expect(within(screen.getByTestId("c3")).getByText("Sin valoraciones")).toBeTruthy();
    expect(screen.getAllByText("Mejor valorada")).toHaveLength(1);
    expect(listarRankingComisiones).toHaveBeenCalledWith({ cursadaId: "cu1", pageSize: 50 });
  });

  it("con una sola comisión valorada no muestra el distintivo, y si el ranking falla las tarjetas siguen", async () => {
    vi.mocked(listarRankingComisiones).mockResolvedValueOnce(page([{ ...contexto, posicion: 1, valoracion: { promedio: 5, cantidad: 1 } }]));
    const view = render(<Tarjetas ids={["c1"]} />);
    expect(await screen.findByText("5,0 de 5 estrellas")).toBeTruthy();
    expect(screen.queryByText("Mejor valorada")).toBeNull();
    view.unmount();
    vi.mocked(listarRankingComisiones).mockRejectedValueOnce(new Error("sin red"));
    render(<Tarjetas ids={["c1"]} />);
    await waitFor(() => expect(listarRankingComisiones).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Sin valoraciones")).toBeTruthy();
  });
});
