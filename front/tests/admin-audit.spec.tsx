// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { AdminAuditPanel } from "@/components/admin/AdminAudit";
import type { AdminRecord } from "@/services/admin-detail";
const empty: AdminRecord = { registro: {}, auditoria: { id: "registro-1", createdAt: "2026-01-01T00:00:00.000Z", createdBy: null, updatedAt: "2026-02-01T00:00:00.000Z", updatedBy: null, deletedAt: null, deletedBy: null }, historial: { items: [], total: 0, page: 1, pageSize: 3 } };
afterEach(cleanup);
describe("auditoría administrativa compartida", () => {
  it("separa actualización de historial y declara ausencia de actores sin inventar eventos", () => {
    render(<AdminAuditPanel data={empty} page={1} onPageChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Auditoría" })).toBeTruthy();
    expect(screen.getByText("registro-1")).toBeTruthy();
    expect(screen.getAllByText("No disponible: no fue registrado.")).toHaveLength(3);
    expect(screen.getByText(/La fecha de actualización no constituye un historial completo/)).toBeTruthy();
    expect(screen.getByText("No hay eventos registrados disponibles.")).toBeTruthy();
    expect(screen.queryByText("Creación")).toBeNull();
  });
  it("muestra actor y cambios antes/después de eventos reales y pagina de tres en tres", () => {
    const onPageChange = vi.fn();
    render(<AdminAuditPanel data={{ ...empty, historial: { items: [{ id: "e1", actorId: "admin-1", accion: "EDICION", createdAt: empty.auditoria.createdAt, cambios: [{ campo: "nombre", anterior: "Anterior", nuevo: "Actual" }] }], total: 4, page: 1, pageSize: 3 } }} page={1} onPageChange={onPageChange} />);
    const event = screen.getByRole("listitem");
    expect(within(event).getByText("Edición")).toBeTruthy();
    expect(within(event).getByText("Actor: admin-1")).toBeTruthy();
    expect(event.textContent).toContain("Antes: Anterior");
    expect(event.textContent).toContain("Después: Actual");
    screen.getByRole("button", { name: /siguiente/i }).click();
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
