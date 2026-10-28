// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminCursadaDetail, AdminMateriaDetail, AdminProfesorDetail } from "@/components/admin/AdminAcademicDetail";
import { obtenerCursada } from "@/services/academic";
import { obtenerProfesor } from "@/services/admin-academic";
import { listarHistorialMateria, obtenerMateria } from "@/services/materias";

const { route } = vi.hoisted(() => ({ route: { query: "" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(route.query), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/services/materias", async (importOriginal) => ({ ...await importOriginal<typeof import("@/services/materias")>(), obtenerMateria: vi.fn(), listarHistorialMateria: vi.fn() }));
vi.mock("@/services/academic", async (importOriginal) => ({ ...await importOriginal<typeof import("@/services/academic")>(), obtenerCursada: vi.fn() }));
vi.mock("@/services/admin-academic", () => ({ obtenerProfesor: vi.fn() }));
const materia = {
  id: "m1", nombre: "Materia de nombre académico extenso", modalidad: "ANUAL" as const,
  carreras: [
    { carrera: "S" as const, anioCarrera: "2" as const, nivelElectiva: null },
    { carrera: "I" as const, anioCarrera: "ELECTIVA" as const, nivelElectiva: "4" as const },
  ],
  createdAt: "2026-01-01T12:00:00.000Z", deletedAt: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  route.query = "";
  vi.mocked(obtenerMateria).mockResolvedValue(materia);
  vi.mocked(obtenerProfesor).mockResolvedValue({ id: "p1", nombreCompleto: "Docente de nombre extenso", createdAt: materia.createdAt, deletedAt: null });
  vi.mocked(obtenerCursada).mockResolvedValue({ id: "cu1", anio: 2026, cuatrimestre: "SEGUNDO", materia: { id: "m1", nombre: materia.nombre } });
  vi.mocked(listarHistorialMateria).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 3 });
});
afterEach(cleanup);

function link(name: string | RegExp) {
  return new URL(screen.getByRole("link", { name }).getAttribute("href")!, "https://local.test");
}
function administrativeBreadcrumb(title: string) {
  const breadcrumb = screen.getByRole("navigation", { name: "Ubicación actual" });
  const first = within(breadcrumb).getAllByRole("link")[0]!;
  expect(first.textContent).toBe("Administración");
  expect(first.getAttribute("href")).toBe("/home/admin");
  expect(within(breadcrumb).getByText(title).getAttribute("aria-current")).toBe("page");
}

describe("detalles académicos administrativos", () => {
  it("materia conserva asociaciones completas, historial y enlaces de administración", async () => {
    const origin = "/home/admin/experiencias?carrera=S&materiaId=m1&page=3";
    route.query = new URLSearchParams({ returnTo: origin }).toString();
    render(<AdminMateriaDetail materiaId="m1" />);
    expect(await screen.findByRole("heading", { level: 1, name: materia.nombre })).toBeTruthy();
    administrativeBreadcrumb(materia.nombre);
    expect(screen.getByText("Ingeniería en Sistemas de Información")).toBeTruthy();
    expect(screen.getByText("Ingeniería Industrial")).toBeTruthy();
    expect(screen.getByText(/Electiva.*4\.º Nivel/)).toBeTruthy();
    expect(link(/Volver a/).pathname + link(/Volver a/).search).toBe(origin);
    expect(link("Ver cursadas").pathname).toBe("/home/admin/cursadas");
    expect(link("Ver cursadas").searchParams.get("materiaId")).toBe("m1");
    expect(link("Editar materia").pathname).toBe("/home/admin/materias/m1/editar");
    expect(link("Editar materia").searchParams.get("returnTo")).toBe(origin);
    expect(await screen.findByText("Alta de la materia")).toBeTruthy();
    expect(listarHistorialMateria).toHaveBeenCalledWith("m1", { page: 1 });
    expect(document.querySelector('a[href^="/home/materias"]')).toBeNull();
  });

  it("no ofrece editar una materia inactiva y mantiene el historial autorizado", async () => {
    vi.mocked(obtenerMateria).mockResolvedValue({ ...materia, deletedAt: materia.createdAt });
    render(<AdminMateriaDetail materiaId="m1" />);
    expect(await screen.findByText("Inactiva")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Editar materia" })).toBeNull();
    expect(await screen.findByText("Alta de la materia")).toBeTruthy();
  });

  it("profesor conserva página del listado y su edición administrativa", async () => {
    const origin = "/home/admin/profesores?page=2";
    route.query = new URLSearchParams({ returnTo: origin }).toString();
    render(<AdminProfesorDetail profesorId="p1" />);
    expect(await screen.findByRole("heading", { name: "Docente de nombre extenso" })).toBeTruthy();
    expect(obtenerProfesor).toHaveBeenCalledWith("p1");
    administrativeBreadcrumb("Docente de nombre extenso");
    expect(link(/Volver a/).pathname + link(/Volver a/).search).toBe(origin);
    expect(link("Editar profesor").pathname).toBe("/home/admin/profesores/p1/editar");
    expect(link("Editar profesor").searchParams.get("returnTo")).toBe(origin);
  });

  it.each(["https://evil.test", "/home/materias/m1"])('profesor rechaza el origen no administrativo %s', async (returnTo) => {
    route.query = new URLSearchParams({ returnTo }).toString();
    render(<AdminProfesorDetail profesorId="p1" />);
    await screen.findByRole("heading", { name: "Docente de nombre extenso" });
    expect(link(/Volver a/).pathname).toBe("/home/admin/profesores");
  });

  it("cursada presenta el período real y abre materia, comisiones y edición administrativas", async () => {
    render(<AdminCursadaDetail cursadaId="cu1" />);
    const heading = await screen.findByRole("heading", { level: 1, name: /Cursada.*2026/ });
    administrativeBreadcrumb(heading.textContent!);
    expect(obtenerCursada).toHaveBeenCalledWith("cu1");
    expect(link(materia.nombre).pathname).toBe("/home/admin/materias/m1");
    const commissions = link("Ver comisiones");
    expect(commissions.pathname).toBe("/home/admin/comisiones");
    expect(Object.fromEntries(commissions.searchParams)).toEqual({ materiaId: "m1", cursadaId: "cu1" });
    expect(link("Editar cursada").pathname).toBe("/home/admin/cursadas/cu1/editar");
    expect(link(/Volver a/).searchParams.get("materiaId")).toBe("m1");
    expect(document.querySelector('a[href^="/home/materias"]')).toBeNull();
  });

  it("distingue carga y error del detalle y permite reintentar sin cambiar de recorrido", async () => {
    vi.mocked(obtenerProfesor).mockRejectedValueOnce(new Error("Servicio temporalmente no disponible"));
    render(<AdminProfesorDetail profesorId="p1" />);
    expect(screen.getByRole("status").textContent).toBe("Cargando registro…");
    expect((await screen.findByRole("alert")).textContent).toContain("Servicio temporalmente no disponible");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: "Docente de nombre extenso" })).toBeTruthy();
    expect(obtenerProfesor).toHaveBeenCalledTimes(2);
    expect(link(/Volver a/).pathname).toBe("/home/admin/profesores");
  });
});
