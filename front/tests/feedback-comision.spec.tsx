// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComisionFeedback } from "@/components/feedback/ComisionFeedback";
import { listarFeedbackComision, obtenerFeedbackPropio } from "@/services/feedback";
import type { Feedback } from "@/types/feedback";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/home/materias/m1/cursadas/cu1/comisiones/c1",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push }),
}));
vi.mock("@/services/feedback", () => ({ listarFeedbackComision: vi.fn(), obtenerFeedbackPropio: vi.fn(), listarHistorialFeedback: vi.fn() }));
const comision = {
  id: "c1", cursadaId: "cu1", carrera: "S" as const, numero: 31, nombre: "S-31", activa: true,
  profesores: [], createdAt: "2026-10-26T12:00:00.000Z", deletedAt: null,
  cursada: { id: "cu1", anio: 2026, cuatrimestre: "PRIMERO" as const, materia: { id: "m1", nombre: "Álgebra" } },
};
const feedback: Feedback = {
  id: "f1", texto: "Buena experiencia", anonimo: true, autor: null, propio: false, profesor: null,
  contexto: { comisionId: "c1", nombre: "S-31", materiaId: "m1", materiaNombre: "Álgebra", cursadaId: "cu1", anio: 2026, cuatrimestre: "PRIMERO" },
  createdAt: "2026-10-26T12:00:00.000Z", updatedAt: "2026-10-26T12:00:00.000Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obtenerFeedbackPropio).mockResolvedValue(null);
  vi.mocked(listarFeedbackComision).mockResolvedValue({ items: [feedback], total: 1, page: 1, pageSize: 9 });
});
afterEach(cleanup);
// TASK-059: public list shows full text; only the author can open the management detail.
describe("Experiencias en detalle de comisión", () => {
  it.each([true, false])("administración lee experiencias sin consultar comentario propio ni ofrecer participación, activa=%s", async (activa) => {
    vi.mocked(listarFeedbackComision).mockResolvedValue({ items: [{ ...feedback, propio: true, autor: { displayName: "Identidad privada" } }], total: 1, page: 1, pageSize: 9 });
    render(<ComisionFeedback comision={{ ...comision, activa }} administrative />);
    expect(await screen.findByText("Buena experiencia")).toBeTruthy();
    expect(listarFeedbackComision).toHaveBeenCalledWith("c1", { page: 1, pageSize: 9 });
    expect(obtenerFeedbackPropio).not.toHaveBeenCalled();
    expect(screen.getByText("Anónimo")).toBeTruthy();
    expect(screen.queryByText("Identidad privada")).toBeNull();
    expect(screen.queryByRole("button", { name: "Compartir mi experiencia" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Administrar mi comentario" })).toBeNull();
    expect(screen.queryByText("¿Cómo funcionan los comentarios?")).toBeNull();
    expect(screen.queryByText(/retirar tu comentario/)).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("muestra total real, texto completo y anonimato sin habilitar detalle ajeno", async () => {
    const user = userEvent.setup();
    const texto = "Explica con ejemplos y ejercicios. ".repeat(35);
    vi.mocked(listarFeedbackComision).mockResolvedValue({ items: [{ ...feedback, texto, autor: { displayName: "Identidad oculta" } }], total: 12, page: 1, pageSize: 9 });
    render(<ComisionFeedback comision={comision} />);
    expect(await screen.findByRole("heading", { level: 2, name: /Experiencias.*12/ })).toBeTruthy();
    expect(screen.getByText(texto.trim())).toBeTruthy();
    expect(screen.getByText("Anónimo")).toBeTruthy();
    expect(screen.queryByText("Identidad oculta")).toBeNull();
    const article = screen.getByRole("article", { name: "Comentario de Anónimo" });
    expect(article.querySelector("header time")?.getAttribute("dateTime")).toBe(feedback.createdAt);
    expect(within(article).queryByRole("button")).toBeNull();
    expect(screen.queryByRole("button", { name: /Ver comentario/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Administrar mi comentario" })).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Compartir mi experiencia" }));
    expect(push).toHaveBeenCalledWith("/home/feedback/nuevo?comisionId=c1");
    expect(listarFeedbackComision).toHaveBeenCalledWith("c1", { page: 1, pageSize: 9 });
  });
  it("solo el comentario propio ofrece una única acción Administrar mi comentario", async () => {
    const user = userEvent.setup();
    const own = { ...feedback, propio: true };
    vi.mocked(obtenerFeedbackPropio).mockResolvedValue(own);
    vi.mocked(listarFeedbackComision).mockResolvedValue({ items: [own], total: 1, page: 1, pageSize: 9 });
    render(<ComisionFeedback comision={comision} />);
    const manage = await screen.findByRole("button", { name: "Administrar mi comentario" });
    expect(screen.getAllByRole("button", { name: "Administrar mi comentario" })).toHaveLength(1);
    expect(screen.getByRole("article").contains(manage)).toBe(true);
    await user.click(manage);
    expect(push).toHaveBeenCalledWith("/home/feedback/f1");
    expect(screen.queryByRole("button", { name: "Compartir mi experiencia" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver mi comentario" })).toBeNull();
  });
  it("ayuda usa details nativo, puede recibir foco de teclado y desplegarse", async () => {
    const user = userEvent.setup();
    render(<ComisionFeedback comision={comision} />);
    const summary = await screen.findByText("¿Cómo funcionan los comentarios?");
    expect(summary.tagName).toBe("SUMMARY");
    const details = summary.closest("details")!;
    expect(details.open).toBe(false);
    // jsdom does not implement the Enter activation default for native summary.
    summary.focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toBe(summary);
    if (!details.open) await user.click(summary);
    expect(details.open).toBe(true);
    expect(within(details).getByText(/un comentario por comisión/)).toBeTruthy();
  });
  it("una comisión inactiva conserva la consulta y cierra nuevas publicaciones", async () => {
    render(<ComisionFeedback comision={{ ...comision, activa: false }} />);
    expect(await screen.findByText("Buena experiencia")).toBeTruthy();
    expect(screen.getByText(/inactiva/)).toBeTruthy();
    await waitFor(() => expect(obtenerFeedbackPropio).toHaveBeenCalledWith("c1"));
    expect(screen.queryByRole("button", { name: "Compartir mi experiencia" })).toBeNull();
  });
  it("representa vacío y fallo de consulta sin inventar experiencias", async () => {
    vi.mocked(listarFeedbackComision).mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 9 });
    const { unmount } = render(<ComisionFeedback comision={comision} />);
    expect(await screen.findByText(/Todavía no hay comentarios/)).toBeTruthy();
    unmount();
    vi.mocked(listarFeedbackComision).mockRejectedValueOnce(new Error("Lo sentimos. No pudimos recuperar los comentarios."));
    render(<ComisionFeedback comision={comision} />);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("No pudimos recuperar los comentarios"));
    expect(screen.getByRole("button", { name: "Reintentar cargar comentarios" })).toBeTruthy();
  });
});
