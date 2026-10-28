// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { FeedbackDetail } from "@/components/feedback/FeedbackDetail";
import { obtenerComision } from "@/services/academic";
import { obtenerFeedback, obtenerFeedbackPropio, crearFeedback, actualizarFeedback, eliminarFeedback, listarHistorialFeedback } from "@/services/feedback";
import type { Feedback } from "@/types/feedback";
import { HttpError } from "@/services/http";

const { push, origin } = vi.hoisted(() => ({ push: vi.fn(), origin: { query: "" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: push }), useSearchParams: () => new URLSearchParams(origin.query) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "u1", role: "USER", displayName: "Benjamín" } }) }));
vi.mock("@/services/academic", () => ({ obtenerComision: vi.fn() }));
vi.mock("@/services/feedback", () => ({
  obtenerFeedback: vi.fn(), obtenerFeedbackPropio: vi.fn(), crearFeedback: vi.fn(),
  actualizarFeedback: vi.fn(), eliminarFeedback: vi.fn(), listarHistorialFeedback: vi.fn(),
}));
const comision = {
  id: "c1", cursadaId: "cu1", carrera: "S" as const, numero: 31, nombre: "S-31", activa: true,
  profesores: [{ id: "p1", nombreCompleto: "Ada", cargo: "TITULAR" as const }, { id: "p2", nombreCompleto: "Grace", cargo: "JTP" as const }],
  createdAt: "2026-10-26T12:00:00.000Z", deletedAt: null,
  cursada: { id: "cu1", anio: 2026, cuatrimestre: "PRIMERO" as const, materia: { id: "m1", nombre: "Álgebra" } },
};
const feedback: Feedback = {
  id: "f1", texto: "Buena experiencia", anonimo: true, autor: null, propio: true,
  profesor: { id: "p1", nombreCompleto: "Ada", cargo: "TITULAR" },
  contexto: { comisionId: "c1", nombre: "S-31", materiaId: "m1", materiaNombre: "Álgebra", cursadaId: "cu1", anio: 2026, cuatrimestre: "PRIMERO" },
  createdAt: "2026-10-26T12:00:00.000Z", updatedAt: "2026-10-26T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  origin.query = "";
  vi.mocked(obtenerComision).mockResolvedValue(comision);
  vi.mocked(obtenerFeedbackPropio).mockResolvedValue(null);
  vi.mocked(obtenerFeedback).mockResolvedValue(feedback);
  vi.mocked(crearFeedback).mockResolvedValue(feedback);
  vi.mocked(actualizarFeedback).mockResolvedValue(feedback);
  vi.mocked(eliminarFeedback).mockResolvedValue(undefined);
  vi.mocked(listarHistorialFeedback).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 3 });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

