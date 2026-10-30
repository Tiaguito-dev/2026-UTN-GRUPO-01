// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AdminAuditPanel } from "@/components/admin/AdminAudit";
import { UserAudit } from "@/components/admin/UserAudit";
import type { AdminRecord } from "@/services/admin-detail";
const session = vi.hoisted(() => ({ role: "ADMIN" }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: session.role } }) }));
const empty: AdminRecord = { registro: {}, auditoria: { id: "registro-1", createdAt: "2026-01-01T00:00:00.000Z", createdBy: null, updatedAt: "2026-02-01T00:00:00.000Z", updatedBy: null, deletedAt: null, deletedBy: null }, historial: { items: [], total: 0, page: 1, pageSize: 3 } };
afterEach(() => { cleanup(); session.role = "ADMIN"; });
describe("auditoría administrativa compartida", () => {
  it("oculta auditoría e historial a usuarios comunes", () => {
    session.role = "USER";
    const { container } = render(<AdminAuditPanel data={empty} page={1} onPageChange={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });
  it("separa actualización de historial y declara ausencia de actores sin inventar eventos", () => {
    render(<AdminAuditPanel data={empty} page={1} onPageChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Auditoría" })).toBeTruthy();
    expect(screen.queryByText("registro-1")).toBeNull();
    expect(document.querySelector("details")?.open).toBe(false);
    expect(screen.getAllByText("No registrado")).toHaveLength(4);
    expect(screen.getByText(/La fecha de actualización no constituye un historial completo/)).toBeTruthy();
    expect(screen.getByText("No hay eventos registrados")).toBeTruthy();
    expect(screen.getByText("Creación")).toBeTruthy();
  });
  it("muestra actor y cambios antes/después de eventos reales y pagina de tres en tres", () => {
    const onPageChange = vi.fn();
    render(<AdminAuditPanel data={{ ...empty, historial: { items: [{ id: "e1", actorId: "admin-1", accion: "EDICION", createdAt: empty.auditoria.createdAt, cambios: [{ campo: "nombre", anterior: "Anterior", nuevo: "Actual" }] }], total: 4, page: 1, pageSize: 3 } }} page={1} onPageChange={onPageChange} />);
    screen.getByText(/Historial de cambios/).click();
    const event = screen.getByRole("listitem");
    expect(within(event).getByText("Edición")).toBeTruthy();
    // La referencia técnica se reemplaza por el fallback seguro cuando no hay nombre resoluble.
    expect([...event.querySelectorAll("p")].some(row => row.textContent === "Actor: Usuario no identificado")).toBe(true);
    expect(event.textContent).toContain("Antes: Anterior");
    expect(event.textContent).toContain("Después: Actual");
    screen.getByRole("button", { name: /siguiente/i }).click();
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
  it.each([["AdminAuditPanel", AdminAuditPanel], ["UserAudit", UserAudit]] as const)("presentación %s usa nombres autorizados y oculta referencias de auditoría e historial", (_name, Audit) => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    const data: AdminRecord = {
      ...empty,
      auditoria: { ...empty.auditoria, createdBy: uuid, createdByName: "Persona creadora", updatedBy: uuid, updatedByName: "Persona editora", deletedBy: uuid, deletedByName: "Persona de baja", deletedAt: empty.auditoria.updatedAt },
      historial: { ...empty.historial, total: 1, items: [{ id: "event-reference", actorId: uuid, actorName: "Actor autorizado", accion: "EDICION", createdAt: empty.auditoria.createdAt, cambios: [] }] },
    };
    const { container } = render(<Audit kind="comisiones" data={data} page={1} onPageChange={vi.fn()} />);
    for (const name of ["Persona creadora", "Persona editora", "Persona de baja"]) expect(screen.getByText(name)).toBeTruthy();
    container.querySelector("summary")!.click();
    expect(screen.getByText("Actor: Actor autorizado")).toBeTruthy();
    expect(container.textContent).not.toContain(uuid);
    expect(container.textContent).not.toContain("event-reference");
  });
  it.each([["AdminAuditPanel", AdminAuditPanel], ["UserAudit", UserAudit]] as const)("presentación %s distingue referencia sin nombre y ausencia de actor", (_name, Audit) => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    const data: AdminRecord = {
      ...empty,
      auditoria: { ...empty.auditoria, createdBy: uuid, createdByName: null, updatedBy: uuid, updatedByName: "   ", deletedBy: null },
      historial: { ...empty.historial, total: 2, items: [
        { id: "event-1", actorId: uuid, actorName: null, accion: "EDICION", createdAt: empty.auditoria.createdAt, cambios: [] },
        { id: "event-2", actorId: null, actorName: null, accion: "CREACION", createdAt: empty.auditoria.createdAt, cambios: [] },
      ] },
    };
    const { container } = render(<Audit kind="feedback" data={data} page={1} onPageChange={vi.fn()} />);
    expect([...container.querySelectorAll("dd")].filter(cell => cell.textContent === "Usuario no identificado")).toHaveLength(2);
    expect(screen.getAllByText("No registrado").length).toBeGreaterThan(0);
    container.querySelector("summary")!.click();
    const actorRows = [...container.querySelectorAll("details p")].map(row => row.textContent);
    expect(actorRows).toContain("Actor: Usuario no identificado");
    expect(actorRows).toContain("Actor: No registrado");
    expect(container.textContent).not.toContain(uuid);
  });
});
