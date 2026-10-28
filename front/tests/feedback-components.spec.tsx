// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  contexto: { carrera: "S", comisionId: "c1", nombre: "S-31", materiaId: "m1", materiaNombre: "Álgebra", cursadaId: "cu1", anio: 2026, cuatrimestre: "PRIMERO" },
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
    expect((target as HTMLSelectElement).value).toBe("");
    await userEvent.selectOptions(target, "p3");
    await userEvent.type(screen.getByRole("textbox", { name: "Tu experiencia" }), "Clases claras");
    await userEvent.click(screen.getByRole("button", { name: "Publicar comentario" }));
    expect(crearFeedback).toHaveBeenCalledWith("c1", { texto: "Clases claras", anonimo: false, profesorId: "p3" });
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
    const row = { id: "h1", accion: "CREACION" as const, texto: "Versión original real", anonimo: true, createdAt: feedback.createdAt };
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
