// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackForm } from "@/components/feedback/FeedbackForm";
import { FeedbackDetail } from "@/components/feedback/FeedbackDetail";
import { listarCursadasPorMateria, listarComisionesPorCursada, obtenerComision } from "@/services/academic";
import { obtenerFeedback, obtenerFeedbackPropio, obtenerNormasConvivencia, crearFeedback, actualizarFeedback, eliminarFeedback, listarHistorialFeedback } from "@/services/feedback";
import type { Feedback } from "@/types/feedback";
import { FeedPrincipal } from "@/components/feedback/FeedPrincipal";
import { listarMaterias } from "@/services/materias";
import { listarFeedComentarios } from "@/services/feedback-feed";
import { HttpError } from "@/services/http";

const { push, origin } = vi.hoisted(() => ({ push: vi.fn(), origin: { query: "" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: push }), useSearchParams: () => new URLSearchParams(origin.query) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "u1", role: "USER", displayName: "Benjamín" } }) }));
vi.mock("@/services/academic", () => ({ obtenerComision: vi.fn(), listarCursadasPorMateria: vi.fn(), listarComisionesPorCursada: vi.fn() }));
vi.mock("@/services/materias", () => ({ listarMaterias: vi.fn() }));
vi.mock("@/services/feedback-feed", () => ({ listarFeedComentarios: vi.fn() }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => false }));
vi.mock("@/services/feedback", () => ({
  obtenerFeedback: vi.fn(), obtenerFeedbackPropio: vi.fn(), obtenerNormasConvivencia: vi.fn(), crearFeedback: vi.fn(),
  actualizarFeedback: vi.fn(), eliminarFeedback: vi.fn(), listarHistorialFeedback: vi.fn(),
}));
const comision = {
  id: "c1", cursadaId: "cu1", carrera: "S" as const, numero: 31, nombre: "S-31", activa: true,
  profesores: [{ id: "p1", nombreCompleto: "Ada", cargo: "TITULAR" as const }, { id: "p2", nombreCompleto: "Grace", cargo: "JTP" as const }],
  createdAt: "2026-10-26T12:00:00.000Z", deletedAt: null,
  cursada: { id: "cu1", anio: 2026, cuatrimestre: "PRIMERO" as const, materia: { id: "m1", nombre: "Álgebra" } },
};
const feedback: Feedback = {
  id: "f1", texto: "Buena experiencia", puntuacion: 3, anonimo: true, autor: null, propio: true,
  profesor: { id: "p1", nombreCompleto: "Ada", cargo: "TITULAR" },
  contexto: { carrera: "S", comisionId: "c1", nombre: "S-31", materiaId: "m1", materiaNombre: "Álgebra", cursadaId: "cu1", anio: 2026, cuatrimestre: "PRIMERO" },
  createdAt: "2026-10-26T12:00:00.000Z", updatedAt: "2026-10-26T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  origin.query = "";
  vi.mocked(obtenerComision).mockResolvedValue(comision);
  vi.mocked(obtenerFeedbackPropio).mockResolvedValue(null);
  vi.mocked(obtenerNormasConvivencia).mockResolvedValue({ version: "1", aceptada: true, reglas: ["Respetá a otras personas."] });
  vi.mocked(obtenerFeedback).mockResolvedValue(feedback);
  vi.mocked(crearFeedback).mockResolvedValue(feedback);
  vi.mocked(actualizarFeedback).mockResolvedValue(feedback);
  vi.mocked(eliminarFeedback).mockResolvedValue(undefined);
  vi.mocked(listarHistorialFeedback).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 3 });
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(cleanup);

describe("Estrellas en snapshots del historial", () => {
  it("carga diferida muestra cada puntuación de versión sin sustituirla por la actual", async () => {
    vi.mocked(listarHistorialFeedback).mockResolvedValue({ items: [
      { id: "h1", accion: "CREACION", texto: "Histórico sin voto", puntuacion: null, anonimo: true, createdAt: feedback.createdAt },
      { id: "h2", accion: "EDICION", texto: "Versión con cuatro", puntuacion: 4, anonimo: false, createdAt: feedback.updatedAt },
      { id: "h3", accion: "ELIMINACION", texto: "Versión con cinco", puntuacion: 5, anonimo: true, createdAt: feedback.updatedAt },
    ], total: 3, page: 1, pageSize: 3 });
    render(<FeedbackDetail feedbackId="f1" />);
    const summary = await screen.findByText("Historial de cambios");
    expect(listarHistorialFeedback).not.toHaveBeenCalled();
    await userEvent.click(summary);
    const historical = (await screen.findByText("Histórico sin voto")).closest("li")!;
    expect(within(historical).queryByText(/de 5 estrellas/)).toBeNull();
    const edited = screen.getByText("Versión con cuatro").closest("li")!;
    expect(within(edited).getByText("4 de 5 estrellas")).toBeTruthy();
    expect(within(edited).getByText(/Con nombre visible/)).toBeTruthy();
    const removed = screen.getByText("Versión con cinco").closest("li")!;
    expect(within(removed).getByText("5 de 5 estrellas")).toBeTruthy();
    expect(listarHistorialFeedback).toHaveBeenCalledTimes(1);
    expect(listarHistorialFeedback).toHaveBeenCalledWith("f1", { page: 1, pageSize: 3 });
    expect(obtenerFeedback).toHaveBeenCalledTimes(1);
  });
});

