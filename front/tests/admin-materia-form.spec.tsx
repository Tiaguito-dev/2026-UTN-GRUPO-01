// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MateriaForm } from "@/components/admin/MateriaForm";
import { crearMateria, actualizarMateria } from "@/services/materias";
import type { Materia } from "@/types/materias";

vi.mock("@/services/materias", () => ({
  crearMateria: vi.fn(),
  actualizarMateria: vi.fn(),
}));

afterEach(cleanup);

const mockMateria: Materia = {
  id: "m-1",
  nombre: "Sistemas Operativos",
  carreras: [{ carrera: "S", anioCarrera: "3", nivelElectiva: null }],
  createdAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
};

describe("MateriaForm", () => {
  it("el cuerpo no renderiza h1", () => {
    render(<MateriaForm onSuccess={vi.fn()} />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("al guardar con éxito llama a onSuccess con la materia creada y no navega", async () => {
    const onSuccess = vi.fn();
    vi.mocked(crearMateria).mockResolvedValue(mockMateria);

    render(<MateriaForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Sistemas Operativos");
    await userEvent.click(screen.getByLabelText(/S — Ingeniería en Sistemas/));
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));

    expect(crearMateria).toHaveBeenCalledWith({
      nombre: "Sistemas Operativos",
      carreras: [{ carrera: "S", anioCarrera: "3", nivelElectiva: null }],
    });
    expect(onSuccess).toHaveBeenCalledWith(mockMateria);
  });

  it("con error del servidor muestra Notice de error con foco y no llama a onSuccess", async () => {
    const onSuccess = vi.fn();
    vi.mocked(crearMateria).mockRejectedValue(new Error("Ya existe una materia con ese nombre."));

    render(<MateriaForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Sistemas Operativos");
    await userEvent.click(screen.getByLabelText(/S — Ingeniería en Sistemas/));
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Ya existe una materia con ese nombre.");
    expect(document.activeElement).toBe(alert);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("Cancelar aparece solo con onCancel y al clickearlo lo llama", async () => {
    const onCancel = vi.fn();
    const { rerender } = render(<MateriaForm onSuccess={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();

    rerender(<MateriaForm onSuccess={vi.fn()} onCancel={onCancel} />);
    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    expect(cancelBtn).toBeTruthy();

    await userEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
