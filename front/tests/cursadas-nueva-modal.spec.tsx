// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CursadasList } from "@/components/academic/CursadasList";
import { crearCursada, listarCursadasPorMateria, listarMaterias } from "@/services/academic";

const { auth } = vi.hoisted(() => ({ auth: { role: "ADMIN" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), useSearchParams: () => new URLSearchParams() }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: auth.role } }) }));
vi.mock("@/hooks/useUrlPagination", () => ({ useUrlPagination: () => ({ page: 1, setPage: vi.fn() }) }));
vi.mock("@/services/academic", () => ({
  listarCursadasPorMateria: vi.fn(),
  listarMaterias: vi.fn(),
  crearCursada: vi.fn(),
}));

// jsdom no implementa showModal()/close(): mismo stub que ui-dialog.spec.tsx y materias-filtros.spec.tsx.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
    this.querySelector<HTMLElement>("button, input, select, textarea, a[href]")?.focus();
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  auth.role = "ADMIN";
  vi.mocked(listarMaterias).mockResolvedValue({
    items: [{ id: "m1", nombre: "Álgebra", carreras: [], createdAt: "", deletedAt: null }],
    total: 1,
    page: 1,
    pageSize: 100,
  });
});

const dialogClosed = () => {
  const dialog = document.querySelector("dialog");
  return dialog === null || !dialog.open;
};

// TASK-054: desde el detalle de materia, "Nueva cursada" abre un Dialog con la materia ya fija
// en vez de navegar a /home/admin/cursadas/nueva. Cubre el hueco de prueba que dejó esa tarea
// (solo se verificaba que el botón existiera, no el flujo de abrir/crear/cerrar/recargar).
describe("CursadasList, 'Nueva cursada' en modal (TASK-054)", () => {
  it("un usuario común no ve el botón Nueva cursada", async () => {
    auth.role = "USER";
    vi.mocked(listarCursadasPorMateria).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
    render(<CursadasList materiaId="m1" materiaNombre="Álgebra" />);
    await screen.findByText("Esta materia todavía no tiene cursadas cargadas.");
    expect(screen.queryByRole("button", { name: "Nueva cursada" })).toBeNull();
  });

  it("ADMIN: crea la cursada con la materia ya fija, cierra el modal y recarga el listado sin navegar", async () => {
    vi.mocked(listarCursadasPorMateria)
      .mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 10 })
      .mockResolvedValueOnce({
        items: [{ id: "c1", anio: 2026, comisiones: 0, profesores: 0, carreras: [] }],
        total: 1,
        page: 1,
        pageSize: 10,
      });
    vi.mocked(crearCursada).mockResolvedValue({ id: "c1", materiaId: "m1", anio: 2026, createdAt: "2026-10-25", deletedAt: null });

    render(<CursadasList materiaId="m1" materiaNombre="Álgebra" />);
    await screen.findByText("Esta materia todavía no tiene cursadas cargadas.");
    const pedidos = vi.mocked(listarCursadasPorMateria).mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Nueva cursada" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva cursada" });
    expect((dialog as HTMLDialogElement).open).toBe(true);
    expect(screen.queryByLabelText("Materia")).toBeNull();

    await userEvent.type(screen.getByLabelText("Año"), "2026");
    await userEvent.selectOptions(screen.getByLabelText("Período"), "ANUAL");
    await userEvent.click(screen.getByRole("button", { name: "Crear cursada" }));

    expect(crearCursada).toHaveBeenCalledWith({ materiaId: "m1", anio: 2026, cuatrimestre: "ANUAL" });
    await waitFor(() => expect(dialogClosed()).toBe(true));
    await waitFor(() => expect(screen.getAllByRole("status").some((status) => status.textContent?.includes("2026"))).toBe(true));
    await waitFor(() => expect(vi.mocked(listarCursadasPorMateria).mock.calls.length).toBeGreaterThan(pedidos));
  });

  it("ADMIN: Cancelar cierra el modal sin crear ni recargar", async () => {
    vi.mocked(listarCursadasPorMateria).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 10 });
    render(<CursadasList materiaId="m1" materiaNombre="Álgebra" />);
    await screen.findByText("Esta materia todavía no tiene cursadas cargadas.");
    const pedidos = vi.mocked(listarCursadasPorMateria).mock.calls.length;

    await userEvent.click(screen.getByRole("button", { name: "Nueva cursada" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(dialogClosed()).toBe(true));
    expect(crearCursada).not.toHaveBeenCalled();
    expect(vi.mocked(listarCursadasPorMateria).mock.calls.length).toBe(pedidos);
  });
});
