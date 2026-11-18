// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MateriaFormPage } from "@/components/admin/MateriaFormPage";
import { crearMateria, actualizarMateria } from "@/services/materias";
import type { Materia } from "@/types/materias";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("next/link", () => import("./support/next-link"));

vi.mock("@/services/materias", () => ({
  crearMateria: vi.fn(),
  actualizarMateria: vi.fn(),
}));

afterEach(() => {
  cleanup();
  push.mockReset();
  search = "";
});

const mockMateria: Materia = {
  id: "m-1",
  nombre: "Sistemas Operativos",
  modalidad: "ANUAL",
  carreras: [{ carrera: "S", anioCarrera: "3", nivelElectiva: null }],
  createdAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
};

describe("MateriaFormPage", () => {
  it("cancelar y guardar desde el detalle conserva filtros sin anidar su propia URL", async () => {
    const origin = "/home/admin/materias?q=Sistemas&carrera=S&page=3";
    // BUG-02: la edición vuelve al detalle (un nivel); los filtros de Materias viajan al lado.
    const detailHref = `/home/admin/materias/m-1?${new URLSearchParams({ materiaReturnTo: origin })}`;
    search = new URLSearchParams({ returnTo: "/home/admin/materias/m-1", materiaReturnTo: origin }).toString();
    vi.mocked(actualizarMateria).mockResolvedValue({ ...mockMateria, nombre: "Sistemas II" });
    render(<MateriaFormPage materia={mockMateria} />);
    expect(screen.getByRole("link", { name: /Volver a contexto administrativo/ }).getAttribute("href")).toBe(detailHref);
    const breadcrumb = within(screen.getByRole("navigation", { name: "Ubicación actual" }));
    expect(breadcrumb.getByRole("link", { name: "Materias" }).getAttribute("href")).toBe(origin);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(push).toHaveBeenLastCalledWith(detailHref);
    push.mockReset();
    const input = screen.getByLabelText("Nombre de la materia");
    await userEvent.clear(input); await userEvent.type(input, "Sistemas II");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const target = new URL(String(push.mock.calls.at(-1)?.[0]), "https://local.test");
    expect(target.pathname).toBe("/home/admin/materias/m-1");
    expect(target.searchParams.get("materiaReturnTo")).toBe(origin);
    expect(target.searchParams.get("successMessage")).toBe("Materia actualizada correctamente.");
  });

  it("TASK055 guarda y cancela conservando la página del listado administrativo", async () => {
    search = new URLSearchParams({ returnTo: "/home/admin/materias?page=3" }).toString();
    vi.mocked(actualizarMateria).mockResolvedValue({ ...mockMateria, nombre: "Sistemas II" });
    render(<MateriaFormPage materia={mockMateria} />);
    // TASK-068: Volver conserva el origen y el breadcrumb comienza siempre en Administración.
    expect(screen.getByRole("link", { name: /Volver a contexto administrativo/ }).getAttribute("href")).toBe("/home/admin/materias?page=3");
    expect(screen.getByRole("link", { name: "Administración" }).getAttribute("href")).toBe("/home/admin");
    const input = screen.getByLabelText("Nombre de la materia");
    await userEvent.clear(input); await userEvent.type(input, "Sistemas II");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    // Edición vuelve al detalle; el listado de origen sigue disponible para Volver.
    const target = new URL(String(push.mock.calls.at(-1)?.[0]), "https://local.test");
    expect(target.pathname).toBe("/home/admin/materias/m-1");
    expect(target.searchParams.get("returnTo")).toBe("/home/admin/materias?page=3");
    expect(target.searchParams.get("successMessage")).toBe("Materia actualizada correctamente.");
  });
  it("renderiza PageHeader con h1", () => {
    render(<MateriaFormPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Nueva materia" })).toBeTruthy();
  });

  it("crear navega al listado administrativo con mensaje de éxito", async () => {
    vi.mocked(crearMateria).mockResolvedValue(mockMateria);

    render(<MateriaFormPage />);

    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Sistemas Operativos");
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    await userEvent.selectOptions(screen.getByRole("listbox", { name: "Carreras" }), "S");
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));

    const target = new URL(String(push.mock.calls.at(-1)?.[0]), "https://local.test");
    expect(target.pathname).toBe("/home/admin/materias");
    expect(target.searchParams.get("successMessage")).toBe("Materia creada: Sistemas Operativos.");
  });

  // TASK-068: los retornos al recorrido público no se aceptan desde administración.
  it("editar conserva el recurso en administración aunque reciba un retorno público con filtros", async () => {
    vi.mocked(actualizarMateria).mockResolvedValue({
      ...mockMateria,
      nombre: "Sistemas Operativos II",
    });

    search = new URLSearchParams({ returnTo: "/home/materias/m-1?carrera=S&anioCarrera=3" }).toString();
    render(<MateriaFormPage materia={mockMateria} />);

    const input = screen.getByLabelText("Nombre de la materia");
    await userEvent.clear(input);
    await userEvent.type(input, "Sistemas Operativos II");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(push).toHaveBeenCalledWith(
      "/home/admin/materias/m-1?successMessage=Materia+actualizada+correctamente."
    );
  });

  it("editar sin origen usa el detalle administrativo del recurso", async () => {
    vi.mocked(actualizarMateria).mockResolvedValue({
      ...mockMateria,
      nombre: "Sistemas Operativos II",
    });

    render(<MateriaFormPage materia={mockMateria} />);

    const input = screen.getByLabelText("Nombre de la materia");
    await userEvent.clear(input);
    await userEvent.type(input, "Sistemas Operativos II");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(push).toHaveBeenCalledWith(
      "/home/admin/materias/m-1?successMessage=Materia+actualizada+correctamente."
    );
  });
});
