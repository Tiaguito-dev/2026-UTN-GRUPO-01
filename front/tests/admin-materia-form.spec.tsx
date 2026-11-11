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
  modalidad: "ANUAL",
  carreras: [{ carrera: "S", anioCarrera: "3", nivelElectiva: null }],
  createdAt: "2026-01-01T00:00:00Z",
  deletedAt: null,
};

describe("MateriaForm", () => {
  it("permite una electiva anual y envía la modalidad elegida", async () => {
    vi.mocked(crearMateria).mockResolvedValue({ ...mockMateria, modalidad: "ANUAL" });
    render(<MateriaForm onSuccess={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Electiva anual");
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    await userEvent.selectOptions(screen.getByRole("listbox", { name: "Carreras" }), "S");
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "ELECTIVA");
    await userEvent.selectOptions(screen.getByLabelText("Nivel de electiva"), "4");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));
    expect(crearMateria).toHaveBeenCalledWith({ nombre: "Electiva anual", modalidad: "ANUAL", carreras: [{ carrera: "S", anioCarrera: "ELECTIVA", nivelElectiva: "4" }] });
  });
  it("usa un selector multiple de carreras, precarga dos y conserva su oferta al guardar", async () => {
    const existing: Materia = { ...mockMateria, carreras: [{ carrera: "S", anioCarrera: "3", nivelElectiva: null }, { carrera: "Q", anioCarrera: "3", nivelElectiva: null }] };
    vi.mocked(actualizarMateria).mockResolvedValue(existing);
    render(<MateriaForm materia={existing} onSuccess={vi.fn()} />);
    const select = screen.getByRole("listbox", { name: "Carreras" }) as HTMLSelectElement;
    expect(select.multiple).toBe(true);
    expect(Array.from(select.selectedOptions, (option) => option.value)).toEqual(["S", "Q"]);
    expect(screen.queryByRole("checkbox")).toBeNull();
    await userEvent.clear(screen.getByLabelText("Nombre de la materia"));
    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Nombre nuevo");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarMateria).toHaveBeenCalledWith("m-1", { nombre: "Nombre nuevo" });
  });
  it("selecciona dos carreras para alta y envía ambas con el año elegido", async () => {
    vi.mocked(crearMateria).mockResolvedValue(mockMateria);
    render(<MateriaForm onSuccess={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Álgebra");
    await userEvent.selectOptions(screen.getByRole("listbox", { name: "Carreras" }), ["S", "Q"]);
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));
    expect(crearMateria).toHaveBeenCalledWith({ nombre: "Álgebra", modalidad: "ANUAL", carreras: [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }, { carrera: "Q", anioCarrera: "2", nivelElectiva: null }] });
  });
  it("enfoca el selector de carreras ante selección vacía", async () => {
    render(<MateriaForm onSuccess={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Álgebra");
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "2");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));
    const select = screen.getByRole("listbox", { name: "Carreras" });
    expect(document.activeElement).toBe(select);
    expect(select.getAttribute("aria-invalid")).toBe("true");
  });
  it("al cambiar un campo con error borra su error y su aria-invalid", async () => {
    render(<MateriaForm onSuccess={vi.fn()} />);
    const submit = screen.getByRole("button", { name: "Crear materia" });
    await userEvent.click(submit);
    const anio = screen.getByLabelText("Año de la carrera");
    expect(anio.getAttribute("aria-invalid")).toBe("true");
    await userEvent.selectOptions(anio, "ELECTIVA");
    expect(screen.queryByText("Elegí un año entre 1 y 5 o Electiva.")).toBeNull();
    expect(anio.getAttribute("aria-invalid")).toBe("false");
    expect(screen.getByText("Elegí al menos una carrera.")).toBeTruthy();

    const carreras = screen.getByRole("listbox", { name: "Carreras" });
    await userEvent.selectOptions(carreras, "S");
    expect(screen.queryByText("Elegí al menos una carrera.")).toBeNull();
    expect(carreras.getAttribute("aria-invalid")).toBe("false");

    await userEvent.click(submit);
    const nivel = screen.getByLabelText("Nivel de electiva");
    expect(nivel.getAttribute("aria-invalid")).toBe("true");
    await userEvent.selectOptions(nivel, "4");
    expect(screen.queryByText("Elegí el nivel 3, 4 o 5 de la electiva.")).toBeNull();
    expect(nivel.getAttribute("aria-invalid")).toBe("false");
  });
  it("cambiar Año descarta el error del nivel oculto: volver a Electiva no lo revive sin guardar", async () => {
    render(<MateriaForm onSuccess={vi.fn()} />);
    const anio = screen.getByLabelText("Año de la carrera");
    await userEvent.selectOptions(anio, "ELECTIVA");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));
    expect(screen.getByText("Elegí el nivel 3, 4 o 5 de la electiva.")).toBeTruthy();
    await userEvent.selectOptions(anio, "3");
    await userEvent.selectOptions(anio, "ELECTIVA");
    expect(screen.queryByText("Elegí el nivel 3, 4 o 5 de la electiva.")).toBeNull();
    expect(screen.getByLabelText("Nivel de electiva").getAttribute("aria-invalid")).toBe("false");
  });
  it("el cuerpo no renderiza h1", () => {
    render(<MateriaForm onSuccess={vi.fn()} />);
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });
  it("editar solo modalidad conserva las asociaciones de distintos años y envía únicamente esa diferencia", async () => {
    const materia: Materia = { ...mockMateria, carreras: [{ carrera: "S", anioCarrera: "3", nivelElectiva: null }, { carrera: "Q", anioCarrera: "2", nivelElectiva: null }] };
    vi.mocked(actualizarMateria).mockResolvedValue({ ...materia, modalidad: "SEGUNDO" });
    render(<MateriaForm materia={materia} onSuccess={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "SEGUNDO");
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarMateria).toHaveBeenCalledWith("m-1", { modalidad: "SEGUNDO" });
  });

  it("al guardar con éxito llama a onSuccess con la materia creada y no navega", async () => {
    const onSuccess = vi.fn();
    vi.mocked(crearMateria).mockResolvedValue(mockMateria);

    render(<MateriaForm onSuccess={onSuccess} />);
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");

    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Sistemas Operativos");
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    await userEvent.selectOptions(screen.getByRole("listbox", { name: "Carreras" }), "S");
    await userEvent.selectOptions(screen.getByRole("listbox", { name: "Carreras" }), "S");
    await userEvent.selectOptions(screen.getByLabelText("Año de la carrera"), "3");
    await userEvent.click(screen.getByRole("button", { name: "Crear materia" }));

    expect(crearMateria).toHaveBeenCalledWith({
      nombre: "Sistemas Operativos",
  modalidad: "ANUAL",
      carreras: [{ carrera: "S", anioCarrera: "3", nivelElectiva: null }],
    });
    expect(onSuccess).toHaveBeenCalledWith(mockMateria);
  });

  it("con error del servidor muestra Notice de error con foco y no llama a onSuccess", async () => {
    const onSuccess = vi.fn();
    vi.mocked(crearMateria).mockRejectedValue(new Error("Ya existe una materia con ese nombre."));

    render(<MateriaForm onSuccess={onSuccess} />);
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");

    await userEvent.type(screen.getByLabelText("Nombre de la materia"), "Sistemas Operativos");
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    await userEvent.selectOptions(screen.getByRole("listbox", { name: "Carreras" }), "S");
    await userEvent.selectOptions(screen.getByRole("listbox", { name: "Carreras" }), "S");
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
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    expect(screen.queryByRole("button", { name: "Cancelar" })).toBeNull();

    rerender(<MateriaForm onSuccess={vi.fn()} onCancel={onCancel} />);
    await userEvent.selectOptions(screen.getByLabelText("Modalidad"), "ANUAL");
    const cancelBtn = screen.getByRole("button", { name: "Cancelar" });
    expect(cancelBtn).toBeTruthy();

    await userEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
