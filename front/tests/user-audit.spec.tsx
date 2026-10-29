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
