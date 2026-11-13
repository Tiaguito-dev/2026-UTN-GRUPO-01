// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { FeedbackCard } from "@/components/feedback/FeedbackCard";
import { ExperienceCard } from "@/components/feedback/ExperienceCard";
import type { Feedback } from "@/types/feedback";

vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => false }));
const feedback: Feedback = {
  id: "f1", texto: "Experiencia individual", puntuacion: 4, anonimo: true, autor: null, propio: true,
  profesor: { id: "p1", nombreCompleto: "Ada", cargo: "TITULAR" },
  contexto: { comisionId: "c1", nombre: "S-31", materiaId: "m1", materiaNombre: "Álgebra", cursadaId: "cu1", anio: 2026, cuatrimestre: "PRIMERO" },
  createdAt: "2026-01-01T12:00:00Z", updatedAt: "2026-01-02T12:00:00Z",
};
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe.each(["propio", "público"] as const)("Estrellas del comentario %s", kind => {
  function card(puntuacion: number | null, anonimo = true) {
    // A subject summary must never replace the comment's individual score.
    const item = { ...feedback, puntuacion, anonimo, autor: anonimo ? null : { displayName: "Ana" }, valoracion: { promedio: 2, cantidad: 100 } };
    return kind === "propio" ? <FeedbackCard feedback={item} materiaHref="/home/materias/m1" /> : <ExperienceCard feedback={item} showContext onManage={vi.fn()} />;
  }
  it.each([1, 2, 3, 4, 5])("presenta %i estrellas individuales, decorativas y de solo lectura", puntuacion => {
    render(card(puntuacion));
    const article = screen.getByRole("article");
    const description = within(article).getByText(`${puntuacion} de 5 estrellas`);
    expect(within(article).getAllByText(`${puntuacion} de 5 estrellas`)).toHaveLength(1);
    const stars = description.parentElement!.querySelectorAll("svg");
    expect(stars).toHaveLength(5);
    expect([...stars].filter(star => star.getAttribute("fill") === "currentColor")).toHaveLength(puntuacion);
    for (const star of stars) expect(star.getAttribute("aria-hidden")).toBe("true");
    expect(within(article).queryAllByRole("radio")).toHaveLength(0);
    expect(within(article).queryAllByRole("img")).toHaveLength(0);
    expect(within(article).getByText(feedback.texto)).toBeTruthy();
    expect(within(article).getByText("Sobre Ada")).toBeTruthy();
    expect(article.querySelector(`time[datetime="${feedback.createdAt}"]`)).toBeTruthy();
  });
  it("un histórico NULL no inventa estrellas ni usa el promedio de materia", () => {
    render(card(null));
    expect(screen.queryByText(/de 5 estrellas/)).toBeNull();
    expect(screen.getByText(feedback.texto)).toBeTruthy();
  });
  it("conserva la puntuación al cambiar únicamente identidad pública", () => {
    const view = render(card(4));
    expect(screen.getByText("Anónimo")).toBeTruthy();
    view.rerender(card(4, false));
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.queryByText("Anónimo")).toBeNull();
    expect(screen.getByText("4 de 5 estrellas")).toBeTruthy();
  });
});