describe("Formulario de feedback", () => {
  it.each([
    "Ya publicó un comentario en esta comisión. Puede editarlo o eliminarlo antes de volver a publicar.",
    "La comisión no está activa. Puede consultar los comentarios o retirar el suyo.",
    "La cuenta cambió en otra pestaña. Comprobá la sesión antes de continuar.",
  ])("conserva el borrador sin refrescar normas ante otro 409: %s", async (message) => {
    vi.mocked(crearFeedback).mockRejectedValueOnce(new HttpError(409, message));
    render(<FeedbackForm comisionId="c1" />);
    const text = await screen.findByRole("textbox", { name: "Tu experiencia" });
    await userEvent.type(text, "Borrador con estrellas");
    await userEvent.click(screen.getByRole("radio", { name: "4 estrellas" }));
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(obtenerNormasConvivencia).toHaveBeenCalledTimes(1);
    expect((text as HTMLTextAreaElement).value).toBe("Borrador con estrellas");
    expect((screen.getByRole("radio", { name: "4 estrellas" }) as HTMLInputElement).checked).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });

  it("permite consultar las normas sin perder el borrador y exige aceptación explícita de la versión mostrada", async () => {
    const reglas = ["Respetá a otras personas.", "No publiques datos personales de terceros."];
    vi.mocked(obtenerNormasConvivencia).mockResolvedValue({ version: "2", aceptada: false, reglas });
    render(<FeedbackForm comisionId="c1" />);
    const checkbox = await screen.findByRole("checkbox", { name: /Acepto las Normas de convivencia/i }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    const text = screen.getByRole("textbox", { name: "Tu experiencia" }) as HTMLTextAreaElement;
    await userEvent.type(text, "Buen acompañamiento");
    await userEvent.click(screen.getByRole("radio", { name: "4 estrellas" }));
    await userEvent.click(screen.getByRole("link", { name: /Normas de convivencia/i }));
    const dialog = screen.getByRole("dialog", { name: /Normas de convivencia/i });
    for (const regla of reglas) expect(within(dialog).getByText(regla)).toBeTruthy();
    await userEvent.click(within(dialog).getByRole("button", { name: /Volver a la reseña/i }));
    expect(text.value).toBe("Buen acompañamiento");
    expect(checkbox.checked).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(await screen.findByText(/debés aceptar las normas/i)).toBeTruthy();
    expect(crearFeedback).not.toHaveBeenCalled();
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(crearFeedback).toHaveBeenCalledExactlyOnceWith("c1", {
      texto: "Buen acompañamiento", anonimo: false, puntuacion: 4, profesorId: null, versionNormas: "2",
    });
  });
  it("pide una nueva aceptación y conserva el texto si las normas cambian durante la escritura", async () => {
    const normas = { aceptada: false, reglas: ["Respetá a otras personas."] };
    vi.mocked(obtenerNormasConvivencia)
      .mockResolvedValueOnce({ ...normas, version: "1" })
      .mockResolvedValueOnce({ ...normas, version: "2" });
    vi.mocked(crearFeedback).mockRejectedValueOnce(new HttpError(409, "Debés aceptar las normas de convivencia vigentes para publicar."));
    render(<FeedbackForm comisionId="c1" />);
    const original = await screen.findByRole("checkbox", { name: /Acepto las Normas de convivencia/i });
    await userEvent.type(screen.getByRole("textbox", { name: "Tu experiencia" }), "Clases prácticas");
    await userEvent.click(screen.getByRole("radio", { name: "4 estrellas" }));
    await userEvent.click(original);
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    await waitFor(() => expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false));
    expect((screen.getByRole("textbox", { name: "Tu experiencia" }) as HTMLTextAreaElement).value).toBe("Clases prácticas");
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(crearFeedback).toHaveBeenLastCalledWith("c1", { texto: "Clases prácticas", anonimo: false, puntuacion: 4, profesorId: null, versionNormas: "2" });
  });
  it("regresa a la página de Experiencias de origen y conserva ese regreso al editar", async () => {
    origin.query = "origen=experiencias&experienciasPage=4&experienciasCarrera=I&experienciasMateriaId=m1";
    render(<FeedbackDetail feedbackId="f1" />);
    const edit = await screen.findByRole("link", { name: "Editar comentario" });
    expect(screen.getByRole("link", { name: "Volver a Experiencias" }).getAttribute("href")).toBe("/home/experiencias?carrera=I&materiaId=m1&page=4");
    expect(new URL(edit.getAttribute("href")!, "http://local").searchParams.get("experienciasPage")).toBe("4");
    expect(new URL(edit.getAttribute("href")!, "http://local").searchParams.get("experienciasCarrera")).toBe("I");
    expect(new URL(edit.getAttribute("href")!, "http://local").searchParams.get("experienciasMateriaId")).toBe("m1");
    const subject = screen.getByRole("heading", { name: "Álgebra" }).querySelector("a")!;
    expect(new URL(subject.getAttribute("href")!, "http://local").searchParams.get("experienciasMateriaId")).toBe("m1");
    expect(within(screen.getByRole("navigation")).getByRole("link", { name: "Comisión S-31" })).toBeTruthy();
  });
  it("conserva materia, comisión y filtros en el recorrido de alta y edición", async () => {
    origin.query = "carrera=S&anioCarrera=2&listadoPage=3&q=álgebra&cursadaId=cu1&comisionesPage=2";
    const view = render(<FeedbackForm comisionId="c1" />);
    await screen.findByRole("textbox", { name: "Tu experiencia" });
    const nav = within(screen.getByRole("navigation", { name: "Ubicación actual" }));
    const subject = new URL(nav.getByRole("link", { name: "Álgebra" }).getAttribute("href")!, "http://local");
    expect(subject.pathname).toBe("/home/materias/m1");
    expect(subject.searchParams.get("cursadaId")).toBe("cu1");
    expect(subject.searchParams.get("comisionesPage")).toBe("2");
    const list = new URL(nav.getByRole("link", { name: "Materias" }).getAttribute("href")!, "http://local");
    expect(list.searchParams.get("page")).toBe("3");
    expect(list.searchParams.get("q")).toBe("álgebra");
    view.unmount();
    render(<FeedbackForm feedbackId="f1" />);
    await screen.findByRole("textbox", { name: "Tu experiencia" });
    // TASK-066: el detalle privado se identifica ahora como Tu comentario.
    const comment = screen.getByRole("link", { name: "Volver a tu comentario" });
    expect(new URL(comment.getAttribute("href")!, "http://local").searchParams.get("listadoPage")).toBe("3");
    expect(within(screen.getByRole("navigation")).getByRole("link", { name: "Tu comentario" })).toBeTruthy();
  });
  it("el detalle privado mantiene el recorrido real y el contexto al editar", async () => {
    origin.query = "carrera=S&listadoPage=2&comisionesPage=3";
    render(<FeedbackDetail feedbackId="f1" />);
    const edit = await screen.findByRole("link", { name: "Editar comentario" });
    expect(new URL(edit.getAttribute("href")!, "http://local").searchParams.get("listadoPage")).toBe("2");
    const nav = within(screen.getByRole("navigation"));
    expect(nav.getByRole("link", { name: "Álgebra" }).getAttribute("href")).toContain("/home/materias/m1?");
    expect(nav.getByRole("link", { name: "Comisión S-31" }).getAttribute("href")).toContain("/comisiones/c1?");
    expect(new URL(screen.getByRole("link", { name: "Volver a Comisión" }).getAttribute("href")!, "http://local").searchParams.get("comisionesPage")).toBe("3");
  });
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
    expect(screen.queryByRole("checkbox", { name: /Acepto las Normas de convivencia/i })).toBeNull();
    expect((target as HTMLSelectElement).value).toBe("");
    await userEvent.selectOptions(target, "p3");
    await userEvent.type(screen.getByRole("textbox", { name: "Tu experiencia" }), "Clases claras");
    await userEvent.click(screen.getByRole("radio", { name: "3 estrellas" }));
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(crearFeedback).toHaveBeenCalledWith("c1", { texto: "Clases claras", anonimo: false, profesorId: "p3", puntuacion: 3 });
  });
  it("con un docente conserva la asociación automática y muestra una modalidad anual real", async () => {
    // TASK-067: la cursada real es anual; su período prima sobre la modalidad de materia.
    vi.mocked(obtenerComision).mockResolvedValue({ ...comision, profesores: [comision.profesores[0]], cursada: { ...comision.cursada, cuatrimestre: "ANUAL", materia: { ...comision.cursada.materia, modalidad: "ANUAL" } } });
    render(<FeedbackForm comisionId="c1" />);
    await screen.findByRole("textbox", { name: "Tu experiencia" });
    expect(screen.getByText(/Comisión S-31.*Anual.*2026/)).toBeTruthy();
    expect(screen.queryByRole("radio", { name: /^La comisión en general/ })).toBeNull();
    expect((screen.getByRole("radio", { name: /^Ada/ }) as HTMLInputElement).checked).toBe(true);
    await userEvent.type(screen.getByRole("textbox", { name: "Tu experiencia" }), "Buen acompañamiento");
    await userEvent.click(screen.getByRole("radio", { name: "3 estrellas" }));
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(crearFeedback).toHaveBeenCalledWith("c1", { texto: "Buen acompañamiento", anonimo: false, puntuacion: 3 });
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
    await userEvent.click(screen.getByRole("radio", { name: "3 estrellas" }));
    const form = text.closest("form")!;
    fireEvent.submit(form); fireEvent.submit(form);
    expect(crearFeedback).toHaveBeenCalledTimes(1);
    expect((screen.getByRole("button", { name: "Publicando…" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Cancelar" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("radio", { name: "5 estrellas" }) as HTMLInputElement).disabled).toBe(true);
    await act(async () => finish(feedback));
    expect(push).toHaveBeenCalledTimes(1);
  });
  it("publica texto anónimo y permite seleccionar docente cuando hay varios", async () => {
    const user = userEvent.setup();
    render(<FeedbackForm comisionId="c1" />);
    const textarea = await screen.findByRole("textbox", { name: "Tu experiencia" });
    await user.type(textarea, "  Explica con muchos ejemplos  ");
    await user.click(screen.getByRole("radio", { name: "3 estrellas" }));
    await user.click(screen.getByRole("radio", { name: /^Grace/ }));
    const anonymous = screen.getByRole("radio", { name: /^De forma anónima/ });
    if (!(anonymous as HTMLInputElement).checked) await user.click(anonymous);
    await user.click(screen.getByRole("button", { name: "Publicar comentario" }));
    await waitFor(() => expect(crearFeedback).toHaveBeenCalledWith("c1", { texto: "Explica con muchos ejemplos", anonimo: true, profesorId: "p2", puntuacion: 3 }));
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
  it("cancelar una edición sin cambios regresa al detalle privado con su origen filtrado", async () => {
    origin.query = "origen=experiencias&experienciasCarrera=S&experienciasMateriaId=m1&experienciasPage=2";
    render(<FeedbackForm feedbackId="f1" />);
    await screen.findByRole("textbox", { name: "Tu experiencia" });
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(actualizarFeedback).not.toHaveBeenCalled();
    const url = new URL(String(push.mock.calls.at(-1)?.[0]), "http://local");
    expect(url.pathname).toBe("/home/feedback/f1");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ origen: "experiencias", experienciasCarrera: "S", experienciasMateriaId: "m1", experienciasPage: "2" });
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
    await user.click(screen.getByRole("radio", { name: "3 estrellas" }));
    await user.click(screen.getByRole("radio", { name: /^De forma anónima/ }));
    await user.click(screen.getByRole("radio", { name: /^Grace/ }));
    await user.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(await screen.findByText(/No pudimos publicar/)).toBeTruthy();
    expect((textarea as HTMLTextAreaElement).value).toBe("Experiencia para conservar");
    expect(push).not.toHaveBeenCalled();
    expect((screen.getByRole("radio", { name: /^De forma anónima/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /^Grace/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "3 estrellas" }) as HTMLInputElement).checked).toBe(true);
    vi.mocked(crearFeedback).mockResolvedValue(feedback);
    await user.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(crearFeedback).toHaveBeenLastCalledWith("c1", { texto: "Experiencia para conservar", anonimo: true, profesorId: "p2", puntuacion: 3 });
    expect(push).toHaveBeenCalledTimes(1);
  });
});

describe("Estrellas en el formulario", () => {
  it("creación empieza con cinco estrellas sin selección y exige una antes de publicar", async () => {
    render(<FeedbackForm comisionId="c1" />);
    const text = await screen.findByRole("textbox", { name: "Tu experiencia" });
    const group = screen.getByRole("group", { name: "Valoración de la materia" });
    expect(within(group).getAllByRole("radio")).toHaveLength(5);
    expect(within(group).getAllByRole("radio").every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
    await userEvent.type(text, "Experiencia completa");
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(crearFeedback).not.toHaveBeenCalled();
    const first = screen.getByRole("radio", { name: "1 estrella" });
    expect(document.activeElement).toBe(first);
    expect(first.closest("fieldset")?.getAttribute("aria-invalid")).toBe("true");
    const ids = first.getAttribute("aria-describedby")!.split(" ");
    expect(ids.some(id => document.getElementById(id)?.textContent?.includes("Elegí una puntuación"))).toBe(true);
    expect((text as HTMLTextAreaElement).value).toBe("Experiencia completa");
    await userEvent.click(screen.getByRole("radio", { name: "5 estrellas" }));
    expect(screen.queryByText("Elegí una puntuación de 1 a 5 estrellas.")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(crearFeedback).toHaveBeenCalledWith("c1", { texto: "Experiencia completa", anonimo: false, profesorId: null, puntuacion: 5 });
  });

  it("edición precarga estrellas, conserva selección al reclicar y envía solo la nueva puntuación", async () => {
    vi.mocked(obtenerFeedback).mockResolvedValue({ ...feedback, puntuacion: 3 });
    render(<FeedbackForm feedbackId="f1" />);
    const selected = await screen.findByRole("radio", { name: "3 estrellas" });
    expect((selected as HTMLInputElement).checked).toBe(true);
    await userEvent.click(selected);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarFeedback).not.toHaveBeenCalled();
    expect(screen.getByText("No hay cambios para guardar.")).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "4 estrellas" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarFeedback).toHaveBeenCalledWith("f1", { puntuacion: 4 });
  });

  it("edición de texto no reenvía estrellas precargadas", async () => {
    vi.mocked(obtenerFeedback).mockResolvedValue({ ...feedback, puntuacion: 3 });
    render(<FeedbackForm feedbackId="f1" />);
    const text = await screen.findByRole("textbox", { name: "Tu experiencia" });
    await userEvent.clear(text);
    await userEvent.type(text, "Texto ampliado");
    expect((screen.getByRole("radio", { name: "3 estrellas" }) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarFeedback).toHaveBeenCalledWith("f1", { texto: "Texto ampliado" });
  });

  it("histórico puede editar anonimato sin añadir estrellas", async () => {
    vi.mocked(obtenerFeedback).mockResolvedValue({ ...feedback, puntuacion: null });
    render(<FeedbackForm feedbackId="f1" />);
    const group = await screen.findByRole("group", { name: "Valoración de la materia" });
    expect(within(group).getAllByRole("radio").every(radio => !(radio as HTMLInputElement).checked)).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: /^Con mi nombre/ }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarFeedback).toHaveBeenCalledWith("f1", { anonimo: false });
  });

  it("histórico puede incorporar una puntuación sin cambiar texto", async () => {
    vi.mocked(obtenerFeedback).mockResolvedValue({ ...feedback, puntuacion: null });
    render(<FeedbackForm feedbackId="f1" />);
    await userEvent.click(await screen.findByRole("radio", { name: "1 estrella" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarFeedback).toHaveBeenCalledWith("f1", { puntuacion: 1 });
  });

  it("solo cambiar estrellas activa confirmación de cancelación y conserva la selección", async () => {
    render(<FeedbackForm comisionId="c1" />);
    await userEvent.click(await screen.findByRole("radio", { name: "4 estrellas" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Seguir escribiendo" }));
    expect((screen.getByRole("radio", { name: "4 estrellas" }) as HTMLInputElement).checked).toBe(true);
    expect(crearFeedback).not.toHaveBeenCalled();
  });

  it("un fallo de edición conserva las estrellas elegidas y permite reintentar el mismo PATCH", async () => {
    vi.mocked(obtenerFeedback).mockResolvedValue({ ...feedback, puntuacion: 3 });
    vi.mocked(actualizarFeedback).mockRejectedValueOnce(new Error("No se pudo guardar la puntuación"));
    render(<FeedbackForm feedbackId="f1" />);
    await userEvent.click(await screen.findByRole("radio", { name: "5 estrellas" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByText("No se pudo guardar la puntuación")).toBeTruthy();
    expect((screen.getByRole("radio", { name: "5 estrellas" }) as HTMLInputElement).checked).toBe(true);
    expect(push).not.toHaveBeenCalled();
    vi.mocked(actualizarFeedback).mockResolvedValue({ ...feedback, puntuacion: 5 });
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarFeedback).toHaveBeenCalledTimes(2);
    expect(actualizarFeedback).toHaveBeenLastCalledWith("f1", { puntuacion: 5 });
  });
});

describe("Períodos legados", () => {
  it("no inventa un período cuando la cursada lo tiene sin definir", async () => {
    vi.mocked(obtenerComision).mockResolvedValue({ ...comision, cursada: { ...comision.cursada, cuatrimestre: null, materia: { ...comision.cursada.materia, modalidad: "ANUAL" } } });
    render(<FeedbackForm comisionId="c1" />);
    await screen.findByRole("textbox", { name: "Tu experiencia" });
    expect(screen.getByText(/Comisión S-31.*Cursada 2026/)).toBeTruthy();
    expect(screen.queryByText(/Comisión S-31.*Anual/)).toBeNull();
  });
});

describe("Detalle de feedback", () => {
  it("reúne contexto, acciones y metadatos en la tarjeta propia sin auditoría ni versiones permanentes", async () => {
    render(<FeedbackDetail feedbackId="f1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Tu comentario" })).toBeTruthy();
    const article = await screen.findByRole("article", { name: "Tu comentario" });
    const card = within(article);
    expect(card.getByRole("heading", { name: "Álgebra" })).toBeTruthy();
    expect(card.getByRole("link", { name: "Álgebra" }).getAttribute("href")).toContain("/home/materias/m1");
    expect(card.getByText(/Ingeniería en Sistemas de Información/)).toBeTruthy();
    expect(await card.findByRole("link", { name: "Editar comentario" })).toBeTruthy();
    expect(card.getByRole("button", { name: "Eliminar comentario" })).toBeTruthy();
    expect(card.getByText("Anónimo")).toBeTruthy();
    expect(card.getByText("Publicado")).toBeTruthy();
    expect(card.queryByText("Última edición")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Auditoría" })).toBeNull();
    expect(screen.getByText("Historial de cambios").closest("details")?.open).toBe(false);
    expect(listarHistorialFeedback).not.toHaveBeenCalled();
    expect(screen.getAllByText(feedback.texto)).toHaveLength(1);
  });
  it("muestra identidad pública con nombre y última edición real, conservando texto largo", async () => {
    const texto = `Primer párrafo\n${"palabra".repeat(400)}`;
    vi.mocked(obtenerFeedback).mockResolvedValue({ ...feedback, texto, anonimo: false, autor: { displayName: "Nombre público" }, profesor: null, updatedAt: "2026-10-27T14:00:00.000Z" });
    render(<FeedbackDetail feedbackId="f1" />);
    const card = within(await screen.findByRole("article", { name: "Tu comentario" }));
    expect(card.getByText("Nombre público")).toBeTruthy();
    expect(card.getByText("Última edición")).toBeTruthy();
    expect(card.getByText("Sobre la comisión en general")).toBeTruthy();
    expect(card.getByText(/Primer párrafo/).textContent).toBe(texto);
    expect(card.getAllByRole("time").map(node => node.getAttribute("dateTime"))).toEqual([feedback.createdAt, "2026-10-27T14:00:00.000Z"]);
  });
  it("carga el historial al abrir, pagina tres versiones y deja de repetirlas al cerrar", async () => {
    const row = { id: "h1", accion: "CREACION" as const, texto: "Versión original real", puntuacion: null, anonimo: true, createdAt: feedback.createdAt };
    vi.mocked(listarHistorialFeedback).mockResolvedValue({ items: [row], total: 4, page: 1, pageSize: 3 });
    render(<FeedbackDetail feedbackId="f1" />);
    const summary = await screen.findByText("Historial de cambios");
    expect(listarHistorialFeedback).not.toHaveBeenCalled();
    await userEvent.click(summary);
    expect(await screen.findByText(row.texto)).toBeTruthy();
    expect(listarHistorialFeedback).toHaveBeenLastCalledWith("f1", { page: 1, pageSize: 3 });
    vi.mocked(listarHistorialFeedback).mockResolvedValue({ items: [{ ...row, id: "h2", accion: "EDICION", texto: "Texto editado real" }], total: 4, page: 2, pageSize: 3 });
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(await screen.findByText("Texto editado real")).toBeTruthy();
    expect(listarHistorialFeedback).toHaveBeenLastCalledWith("f1", { page: 2, pageSize: 3 });
    await userEvent.click(summary);
    await waitFor(() => expect(screen.queryByText("Texto editado real")).toBeNull());
    expect(summary.closest("details")?.open).toBe(false);
    vi.mocked(listarHistorialFeedback).mockResolvedValue({ items: [row], total: 1, page: 1, pageSize: 3 });
    await userEvent.click(summary);
    expect(await screen.findByText(row.texto)).toBeTruthy();
    expect(listarHistorialFeedback).toHaveBeenLastCalledWith("f1", { page: 1, pageSize: 3 });
  });
  it("mantiene el historial vacío o con error recuperable dentro del desplegable", async () => {
    vi.mocked(listarHistorialFeedback).mockRejectedValueOnce(new Error("No pudimos recuperar las versiones."));
    render(<FeedbackDetail feedbackId="f1" />);
    await userEvent.click(await screen.findByText("Historial de cambios"));
    expect(await screen.findByText(/No pudimos recuperar las versiones/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("No hay cambios registrados.")).toBeTruthy();
  });
  it("permite cancelar la eliminación y conservar el comentario; luego elimina con regreso filtrado", async () => {
    origin.query = "origen=experiencias&experienciasCarrera=S&experienciasMateriaId=m1&experienciasPage=3";
    render(<FeedbackDetail feedbackId="f1" />);
    const remove = await screen.findByRole("button", { name: "Eliminar comentario" });
    await userEvent.click(remove);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(eliminarFeedback).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(remove);
    await userEvent.click(remove);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    const url = new URL(String(push.mock.calls[0][0]), "http://local");
    expect(url.pathname).toBe("/home/experiencias");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ carrera: "S", materiaId: "m1", page: "3", successMessage: "El comentario se eliminó correctamente." });
  });
  it("una comisión inactiva conserva la eliminación pero no ofrece edición", async () => {
    vi.mocked(obtenerComision).mockResolvedValue({ ...comision, activa: false });
    render(<FeedbackDetail feedbackId="f1" />);
    await screen.findByText(/La comisión está inactiva/);
    expect(screen.queryByRole("link", { name: "Editar comentario" })).toBeNull();
    expect(screen.getByRole("button", { name: "Eliminar comentario" })).toBeTruthy();
  });
  it("un error al eliminar conserva el contenido y permite reintentar desde la misma tarjeta", async () => {
    vi.mocked(eliminarFeedback).mockRejectedValueOnce(new Error("Lo sentimos. No pudimos eliminar tu comentario, intentá nuevamente."));
    render(<FeedbackDetail feedbackId="f1" />);
    const remove = await screen.findByRole("button", { name: "Eliminar comentario" });
    await userEvent.click(remove);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    expect(await screen.findByText(/No pudimos eliminar tu comentario/)).toBeTruthy();
    expect(screen.getByText(feedback.texto)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(remove);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar eliminación" }));
    await waitFor(() => expect(eliminarFeedback).toHaveBeenCalledTimes(2));
    expect(push).toHaveBeenCalledTimes(1);
  });
  it("no presenta contenido ni gestión si una respuesta indica autor ajeno, y permite tabular las acciones propias", async () => {
    vi.mocked(obtenerFeedback).mockResolvedValueOnce({ ...feedback, propio: false });
    const view = render(<FeedbackDetail feedbackId="f1" />);
    await screen.findByText(/Solo podés consultar el detalle de tus propios/);
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.queryByText(feedback.texto)).toBeNull();
    expect(listarHistorialFeedback).not.toHaveBeenCalled();
    expect(obtenerComision).not.toHaveBeenCalled();
    view.unmount();
    render(<FeedbackDetail feedbackId="propio" />);
    const edit = await screen.findByRole("link", { name: "Editar comentario" });
    edit.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Eliminar comentario" }));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Álgebra" }).querySelector("a"));
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByText("Historial de cambios"));
  });
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


describe("Block 7A: publishing from Inicio", () => {
  const materia = { id: "m1", nombre: "Algebra", modalidad: "ANUAL" as const, carreras: [], createdAt: "2026-01-01", deletedAt: null, valoracion: { promedio: null, cantidad: 0 } };
  beforeEach(() => {
    vi.mocked(listarMaterias).mockResolvedValue({ items: [materia, { ...materia, id: "deleted", nombre: "Deleted subject", deletedAt: "2026-01-01" }], total: 2, page: 1, pageSize: 9 });
    vi.mocked(listarCursadasPorMateria).mockResolvedValue({ items: [{ id: "cu1", anio: 2026, cuatrimestre: "ANUAL", comisiones: 3, profesores: 2, carreras: ["S"] }], total: 1, page: 1, pageSize: 9 });
    vi.mocked(listarComisionesPorCursada).mockResolvedValue({ items: [comision, { ...comision, id: "inactive", nombre: "Inactive", activa: false }, { ...comision, id: "deleted", nombre: "Deleted", deletedAt: "2026-01-01" }, { ...comision, id: "foreign", nombre: "Foreign", cursadaId: "other" }], total: 4, page: 1, pageSize: 9 });
    vi.mocked(listarFeedComentarios).mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  });
  async function chooseUntilCommission() {
    render(<FeedPrincipal />); expect(listarMaterias).not.toHaveBeenCalled(); await userEvent.click(screen.getByRole("button", { name: "Agregar comentario" }));
    expect(screen.queryByRole("button", { name: "Deleted subject" })).toBeNull();
    await userEvent.click(await screen.findByRole("button", { name: "Algebra" }));
    await userEvent.click(await screen.findByRole("button", { name: /Cursada 2026/ }));
    await screen.findByRole("button", { name: "Comisión S-31" });
  }
  it("requires explicit subject, course and valid commission selection, then opens the existing form", async () => {
    await chooseUntilCommission();
    expect(screen.queryByRole("button", { name: /Inactive|Deleted|Foreign/ })).toBeNull();
    expect(push).not.toHaveBeenCalled(); expect(obtenerComision).not.toHaveBeenCalled();
    expect(listarMaterias).toHaveBeenCalledWith({ page: 1, pageSize: 9, q: "" });
    expect(listarCursadasPorMateria).toHaveBeenCalledWith("m1", { page: 1, pageSize: 9 });
    expect(listarComisionesPorCursada).toHaveBeenCalledWith("cu1", { page: 1, pageSize: 9 });
    await userEvent.click(screen.getByRole("button", { name: "Comisión S-31" }));
    await waitFor(() => expect(push).toHaveBeenCalledOnce());
    const target = new URL(String(push.mock.calls[0][0]), "http://local");
    expect(target.pathname).toBe("/home/feedback/nuevo"); expect(Object.fromEntries(target.searchParams)).toEqual({ comisionId: "c1", origen: "inicio" });
  });
  it("rechecks a commission before opening the form and rejects a newly inactive or foreign one", async () => {
    await chooseUntilCommission(); vi.mocked(obtenerComision).mockResolvedValue({ ...comision, activa: false });
    await userEvent.click(screen.getByRole("button", { name: "Comisión S-31" })); await screen.findByRole("alert"); expect(push).not.toHaveBeenCalled();
    vi.mocked(obtenerComision).mockResolvedValue({ ...comision, cursada: { ...comision.cursada, materia: { id: "other", nombre: "Other" } } });
    await userEvent.click(screen.getByRole("button", { name: "Comisión S-31" })); await waitFor(() => expect(obtenerComision).toHaveBeenCalledTimes(2)); expect(push).not.toHaveBeenCalled();
  });
  it("paginates and searches subjects without downloading the catalog", async () => {
    vi.mocked(listarMaterias).mockResolvedValueOnce({ items: [materia], total: 10, page: 1, pageSize: 9 }).mockResolvedValueOnce({ items: [{ ...materia, id: "m2", nombre: "Otra materia" }], total: 10, page: 2, pageSize: 9 });
    render(<FeedPrincipal />); await userEvent.click(screen.getByRole("button", { name: "Agregar comentario" })); await screen.findByRole("button", { name: "Algebra" });
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" })); await screen.findByRole("button", { name: "Otra materia" });
    expect(listarMaterias).toHaveBeenLastCalledWith({ page: 2, pageSize: 9, q: "" });
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar materia por nombre" }), "Algebra"); await userEvent.click(screen.getByRole("button", { name: "Buscar materia" }));
    await waitFor(() => expect(listarMaterias).toHaveBeenLastCalledWith({ page: 1, pageSize: 9, q: "Algebra" })); expect(push).not.toHaveBeenCalled();
  });
  it("ignores a late commission check after cancelling selection", async () => {
    await chooseUntilCommission(); let resolve!: (value: typeof comision) => void;
    vi.mocked(obtenerComision).mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
    await userEvent.click(screen.getByRole("button", { name: "Comisión S-31" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar selección" }));
    await act(async () => resolve(comision)); expect(push).not.toHaveBeenCalled(); expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps automatic professor assignment for a single-professor commission", async () => {
    origin.query = "origen=inicio"; vi.mocked(obtenerComision).mockResolvedValue({ ...comision, profesores: [comision.profesores[0]] });
    render(<FeedbackForm comisionId="c1" />); await userEvent.type(await screen.findByRole("textbox", { name: "Tu experiencia" }), "Docente unico");
    await userEvent.click(screen.getByRole("radio", { name: "3 estrellas" })); await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    await waitFor(() => expect(crearFeedback).toHaveBeenCalledExactlyOnceWith("c1", { texto: "Docente unico", anonimo: false, puntuacion: 3 }));
  });
  it("cancels academic selection without navigating or posting", async () => {
    render(<FeedPrincipal />); await userEvent.click(screen.getByRole("button", { name: "Agregar comentario" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancelar selección" }));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(push).not.toHaveBeenCalled(); expect(crearFeedback).not.toHaveBeenCalled();
  });
  it("uses the existing stars, anonymity and professor rules and returns to a new home window", async () => {
    origin.query = "origen=inicio"; render(<FeedbackForm comisionId="c1" />);
    const text = await screen.findByRole("textbox", { name: "Tu experiencia" }); await userEvent.type(text, "Publicada desde Inicio");
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" })); expect(crearFeedback).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("radio", { name: "5 estrellas" })); await userEvent.click(screen.getByRole("radio", { name: /^Grace/ }));
    await userEvent.click(screen.getByRole("radio", { name: /^De forma anónima/ })); await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    await waitFor(() => expect(crearFeedback).toHaveBeenCalledExactlyOnceWith("c1", { texto: "Publicada desde Inicio", anonimo: true, puntuacion: 5, profesorId: "p2" }));
    const target = new URL(String(push.mock.calls[0][0]), "http://local"); expect(target.pathname).toBe("/home"); expect(target.searchParams.get("feedRefresh")).toMatch(/^[0-9a-f-]{36}$/i);
  });
  it("keeps the draft and selections after failure, then cancels back to Inicio", async () => {
    origin.query = "origen=inicio"; vi.mocked(crearFeedback).mockRejectedValueOnce(new Error("Publication failed"));
    render(<FeedbackForm comisionId="c1" />); const text = await screen.findByRole("textbox", { name: "Tu experiencia" });
    await userEvent.type(text, "Borrador pendiente"); await userEvent.click(screen.getByRole("radio", { name: "4 estrellas" }));
    await userEvent.click(screen.getByRole("radio", { name: /^Grace/ })); await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    await screen.findByText("Publication failed"); expect((text as HTMLTextAreaElement).value).toBe("Borrador pendiente"); expect((screen.getByRole("radio", { name: "4 estrellas" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /^Grace/ }) as HTMLInputElement).checked).toBe(true); expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" })); await userEvent.click(screen.getByRole("button", { name: "Descartar y volver" })); expect(push).toHaveBeenCalledExactlyOnceWith("/home");
  });
  it("cancels an untouched Inicio form directly to Inicio", async () => {
    origin.query = "origen=inicio"; render(<FeedbackForm comisionId="c1" />); await screen.findByRole("textbox", { name: "Tu experiencia" });
    expect(screen.getByRole("link", { name: "Volver a Inicio" }).getAttribute("href")).toBe("/home");
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" })); expect(push).toHaveBeenCalledExactlyOnceWith("/home");
  });
  it("starts at the first feed page after publication and deduplicates the server result", async () => {
    const Home = (await import("../src/app/home/page")).default;
    const posted = { ...feedback, texto: "New published item", cantidadLikes: 0, cantidadRespuestas: 0, meGusta: false };
    vi.mocked(listarFeedComentarios).mockResolvedValueOnce({ items: [{ ...posted, id: "old", texto: "Old window" }], nextCursor: "old-cursor", hasMore: true }).mockResolvedValueOnce({ items: [posted, posted], nextCursor: null, hasMore: false });
    const view = render(await Home({ searchParams: Promise.resolve({}) })); await screen.findByText("Old window");
    view.rerender(await Home({ searchParams: Promise.resolve({ feedRefresh: "12345678-1234-4234-8234-123456789012" }) }));
    await screen.findByText("New published item"); expect(screen.queryByText("Old window")).toBeNull(); expect(screen.getAllByText("New published item")).toHaveLength(1);
    expect(vi.mocked(listarFeedComentarios).mock.calls).toEqual([[], []]);
  });
  it("keeps Inicio drafts through a rules version change and returns to a new feed window", async () => {
    origin.query = "origen=inicio";
    const normas = { aceptada: false, reglas: ["Respeto."] };
    const normasError = "Debés aceptar las normas de convivencia vigentes para publicar.";
    const anonymousLabel = /^De forma anónima/;
    vi.mocked(obtenerNormasConvivencia).mockResolvedValueOnce({ ...normas, version: "1" }).mockResolvedValueOnce({ ...normas, version: "2" });
    vi.mocked(crearFeedback).mockRejectedValueOnce(new HttpError(409, normasError));
    render(<FeedbackForm comisionId="c1" />);
    const text = await screen.findByRole("textbox", { name: "Tu experiencia" });
    await userEvent.type(text, "Borrador de Inicio con normas");
    await userEvent.click(screen.getByRole("radio", { name: "5 estrellas" }));
    await userEvent.click(screen.getByRole("radio", { name: /^Grace/ }));
    await userEvent.click(screen.getByRole("radio", { name: anonymousLabel }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Acepto las Normas de convivencia/i }));
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    await screen.findByText(normasError);
    await waitFor(() => expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(false));
    expect((text as HTMLTextAreaElement).value).toBe("Borrador de Inicio con normas");
    expect((screen.getByRole("radio", { name: "5 estrellas" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /^Grace/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: anonymousLabel }) as HTMLInputElement).checked).toBe(true);
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("checkbox", { name: /Acepto las Normas de convivencia/i }));
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    await waitFor(() => expect(push).toHaveBeenCalledOnce());
    expect(crearFeedback).toHaveBeenCalledTimes(2);
    expect(crearFeedback).toHaveBeenNthCalledWith(1, "c1", { texto: "Borrador de Inicio con normas", anonimo: true, puntuacion: 5, profesorId: "p2", versionNormas: "1" });
    expect(crearFeedback).toHaveBeenNthCalledWith(2, "c1", { texto: "Borrador de Inicio con normas", anonimo: true, puntuacion: 5, profesorId: "p2", versionNormas: "2" });
    const target = new URL(String(push.mock.calls[0][0]), "http://local");
    expect(target.pathname).toBe("/home"); expect(target.searchParams.get("feedRefresh")).toMatch(/^[0-9a-f-]{36}$/i);
  });

});