describe("Formulario de feedback", () => {
  it("presenta destinatario antes del texto e identidad con nombre público y ayuda accesible", async () => {
    render(<FeedbackForm comisionId="c1" />);
    const text = await screen.findByRole("textbox", { name: "Tu experiencia" });
    const reference = screen.getByRole("radio", { name: /^La comisión en general/ });
    expect(reference.compareDocumentPosition(text) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const privacy = screen.getByRole("group", { name: "Cómo aparecerá tu comentario" });
    const identity = screen.getByRole("radio", { name: /^Con mi nombre/ });
    expect((identity as HTMLInputElement).checked).toBe(true);
    expect(privacy.contains(identity)).toBe(true);
    expect(screen.getByText("Se mostrará: Benjamín")).toBeTruthy();
    const hint = document.getElementById(identity.getAttribute("aria-describedby")!);
    expect(hint?.textContent).toContain("Tu nombre público aparecerá");
    expect(privacy.contains(hint)).toBe(true);
    await userEvent.click(reference);
    await userEvent.keyboard("{ArrowRight}");
    expect((screen.getByRole("radio", { name: /^Ada/ }) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: /^De forma anónima/ }));
    expect(hint?.textContent).toContain("Tu cuenta seguirá vinculada");
  });
  it("usa selector para listas extensas de docentes y conserva el destinatario enviado", async () => {
    vi.mocked(obtenerComision).mockResolvedValue({ ...comision, profesores: [...comision.profesores, { id: "p3", nombreCompleto: "Docente con nombre largo", cargo: "ADJUNTO" }] });
    render(<FeedbackForm comisionId="c1" />);
    const target = await screen.findByRole("combobox", { name: "¿A quién se refiere tu comentario?" });
    expect((target as HTMLSelectElement).value).toBe("");
    await userEvent.selectOptions(target, "p3");
    await userEvent.type(screen.getByRole("textbox", { name: "Tu experiencia" }), "Clases claras");
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(crearFeedback).toHaveBeenCalledWith("c1", { texto: "Clases claras", anonimo: false, profesorId: "p3" });
  });
  it("con un docente conserva la asociación automática y muestra una modalidad anual real", async () => {
    vi.mocked(obtenerComision).mockResolvedValue({ ...comision, profesores: [comision.profesores[0]], cursada: { ...comision.cursada, materia: { ...comision.cursada.materia, modalidad: "ANUAL" } } });
    render(<FeedbackForm comisionId="c1" />);
    await screen.findByRole("textbox", { name: "Tu experiencia" });
    expect(screen.getByText(/Comisión S-31.*Anual.*2026/)).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /^La comisión en general/ })).toBeNull();
    expect((screen.getByRole("radio", { name: /^Ada/ }) as HTMLInputElement).checked).toBe(true);
    await userEvent.type(screen.getByRole("textbox", { name: "Tu experiencia" }), "Buen acompañamiento");
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(crearFeedback).toHaveBeenCalledWith("c1", { texto: "Buen acompañamiento", anonimo: false });
  });
  it("cuenta puntos de código como backend, rechaza exceso y espacios y vincula el error", async () => {
    render(<FeedbackForm comisionId="c1" />);
    const text = await screen.findByRole("textbox", { name: "Tu experiencia" });
    fireEvent.change(text, { target: { value: " 😀 " } });
    expect(screen.getByText("1 / 3000").closest("[aria-live]")).toBeNull();
    fireEvent.change(text, { target: { value: "a".repeat(3001) } });
    expect(screen.getByText("3001 / 3000")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(text.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText(/admite hasta 3000/)).toBeTruthy();
    expect(crearFeedback).not.toHaveBeenCalled();
    fireEvent.change(text, { target: { value: "   " } });
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(screen.getByText("Escribí tu experiencia antes de publicar.")).toBeTruthy();
    expect(document.activeElement).toBe(text);
    expect(crearFeedback).not.toHaveBeenCalled();
  });
  it("cancela sin cambios directamente al contexto de origen", async () => {
    origin.query = "cursadaId=cu1&comisionesPage=2&page=3&q=Plan&returnTo=https://example.com";
    render(<FeedbackForm comisionId="c1" />);
    await screen.findByRole("textbox", { name: "Tu experiencia" });
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    const url = new URL(String(push.mock.calls[0][0]), "http://localhost");
    expect(url.pathname).toBe("/home/materias/m1/cursadas/cu1/comisiones/c1");
    expect(Object.fromEntries(url.searchParams)).toEqual({ cursadaId: "cu1", comisionesPage: "2", page: "3", q: "Plan" });
    expect(screen.queryByRole("dialog", { name: "Descartar cambios" })).toBeNull();
  });
  it("confirma descartar cambios y permite seguir escribiendo sin perder texto", async () => {
    render(<FeedbackForm comisionId="c1" />);
    const text = await screen.findByRole("textbox", { name: "Tu experiencia" });
    await userEvent.type(text, "Texto pendiente");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Seguir escribiendo" }));
    expect((text as HTMLTextAreaElement).value).toBe("Texto pendiente");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await userEvent.click(screen.getByRole("button", { name: "Descartar y volver" }));
    expect(push).toHaveBeenCalledWith("/home/materias/m1/cursadas/cu1/comisiones/c1");
  });
  it("bloquea envíos duplicados y mantiene progreso discreto hasta terminar", async () => {
    let finish!: (value: Feedback) => void;
    vi.mocked(crearFeedback).mockImplementation(() => new Promise<Feedback>((resolve) => { finish = resolve; }));
    render(<FeedbackForm comisionId="c1" />);
    const text = await screen.findByRole("textbox", { name: "Tu experiencia" });
    fireEvent.change(text, { target: { value: "Experiencia pendiente" } });
    const form = text.closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(crearFeedback).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "Publicando…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish(feedback));
    expect(push).toHaveBeenCalledTimes(1);
  });
  it("publica texto anónimo y permite seleccionar docente cuando hay varios", async () => {
    const user = userEvent.setup();
    render(<FeedbackForm comisionId="c1" />);
    const textarea = await screen.findByRole("textbox", { name: "Tu experiencia" });
    await user.type(textarea, "  Explica con muchos ejemplos  ");
    await user.click(screen.getByRole("radio", { name: /^Grace/ }));
    const anonymous = screen.getByRole("radio", { name: /^De forma anónima/ });
    if (!(anonymous as HTMLInputElement).checked) await user.click(anonymous);
    await user.click(screen.getByRole("button", { name: "Publicar comentario" }));
    await waitFor(() => expect(crearFeedback).toHaveBeenCalledWith("c1", { texto: "Explica con muchos ejemplos", anonimo: true, profesorId: "p2" }));
    expect(String(push.mock.calls[0][0])).toContain("/home/materias/m1/cursadas/cu1/comisiones/c1");
    expect(String(push.mock.calls[0][0])).toContain("successMessage=");
  });
  it("no envía una edición sin diferencias reales", async () => {
    const user = userEvent.setup();
    render(<FeedbackForm feedbackId="f1" />);
    await screen.findByRole("textbox", { name: "Tu experiencia" });
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("No hay cambios para guardar.")).toBeTruthy();
    expect(actualizarFeedback).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
  it("al editar anonimato envía solo esa diferencia y vuelve al detalle", async () => {
    const user = userEvent.setup();
    render(<FeedbackForm feedbackId="f1" />);
    await screen.findByRole("textbox", { name: "Tu experiencia" });
    await user.click(screen.getByRole("radio", { name: /^Con mi nombre/ }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(actualizarFeedback).toHaveBeenCalledWith("f1", { anonimo: false }));
    expect(String(push.mock.calls[0][0])).toContain("/home/feedback/f1?successMessage=");
    expect(screen.queryByRole("combobox")).toBeNull();
  });
  it("impide duplicados desde el formulario cuando ya tiene publicación vigente", async () => {
    vi.mocked(obtenerFeedbackPropio).mockResolvedValue(feedback);
    render(<FeedbackForm comisionId="c1" />);
    await waitFor(() => expect(obtenerFeedbackPropio).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Publicar comentario" })).toBeNull());
    expect(await screen.findByRole("link", { name: /comentario/i })).toBeTruthy();
  });
  it("una comisión inactiva no ofrece publicar", async () => {
    vi.mocked(obtenerComision).mockResolvedValue({ ...comision, activa: false });
    render(<FeedbackForm comisionId="c1" />);
    expect(await screen.findByText(/inactiva/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Publicar comentario" })).toBeNull();
  });
  it("muestra errores del servidor conservando el texto para reintentar", async () => {
    const user = userEvent.setup();
    vi.mocked(crearFeedback).mockRejectedValue(new Error("Lo sentimos. No pudimos publicar, intentá nuevamente."));
    render(<FeedbackForm comisionId="c1" />);
    const textarea = await screen.findByRole("textbox", { name: "Tu experiencia" });
    await user.type(textarea, "Experiencia para conservar");
    await user.click(screen.getByRole("radio", { name: /^De forma anónima/ }));
    await user.click(screen.getByRole("radio", { name: /^Grace/ }));
    await user.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(await screen.findByText(/No pudimos publicar/)).toBeTruthy();
    expect((textarea as HTMLTextAreaElement).value).toBe("Experiencia para conservar");
    expect(push).not.toHaveBeenCalled();
    expect((screen.getByRole("radio", { name: /^De forma anónima/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /^Grace/ }) as HTMLInputElement).checked).toBe(true);
    vi.mocked(crearFeedback).mockResolvedValue(feedback);
    await user.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(crearFeedback).toHaveBeenLastCalledWith("c1", { texto: "Experiencia para conservar", anonimo: true, profesorId: "p2" });
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("Detalle de feedback", () => {
  it("escapa el texto propio publicado al mostrar el detalle privado", async () => {
    const texto = '<img src=x onerror="alert(1)">';
    vi.mocked(obtenerFeedback).mockResolvedValue({ ...feedback, texto });
    const { container } = render(<FeedbackDetail feedbackId="f1" />);
    expect(await screen.findByText(texto)).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
  });
  // TASK-059: other authors cannot access this route, including through a copied URL.
  it("un detalle ajeno rechazado por backend no ofrece gestión ni consulta historial", async () => {
    vi.mocked(obtenerFeedback).mockRejectedValue(new HttpError(403, "Solo podés consultar el detalle de tus propios comentarios."));
    render(<FeedbackDetail feedbackId="ajeno" />);
    expect(await screen.findByText(/Solo podés consultar el detalle/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Eliminar comentario" })).toBeNull();
    expect(listarHistorialFeedback).not.toHaveBeenCalled();
  });
  it("requiere confirmar antes de eliminar y vuelve a la comisión con mensaje", async () => {
    const user = userEvent.setup();
    render(<FeedbackDetail feedbackId="f1" />);
    await user.click(await screen.findByRole("button", { name: "Eliminar comentario" }));
    expect(eliminarFeedback).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    await waitFor(() => expect(eliminarFeedback).toHaveBeenCalledWith("f1"));
    expect(String(push.mock.calls[0][0])).toContain("comisiones/c1?successMessage=");
  });
});
