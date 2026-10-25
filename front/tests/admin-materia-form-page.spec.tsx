// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MateriaFormPage } from "@/components/admin/MateriaFormPage";
import { crearMateria, actualizarMateria } from "@/services/materias";
import type { Materia } from "@/types/materias";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("next/link", () => import("./support/next-link"));

vi.mock("@/services/materias", () => ({
  crearMateria: vi.fn(),
  actualizarMateria: vi.fn(),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
});

const mockMateria: Materia = {
  id: "m-1",
  nombre: "Sistemas Operativos",
  carreras: [{ carrera: "S", anioCarrera: "3", nivelElectiva: null }],
  createdAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
};

describe("MateriaFormPage", () => {
  it("renderiza PageHeader con h1", () => {
    render(<MateriaFormPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Nueva materia" })).toBeTruthy();
  });

  it("crear navega a /home/materias?successMessage=Materia%20creada…", async () => {
    vi.mocked(crearMateria).mockResolvedValue(mockMateria);

    render(<MateriaFormPage />);

    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Sistemas Operativos");
    await userEvent.click(screen.getByLabelText(/S — Ingeniería en Sistemas/));
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));

    expect(push).toHaveBeenCalledWith(
      "/home/materias?successMessage=Materia%20creada%3A%20Sistemas%20Operativos."
    );
  });

  it("editar navega a detailHref con & si ya tiene query", async () => {
    vi.mocked(actualizarMateria).mockResolvedValue({
      ...mockMateria,
      nombre: "Sistemas Operativos II",
    });

    render(
      <MateriaFormPage
        materia={mockMateria}
        detailHref="/home/materias/m-1?carrera=S&anioCarrera=3"
      />
    );

    const input = screen.getByLabelText("Nombre de la materia");
    await userEvent.clear(input);
    await userEvent.type(input, "Sistemas Operativos II");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(push).toHaveBeenCalledWith(
      "/home/materias/m-1?carrera=S&anioCarrera=3&successMessage=Materia%20actualizada%20correctamente."
    );
  });

  it("editar navega a detailHref con ? si no tiene query", async () => {
    vi.mocked(actualizarMateria).mockResolvedValue({
      ...mockMateria,
      nombre: "Sistemas Operativos II",
    });

    render(
      <MateriaFormPage
        materia={mockMateria}
        detailHref="/home/materias/m-1"
      />
    );

    const input = screen.getByLabelText("Nombre de la materia");
    await userEvent.clear(input);
    await userEvent.type(input, "Sistemas Operativos II");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(push).toHaveBeenCalledWith(
      "/home/materias/m-1?successMessage=Materia%20actualizada%20correctamente."
    );
  });
});
