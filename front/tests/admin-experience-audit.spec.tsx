// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ExperienceCard } from "@/components/feedback/ExperienceCard";
import type { Feedback } from "@/types/feedback";
const { session } = vi.hoisted(() => ({ session: { role: "USER" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "u1", role: session.role } }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/home/experiencias", useSearchParams: () => new URLSearchParams("carrera=S&materiaId=m1&page=4") }));
const feedback: Feedback = {
  id: "f1", texto: "Contenido completo", anonimo: true, autor: null, propio: false, profesor: null,
  contexto: { carrera: "S", comisionId: "c1", nombre: "S-31", materiaId: "m1", materiaNombre: "Álgebra", cursadaId: "cu1", anio: 2026, cuatrimestre: "PRIMERO" },
  createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z",
};
afterEach(() => { cleanup(); session.role = "USER"; });
describe("acceso administrativo desde cada experiencia", () => {
  it("un usuario común no recibe acceso a auditoría aunque sea su comentario", () => {
    render(<ExperienceCard feedback={{ ...feedback, propio: true }} onManage={vi.fn()} showContext />);
    expect(screen.queryByRole("link", { name: /Ver detalle y auditoría/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Administrar mi comentario" })).toBeTruthy();
  });
  it("ADMIN abre el detalle administrativo directamente y conserva filtros y página", () => {
    session.role = "ADMIN";
    const origin = "/home/experiencias?carrera=S&materiaId=m1&page=4";
    render(<ExperienceCard feedback={feedback} onManage={vi.fn()} showContext returnTo={origin} />);
    const link = screen.getByRole("link", { name: /Ver detalle y auditoría/ });
    const url = new URL(link.getAttribute("href")!, "https://local.test");
    expect(url.pathname).toBe("/home/admin/experiencias/f1");
    expect(url.searchParams.get("returnTo")).toBe(origin);
    expect(link.querySelector("svg")).toBeTruthy();
  });
});
