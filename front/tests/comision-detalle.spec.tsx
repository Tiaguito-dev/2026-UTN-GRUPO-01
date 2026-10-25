// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComisionDetail } from "@/components/academic/ComisionDetail";
import { regionOf } from "./support/region";
import {
  asignarProfesorComision,
  listarComisionesPorCursada,
  listarProfesores,
  obtenerComision,
  quitarProfesorComision,
} from "@/services/academic";

const { authState } = vi.hoisted(() => ({ authState: { role: "USER" } }));

vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("carrera=S&anioCarrera=1&listadoPage=1"),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: authState.role } }) }));
vi.mock("@/services/academic", () => ({
  obtenerComision: vi.fn(),
  listarComisionesPorCursada: vi.fn(),
  listarProfesores: vi.fn(),
  asignarProfesorComision: vi.fn(),
  quitarProfesorComision: vi.fn(),
  CARGOS: ["TITULAR", "ADJUNTO", "JTP"],
}));

const comisionMock = {
  id: "com1",
  cursadaId: "cur1",
  carrera: "S" as const,
  numero: 31,
  nombre: "S-31",
  activa: true,
  profesores: [
    { id: "p1", nombreCompleto: "Prof. Rossi", cargo: "TITULAR" as const },
  ],
  createdAt: "2026-01-01",
  deletedAt: null,
  cursada: {
    id: "cur1",
    anio: 2026,
    cuatrimestre: "PRIMERO" as const,
    materia: { id: "mat1", nombre: "Álgebra" },
  },
};

afterEach(() => {
  cleanup();
  authState.role = "USER";
  vi.clearAllMocks();
});

beforeEach(() => {
  vi.mocked(obtenerComision).mockResolvedValue(comisionMock);
  vi.mocked(listarComisionesPorCursada).mockResolvedValue({
    items: [
      comisionMock,
      {
        id: "com2",
        cursadaId: "cur1",
        carrera: "S" as const,
        numero: 32,
        nombre: "S-32",
        activa: true,
        profesores: [],
        createdAt: "2026-01-01",
        deletedAt: null,
      },
    ],
    total: 2,
    page: 1,
    pageSize: 100,
  });
  vi.mocked(listarProfesores).mockResolvedValue({
    items: [
      { id: "p1", nombreCompleto: "Prof. Rossi", createdAt: "", deletedAt: null },
      { id: "p2", nombreCompleto: "Dra. Gomez", createdAt: "", deletedAt: null },
    ],
    total: 2,
    page: 1,
    pageSize: 100,
  });
});

describe("ComisionDetail", () => {
  it("muestra datos de la comisión y profesores para usuario común sin controles de edición", async () => {
    authState.role = "USER";
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);

    // TASK-043: the h1 reads "Comisión S-31" (ComisionDetalle artboard); before it was "S-31".
    expect(await screen.findByRole("heading", { level: 1, name: "Comisión S-31" })).toBeTruthy();
    expect(screen.getByText("Ingeniería en Sistemas")).toBeTruthy();
    expect(screen.getAllByText(/Álgebra/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1er cuatrimestre 2026/).length).toBeGreaterThan(0);
    // TASK-043: the row may show name and cargo in separate elements (avatar row).
    expect(regionOf(screen.getByRole("heading", { level: 2, name: "Profesores" })).textContent).toMatch(/Prof\. Rossi.*Titular/);

    // No se ven controles de admin
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Asignar profesor" })).toBeNull();

    // Otras comisiones
    expect(await screen.findByRole("link", { name: "S-32" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "S-31" })).toBeNull();
  });

  it("permite a ADMIN cambiar cargo, quitar y asignar profesor", async () => {
    authState.role = "ADMIN";
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);

    await screen.findByRole("heading", { level: 1, name: "Comisión S-31" });

    // Cambiar cargo
    const selectCargo = screen.getByLabelText("Cambiar cargo de Prof. Rossi");
    await userEvent.selectOptions(selectCargo, "JTP");
    expect(asignarProfesorComision).toHaveBeenCalledWith("com1", "p1", "JTP");

    // Quitar
    const botonQuitar = screen.getByRole("button", { name: "Quitar" });
    await userEvent.click(botonQuitar);
    expect(quitarProfesorComision).toHaveBeenCalledWith("com1", "p1");

    // Asignar
    const selectProfesor = screen.getByLabelText("Profesor");
    await userEvent.selectOptions(selectProfesor, "p2");
    const botonAsignar = screen.getByRole("button", { name: "Asignar profesor" });
    await userEvent.click(botonAsignar);
    expect(asignarProfesorComision).toHaveBeenCalledWith("com1", "p2", "TITULAR");
  });

  describe("rediseño (TASK-043)", () => {
    it("Experiencias de esta comisión muestra Próximamente", async () => {
      render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
      const experiencias = regionOf(await screen.findByRole("heading", { level: 2, name: "Experiencias de esta comisión" }));
      expect(within(experiencias).getByText("Próximamente")).toBeTruthy();
    });

    it("usuario común no ve Asignar profesor ni Datos de la comisión", async () => {
      render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
      await screen.findByRole("heading", { level: 2, name: "Profesores" });
      expect(screen.queryByRole("link", { name: "Asignar profesor" })).toBeNull();
      expect(screen.queryByRole("heading", { name: "Datos de la comisión" })).toBeNull();
    });

    it("ADMIN: cada profesor conserva cargo y Quitar en la fila (decisión 4) y ve Datos de la comisión", async () => {
      authState.role = "ADMIN";
      render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
      const profesores = regionOf(await screen.findByRole("heading", { level: 2, name: "Profesores" }));
      expect(within(profesores).getByLabelText("Cambiar cargo de Prof. Rossi")).toBeTruthy();
      expect(within(profesores).getByRole("button", { name: "Quitar" })).toBeTruthy();
      expect(screen.getByRole("heading", { level: 2, name: "Datos de la comisión" })).toBeTruthy();
    });

    it("ADMIN: el enlace Asignar profesor lleva el foco al formulario de asignación (decisión 2)", async () => {
      authState.role = "ADMIN";
      render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
      const link = await screen.findByRole("link", { name: "Asignar profesor" });
      const form = screen.getByLabelText("Profesor").closest("form")!;
      expect(link.getAttribute("href")).toMatch(/^#./);
      expect(form.contains(document.getElementById(link.getAttribute("href")!.slice(1)))).toBe(true);
      await userEvent.click(link);
      expect(form.contains(document.activeElement)).toBe(true);
    });
  });

  it("muestra error si falla la obtención de la comisión", async () => {
    vi.mocked(obtenerComision).mockRejectedValueOnce(new Error("No se pudo cargar la comisión."));
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);

    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("No se pudo cargar la comisión.")
    );
  });
});
