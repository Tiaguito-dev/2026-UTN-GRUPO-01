// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserAudit } from "@/components/admin/UserAudit";
import type { AdminRecord } from "@/services/admin-detail";

const session = vi.hoisted(() => ({ role: "ADMIN" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: session.role } }) }));
const data: AdminRecord = { registro: {}, auditoria: { id: "internal-id", createdAt: "2026-10-27T15:30:00Z", createdBy: "actor-id", createdByName: "Nombre autorizado", updatedAt: null, updatedBy: "unresolved-id", updatedByName: null, deletedAt: null, deletedBy: null }, historial: { items: [], total: 0, page: 1, pageSize: 3 } };
afterEach(() => { cleanup(); session.role = "ADMIN"; });

describe("auditoría exclusiva del detalle de usuario", () => {
  it("distingue actores identificados, referencias sin nombre y actores ausentes sin mostrar IDs", async () => {
    const { container } = render(<UserAudit data={data} page={1} onPageChange={vi.fn()} />);
    expect(screen.getByText("Nombre autorizado")).toBeTruthy();
    expect(screen.getByText("Usuario no identificado")).toBeTruthy();
    expect(screen.getAllByText("No registrado").length).toBeGreaterThan(0);
    for (const id of ["internal-id", "actor-id", "unresolved-id"]) expect(container.textContent).not.toContain(id);
    const disclosure = container.querySelector("details")!;
    expect(disclosure.open).toBe(false);
    await userEvent.tab();
    expect(document.activeElement).toBe(container.querySelector("summary"));
    // jsdom does not emulate the native summary keyboard activation; focus is tested here,
    // while Enter/Space activation is covered by the developer's browser verification.
    await userEvent.click(container.querySelector("summary")!);
    expect(disclosure.open).toBe(true);
    expect(screen.getByText("No hay eventos registrados")).toBeTruthy();
    expect(screen.getByText("Solo se muestran cambios que fueron registrados por el sistema")).toBeTruthy();
  });
  it("muestra cambios reales en tabla con etiquetas legibles y actor autorizado", async () => {
    render(<UserAudit data={{ ...data, historial: { ...data.historial, total: 1, items: [{ id: "event-id", actorId: "actor-id", actorName: "Nombre autorizado", accion: "DESACTIVACION", createdAt: data.auditoria.createdAt, cambios: [{ campo: "estado", anterior: "ACTIVO", nuevo: "INACTIVO" }] }] } }} page={1} onPageChange={vi.fn()} />);
    await userEvent.click(screen.getByText("Historial de cambios"));
    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Antes" })).toBeTruthy();
    expect(within(table).getByText("Activo")).toBeTruthy();
    expect(within(table).getByText("Inactivo")).toBeTruthy();
    expect(screen.getByText("Actor: Nombre autorizado")).toBeTruthy();
  });
  it("no presenta auditoría ni eventos a otros roles", () => {
    session.role = "USER";
    const { container } = render(<UserAudit data={data} page={1} onPageChange={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("auditoría compartida de entidades académicas", () => {
  it("usa Baja con Trash2 para materias y conserva Desactivación para usuarios", () => {
    const view = render(<UserAudit kind="materias" data={data} page={1} onPageChange={vi.fn()} />);
    const baja = screen.getByRole("heading", { name: "Baja" });
    expect(baja.querySelector('svg[class*="trash"]')).not.toBeNull();
    expect(screen.getByText("Fecha de baja")).toBeTruthy();
    expect(screen.getByText("Dado de baja por")).toBeTruthy();
    expect(screen.queryByText("Desactivación")).toBeNull();
    view.rerender(<UserAudit data={data} page={1} onPageChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Desactivación" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Baja" })).toBeNull();
  });
  it("traduce modalidad y asociaciones reales con carreras, años y nivel de electiva", async () => {
    render(<UserAudit kind="materias" data={{ ...data, historial: { ...data.historial, total: 1, items: [{ id: "event-id", actorId: null, accion: "EDICION", createdAt: data.auditoria.createdAt, cambios: [
      { campo: "modalidad", anterior: "ANUAL", nuevo: "PRIMERO" },
      { campo: "carreras", anterior: "S:2", nuevo: "I:ELECTIVA:4" },
    ] }] } }} page={1} onPageChange={vi.fn()} />);
    await userEvent.click(screen.getByText("Historial de cambios"));
    const table = screen.getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "Modalidad" })).toBeTruthy();
    expect(within(table).getByRole("rowheader", { name: "Carreras" })).toBeTruthy();
    expect(within(table).getByText("Anual")).toBeTruthy();
    expect(within(table).getByText(/Cuatrimestral.*1\.er cuatrimestre/)).toBeTruthy();
    expect(within(table).getByText(/Ingeniería en Sistemas de Información.*2\.º año/)).toBeTruthy();
    expect(within(table).getByText(/Ingeniería Industrial.*Electiva.*4\.º Nivel/)).toBeTruthy();
    expect(table.textContent).not.toContain('"anioCarrera"');
  });
  it("distingue vacío de null y oculta referencias técnicas sin inferir una eliminación", async () => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    const { container } = render(<UserAudit kind="materias" data={{ ...data, historial: { ...data.historial, total: 1, items: [{ id: "event-id", actorId: uuid, actorName: null, accion: "EDICION", createdAt: data.auditoria.createdAt, cambios: [
      { campo: "nombre", anterior: "", nuevo: null },
      { campo: "materiaId", anterior: uuid, nuevo: null },
    ] }] } }} page={1} onPageChange={vi.fn()} />);
    await userEvent.click(screen.getByText("Historial de cambios"));
    const table = screen.getByRole("table");
    const nombre = within(table).getByRole("rowheader", { name: "Nombre" }).closest("tr")!;
    expect(within(nombre).getByRole("cell", { name: "Vacío" })).toBeTruthy();
    expect(within(nombre).getByRole("cell", { name: "No registrado" })).toBeTruthy();
    expect(screen.getByText("Actor: Usuario no identificado")).toBeTruthy();
    expect(container.textContent).not.toContain(uuid);
    expect(screen.getByText("Edición")).toBeTruthy();
    expect(screen.queryByText("Eliminación")).toBeNull();
  });
  it("mantiene contador real, orden recibido, paginación de tres y foco por teclado", async () => {
    const onPageChange = vi.fn();
    const entries = ["Tercero", "Segundo", "Primero"].map((nombre, index) => ({ id: `event-${index}`, actorId: null, accion: "EDICION", createdAt: data.auditoria.createdAt, cambios: [{ campo: "nombre", anterior: null, nuevo: nombre }] }));
    const { container } = render(<UserAudit kind="materias" data={{ ...data, historial: { items: entries, total: 7, page: 1, pageSize: 3 } }} page={1} onPageChange={onPageChange} />);
    const disclosure = container.querySelector("details")!;
    const summary = container.querySelector("summary")!;
    expect(disclosure.open).toBe(false);
    expect(summary.textContent).toContain("7");
    await userEvent.tab();
    expect(document.activeElement).toBe(summary);
    await userEvent.click(summary);
    expect(disclosure.open).toBe(true);
    expect(screen.getAllByRole("table").map((table) => within(table).getAllByRole("cell").at(-1)!.textContent)).toEqual(["Tercero", "Segundo", "Primero"]);
    expect(screen.getByText("Página 1 de 3")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Página anterior" }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(2);
  });
  it("mantiene mensajes seguros y una sola aclaración sobre límites del registro", () => {
    const { container } = render(<UserAudit kind="materias" data={data} page={1} onPageChange={vi.fn()} />);
    expect(screen.getByText("Nombre autorizado")).toBeTruthy();
    expect(screen.getByText("Usuario no identificado")).toBeTruthy();
    expect(screen.getAllByText("La fecha de actualización no constituye un historial completo de cambios")).toHaveLength(1);
    expect(container.textContent).not.toContain("actor-id");
  });
});
