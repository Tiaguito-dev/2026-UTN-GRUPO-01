// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminParentSelector } from "@/components/admin/AdminParentSelector";
afterEach(cleanup);
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
describe("Opciones administrativas remotas TASK-070", () => {
  it("resuelve la selección por ID fuera de página sin descargar más de 2000 opciones", async () => {
    const fetchPage = vi.fn(async () => ({ items: [{ id: "m1", label: "Álgebra" }], total: 5000, page: 1, pageSize: 9 }));
    const fetchSelected = vi.fn(async () => ({ id: "m4000", label: "Materia fuera de la primera página" }));
    render(<AdminParentSelector label="Materia" resourceKey="materias" value="m4000" searchable fetchPage={fetchPage} fetchSelected={fetchSelected} onChange={vi.fn()} />);
    expect(await screen.findByText("Materia fuera de la primera página")).toBeTruthy();
    expect(fetchSelected).toHaveBeenCalledExactlyOnceWith("m4000");
    expect(fetchPage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Materia" }));
    const dialog = screen.getByRole("dialog", { name: "Elegir materia" });
    expect(await within(dialog).findByText("5000 opciones")).toBeTruthy();
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith(1, "");
    await userEvent.click(within(dialog).getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(2, ""));
    const search = within(dialog).getByRole("searchbox", { name: "Buscar materia por nombre" });
    await userEvent.type(search, "Redes"); await userEvent.click(within(dialog).getByRole("button", { name: "Buscar" }));
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(1, "Redes"));
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });
  it("seleccionar un período comunica su identificador y cierra el diálogo", async () => {
    const onChange = vi.fn();
    render(<AdminParentSelector label="Período" resourceKey="periodos:m1" value="" fetchPage={async () => ({ items: [{ id: "c20", label: "Anual 2026" }], total: 1, page: 1, pageSize: 9 })} fetchSelected={vi.fn()} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Período" }));
    await userEvent.click(await screen.findByRole("button", { name: "Anual 2026" }));
    expect(onChange).toHaveBeenCalledWith("c20");
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
