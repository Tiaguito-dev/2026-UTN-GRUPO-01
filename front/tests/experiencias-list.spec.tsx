// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExperienciasList } from "@/components/feedback/ExperienciasList";
import { listarFeedback } from "@/services/feedback";
import type { Feedback } from "@/types/feedback";
const { replace, push } = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ usePathname: () => "/home/experiencias", useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace, push }) }));
vi.mock("@/services/feedback", () => ({ listarFeedback: vi.fn() }));
const item: Feedback = { id: "f1", texto: "Buena experiencia\ncon ejemplos", anonimo: true, autor: null, propio: false, profesor: null, contexto: { comisionId: "com1", nombre: "S-21", materiaId: "mat1", materiaNombre: "Álgebra", cursadaId: "cur1", anio: 2026, cuatrimestre: "SEGUNDO" }, createdAt: "2026-01-01", updatedAt: "2026-01-01" };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(listarFeedback).mockResolvedValue({ items: [item], total: 10, page: 1, pageSize: 9 }); });
afterEach(cleanup);
describe("Experiencias generales", () => {
  it("muestra contexto y texto real, respeta anonimato y nunca enlaza al detalle privado ajeno", async () => {
    render(<ExperienciasList />);
    expect(await screen.findByText(/Buena experiencia/)).toBeTruthy();
    expect(screen.getByText("Anónimo")).toBeTruthy();
    expect(screen.getAllByText(/Álgebra/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/S-21/).length).toBeGreaterThan(0);
    const commission = screen.getByRole("link", { name: /Ver comisión/ });
    expect(commission.getAttribute("href")).toBe("/home/materias/mat1/cursadas/cur1/comisiones/com1");
    expect(document.querySelector('a[href="/home/feedback/f1"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Administrar mi comentario" })).toBeNull();
    expect(listarFeedback).toHaveBeenCalledWith(expect.objectContaining({ page: 1, pageSize: 9 }));
  });
  it("solo el comentario propio permite administrar y la paginación usa URL", async () => {
    vi.mocked(listarFeedback).mockResolvedValue({ items: [{ ...item, propio: true }], total: 10, page: 1, pageSize: 9 });
    render(<ExperienciasList />);
    await userEvent.click(await screen.findByRole("button", { name: "Administrar mi comentario" }));
    expect(push).toHaveBeenCalledWith("/home/feedback/f1");
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(String(replace.mock.calls.at(-1)?.[0])).toContain("page=2");
  });
  it("distingue carga, error recuperable y ausencia de comentarios", async () => {
    vi.mocked(listarFeedback).mockRejectedValueOnce(new Error("Sin conexión"));
    render(<ExperienciasList />);
    expect(screen.getByRole("status")).toBeTruthy();
    const retry = await screen.findByRole("button", { name: /Reintentar/ });
    vi.mocked(listarFeedback).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 9 });
    await userEvent.click(retry);
    expect(await screen.findByText(/(no hay|todavía no hay).*experiencias|no hay.*comentarios/i)).toBeTruthy();
  });
});
