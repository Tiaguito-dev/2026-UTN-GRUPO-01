// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedPrincipal } from "@/components/feedback/FeedPrincipal";
import { listarFeedComentarios, activarLikeFeedback, retirarLikeFeedback } from "@/services/feedback-feed";
import { obtenerFeedback, ocultarFeedback } from "@/services/feedback";
import { HttpError } from "@/services/http";
import type { FeedbackFeedItem } from "@/types/feedback-feed";
import type { FeedbackOwn } from "@/types/feedback";
import { SeleccionComisionComentario } from "@/components/feedback/SeleccionComisionComentario";
import { listarMaterias } from "@/services/materias";
import { listarCursadasPorMateria, listarComisionesPorCursada, obtenerComision } from "@/services/academic";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => false }));
vi.mock("@/services/feedback-feed", () => ({ listarFeedComentarios: vi.fn(), activarLikeFeedback: vi.fn(), retirarLikeFeedback: vi.fn() }));
vi.mock("@/services/feedback", () => ({ obtenerFeedback: vi.fn(), ocultarFeedback: vi.fn() }));
vi.mock("@/services/materias", () => ({ listarMaterias: vi.fn() }));
vi.mock("@/services/academic", () => ({ listarCursadasPorMateria: vi.fn(), listarComisionesPorCursada: vi.fn(), obtenerComision: vi.fn() }));
vi.mock("@/components/feedback/FeedbackRespuestas", () => ({ FeedbackRespuestas: () => <p>Contenido de respuestas</p> }));

const item = (extra: Partial<FeedbackFeedItem> = {}): FeedbackFeedItem => ({
  id: "own", texto: "Un comentario de prueba", puntuacion: 4, anonimo: true, autor: null, propio: true, profesor: null,
  contexto: { comisionId: "c1", nombre: "S-31", materiaId: "m1", materiaNombre: "Materia", cursadaId: "cu1", anio: 2026, cuatrimestre: null },
  createdAt: "2026-11-01T15:42:00.000Z", updatedAt: "2026-11-01T15:42:00.000Z", cantidadLikes: 2, cantidadRespuestas: 3, meGusta: false, ...extra,
});

describe("Inicio: selección académica por pasos", () => {
  const subject = { id: "m1", nombre: "Algebra", modalidad: "ANUAL" as const, carreras: [], createdAt: "2026-01-01", deletedAt: null, valoracion: { promedio: null, cantidad: 0 } };
  const commission = { id: "c1", cursadaId: "cu1", carrera: "S" as const, numero: 31, nombre: "S-31", activa: true, profesores: [], createdAt: "2026-01-01", deletedAt: null, cursada: { id: "cu1", anio: 2026, cuatrimestre: "ANUAL" as const, materia: { id: "m1", nombre: "Algebra" } } };
  beforeEach(() => {
    vi.mocked(listarMaterias).mockResolvedValue({ items: [subject], total: 1, page: 1, pageSize: 9 });
    vi.mocked(listarCursadasPorMateria).mockResolvedValue({ items: [{ id: "cu1", anio: 2026, cuatrimestre: "ANUAL", comisiones: 1, profesores: 0, carreras: ["S"] }], total: 1, page: 1, pageSize: 9 });
    vi.mocked(listarComisionesPorCursada).mockResolvedValue({ items: [commission], total: 1, page: 1, pageSize: 9 });
    vi.mocked(obtenerComision).mockResolvedValue(commission);
  });
  async function chooseSubjectAndCourse() {
    await userEvent.click(await screen.findByRole("radio", { name: "Algebra" }));
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await userEvent.click(await screen.findByRole("radio", { name: /Cursada 2026/ }));
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("radio", { name: "Comisión S-31" });
  }
  it("conserva Anterior deshabilitado al comenzar y permite cancelar desde cualquier paso", async () => {
    const onCancel = vi.fn();
    render(<SeleccionComisionComentario onCancel={onCancel} />);
    const results = screen.getByRole("region", { name: "Opciones del paso actual" });
    expect(results.getAttribute("tabindex")).toBe("0");
    expect(results.contains(screen.getByRole("button", { name: "Siguiente" }))).toBe(false);
    results.focus();
    expect(document.activeElement).toBe(results);
    expect(screen.getByRole("button", { name: "Anterior" })).toHaveProperty("disabled", true);
    await chooseSubjectAndCourse();
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(await screen.findByRole("radio", { name: /Cursada 2026/ })).toHaveProperty("checked", true);
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(await screen.findByRole("radio", { name: "Algebra" })).toHaveProperty("checked", true);
    expect(screen.getByRole("button", { name: "Anterior" })).toHaveProperty("disabled", true);
    await userEvent.click(screen.getByRole("button", { name: "Cancelar selección" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(push).not.toHaveBeenCalled();
  });
  it("cancelar el modal restaura el foco al botón que lo abrió", async () => {
    render(<FeedPrincipal />);
    const trigger = screen.getByRole("button", { name: "Agregar comentario" });
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Agregar comentario" });
    await within(dialog).findByRole("radio", { name: "Algebra" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar selección" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(push).not.toHaveBeenCalled();
  });
  it("requiere seleccionar cada nivel y conserva la navegación al formulario existente", async () => {
    render(<SeleccionComisionComentario onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Siguiente" }).hasAttribute("disabled")).toBe(true);
    await chooseSubjectAndCourse();
    expect(screen.getByRole("button", { name: "Siguiente" }).hasAttribute("disabled")).toBe(true);
    expect(obtenerComision).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("radio", { name: "Comisión S-31" }));
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(push).toHaveBeenCalledExactlyOnceWith("/home/feedback/nuevo?comisionId=c1&origen=inicio"));
    expect(listarMaterias).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 9, q: "" });
    expect(listarCursadasPorMateria).toHaveBeenCalledExactlyOnceWith("m1", { page: 1, pageSize: 9 });
    expect(listarComisionesPorCursada).toHaveBeenCalledExactlyOnceWith("cu1", { page: 1, pageSize: 9 });
  });
  it("selecciona comisión dentro del modal de Inicio y abre la publicación", async () => {
    render(<FeedPrincipal />);
    await userEvent.click(screen.getByRole("button", { name: "Agregar comentario" }));
    expect(screen.getByRole("dialog", { name: "Agregar comentario" })).toBeTruthy();
    await chooseSubjectAndCourse();
    await userEvent.click(screen.getByText("Comisión S-31"));
    expect(screen.getByRole("radio", { name: "Comisión S-31" })).toHaveProperty("checked", true);
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(push).toHaveBeenCalledExactlyOnceWith("/home/feedback/nuevo?comisionId=c1&origen=inicio"));
  });
  it("volver a Materia y cambiarla invalida cursada y comisión seleccionadas", async () => {
    render(<SeleccionComisionComentario onCancel={vi.fn()} />);
    await chooseSubjectAndCourse();
    await userEvent.click(screen.getByRole("radio", { name: "Comisión S-31" }));
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    await screen.findByRole("radio", { name: /Cursada 2026/ });
    await userEvent.click(screen.getByRole("button", { name: "Anterior" }));
    const second = { ...subject, id: "m2", nombre: "Otra materia" };
    vi.mocked(listarMaterias).mockResolvedValue({ items: [second], total: 1, page: 1, pageSize: 9 });
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar materia por nombre" }), "Otra");
    await userEvent.click(screen.getByRole("button", { name: "Buscar materia" }));
    await userEvent.click(await screen.findByRole("radio", { name: "Otra materia" }));
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await screen.findByRole("radio", { name: /Cursada 2026/ });
    expect(screen.getByRole("button", { name: "Siguiente" }).hasAttribute("disabled")).toBe(true);
    expect(listarCursadasPorMateria).toHaveBeenLastCalledWith("m2", { page: 1, pageSize: 9 });
    expect(push).not.toHaveBeenCalled();
  });
  it("muestra el equipo docente en la tarjeta y permite seleccionarla por nombre y teclado", async () => {
    vi.mocked(listarComisionesPorCursada).mockResolvedValue({ items: [{ ...commission, profesores: [{ id: "p1", nombreCompleto: "Ada Lovelace", cargo: "TITULAR" }] }], total: 1, page: 1, pageSize: 9 });
    render(<SeleccionComisionComentario onCancel={vi.fn()} />);
    await chooseSubjectAndCourse();
    expect(screen.getByText("Equipo docente")).toBeTruthy();
    expect(screen.getByText(/Ada Lovelace.*Titular/)).toBeTruthy();
    const radio = screen.getByRole("radio", { name: "Comisión S-31" });
    radio.focus();
    await userEvent.keyboard(" ");
    expect(radio).toHaveProperty("checked", true);
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/home/feedback/nuevo?comisionId=c1&origen=inicio"));
  });
  it("explica cuando no hay docentes y permite seleccionar la tarjeta completa", async () => {
    render(<SeleccionComisionComentario onCancel={vi.fn()} />);
    await chooseSubjectAndCourse();
    await userEvent.click(screen.getByText("Sin docentes asignados"));
    expect(screen.getByRole("radio", { name: "Comisión S-31" })).toHaveProperty("checked", true);
    expect(screen.getByRole("button", { name: "Siguiente" })).toHaveProperty("disabled", false);
  });
  it("revalida una comisión que se desactivó y conserva selección y aviso seguro", async () => {
    vi.mocked(obtenerComision).mockResolvedValue({ ...commission, activa: false });
    render(<SeleccionComisionComentario onCancel={vi.fn()} />);
    await chooseSubjectAndCourse();
    await userEvent.click(screen.getByRole("radio", { name: "Comisión S-31" }));
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("ya no está disponible"));
    expect(screen.getByRole("radio", { name: "Comisión S-31" })).toHaveProperty("checked", true);
    expect(push).not.toHaveBeenCalled();
  });
  it("el buscador conserva búsqueda y paginación de nueve sin revelar errores JSON", async () => {
    vi.mocked(listarMaterias).mockResolvedValueOnce({ items: [subject], total: 10, page: 1, pageSize: 9 }).mockResolvedValueOnce({ items: [{ ...subject, id: "m2", nombre: "Otra materia" }], total: 10, page: 2, pageSize: 9 });
    render(<SeleccionComisionComentario onCancel={vi.fn()} />);
    await screen.findByRole("radio", { name: "Algebra" });
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    await screen.findByRole("radio", { name: "Otra materia" });
    expect(listarMaterias).toHaveBeenLastCalledWith({ page: 2, pageSize: 9, q: "" });
    vi.mocked(listarMaterias).mockRejectedValueOnce(new HttpError(500, '{"token":"PRIVATE_TOKEN","stack":"PrismaError"}'));
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar materia por nombre" }), "Algebra");
    await userEvent.click(screen.getByRole("button", { name: "Buscar materia" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toMatch(/PRIVATE_TOKEN|PrismaError|token|stack|[{}]/);
    expect(listarMaterias).toHaveBeenLastCalledWith({ page: 1, pageSize: 9, q: "Algebra" });
  });
});
const own = (extra: Partial<FeedbackOwn> = {}): FeedbackOwn => ({
  ...item(), estadoModeracion: "APROBADO", versionModeracion: 7, requiereRevisionHumana: false, motivoRechazo: null,
  ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false, ...extra,
});
const feed = (items: FeedbackFeedItem[]) => ({ items, nextCursor: null, hasMore: false });
const confirmHide = () => within(screen.getByRole("dialog")).getByRole("button", { name: /^(Confirmar|Confirmar ocultamiento|Ocultar experiencia)$/ });

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("IntersectionObserver", undefined);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
  vi.mocked(listarFeedComentarios).mockResolvedValue(feed([item()]));
  vi.mocked(obtenerFeedback).mockResolvedValue(own());
  vi.mocked(ocultarFeedback).mockResolvedValue({ ...own(), ocultoAutor: true, versionModeracion: 8 });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Inicio: presentación y ocultamiento directo", () => {
  it("agrupa las acciones del encabezado con Actualizar antes de Agregar comentario", async () => {
    render(<FeedPrincipal />);
    await screen.findByText("Un comentario de prueba");
    const refresh = screen.getByRole("button", { name: /Actualizar/ });
    const add = screen.getByRole("button", { name: "Agregar comentario" });
    expect(refresh.parentElement).toBe(add.parentElement);
    expect(refresh.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refresh.querySelector("svg")).toBeTruthy();
    expect(add.querySelector("svg")).toBeTruthy();
  });

  it("contiene contadores, respuestas y enlace a comisión dentro de la tarjeta", async () => {
    render(<FeedPrincipal />);
    const article = await screen.findByRole("article");
    const footer = article.querySelector("footer")!;
    expect(footer).toBeTruthy();
    expect(within(footer).getByText("2 Me gusta")).toBeTruthy();
    expect(within(footer).getByRole("button", { name: "Ver respuestas (3)" })).toBeTruthy();
    expect(within(footer).getByRole("link", { name: /Ver comisión/ }).getAttribute("href")).toContain("c1");
    expect(article.querySelector("button button, a button, button a")).toBeNull();
  });

  it("conserva likes, estado activo y apertura de respuestas para un comentario ajeno", async () => {
    vi.mocked(listarFeedComentarios).mockResolvedValue(feed([item({ propio: false })]));
    vi.mocked(activarLikeFeedback).mockResolvedValue({ meGusta: true, cantidadLikes: 3 });
    vi.mocked(retirarLikeFeedback).mockResolvedValue({ meGusta: false, cantidadLikes: 2 });
    render(<FeedPrincipal />);
    await userEvent.click(await screen.findByRole("button", { name: "Dar Me gusta" }));
    expect(activarLikeFeedback).toHaveBeenCalledExactlyOnceWith("own");
    const active = await screen.findByRole("button", { name: "Quitar Me gusta" });
    expect(active.getAttribute("aria-pressed")).toBe("true");
    await userEvent.click(active);
    expect(retirarLikeFeedback).toHaveBeenCalledExactlyOnceWith("own");
    await userEvent.click(screen.getByRole("button", { name: "Ver respuestas (3)" }));
    expect(await screen.findByText("Contenido de respuestas")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ocultar respuestas (3)" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.queryByRole("button", { name: "Ocultar experiencia" })).toBeNull();
  });

  it("consulta el contrato privado al abrir y solo oculta después de confirmar con la versión vigente", async () => {
    render(<FeedPrincipal />);
    await userEvent.click(await screen.findByRole("button", { name: "Ocultar experiencia" }));
    await waitFor(() => expect(obtenerFeedback).toHaveBeenCalledExactlyOnceWith("own"));
    expect(ocultarFeedback).not.toHaveBeenCalled();
    vi.mocked(listarFeedComentarios).mockResolvedValue(feed([]));
    await waitFor(() => expect(confirmHide().hasAttribute("disabled")).toBe(false));
    await userEvent.click(confirmHide());
    await waitFor(() => expect(ocultarFeedback).toHaveBeenCalledExactlyOnceWith("own", 7));
    await waitFor(() => expect(screen.queryByText("Un comentario de prueba")).toBeNull());
    expect(await screen.findByText(/ocultó correctamente/)).toBeTruthy();
    expect(listarFeedComentarios).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Mostrar experiencia" })).toBeNull();
  });

  it("cancelar la confirmación conserva el comentario y no envía ninguna mutación", async () => {
    render(<FeedPrincipal />);
    await userEvent.click(await screen.findByRole("button", { name: "Ocultar experiencia" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    expect(ocultarFeedback).not.toHaveBeenCalled();
    expect(screen.getByText("Un comentario de prueba")).toBeTruthy();
  });

  it.each([
    { propio: false }, { estadoModeracion: "PENDIENTE" as const }, { estadoModeracion: "RECHAZADO" as const },
    { ocultoAutor: true }, { ocultoAdministracion: true }, { ocultoReportes: true },
  ])("una comprobación privada no elegible impide ocultar: %o", async extra => {
    vi.mocked(obtenerFeedback).mockResolvedValue(own(extra));
    render(<FeedPrincipal />);
    await userEvent.click(await screen.findByRole("button", { name: "Ocultar experiencia" }));
    await waitFor(() => expect(obtenerFeedback).toHaveBeenCalledOnce());
    await waitFor(() => {
      const dialog = screen.queryByRole("dialog");
      const button = dialog ? within(dialog).queryByRole("button", { name: /^(Confirmar|Confirmar ocultamiento|Ocultar experiencia)$/ }) : null;
      expect(!button || button.hasAttribute("disabled")).toBe(true);
    });
    expect(ocultarFeedback).not.toHaveBeenCalled();
  });

  it("un conflicto 409 actualiza el feed y exige revisar los datos antes de reintentar", async () => {
    vi.mocked(ocultarFeedback).mockRejectedValue(new HttpError(409, '{"token":"PRIVATE_TOKEN","stack":"PrismaError"}'));
    render(<FeedPrincipal />);
    await userEvent.click(await screen.findByRole("button", { name: "Ocultar experiencia" }));
    await waitFor(() => expect(confirmHide().hasAttribute("disabled")).toBe(false));
    await userEvent.click(confirmHide());
    expect(await screen.findByText(/La información cambió o la acción ya fue realizada/)).toBeTruthy();
    await waitFor(() => expect(listarFeedComentarios).toHaveBeenCalledTimes(2));
    expect(ocultarFeedback).toHaveBeenCalledOnce();
    expect(document.body.textContent).not.toMatch(/PRIVATE_TOKEN|PrismaError|[{}]/);
  });

  it.each([401, 403, 404, 422, 500])("el error HTTP %s muestra un mensaje seguro sin JSON", async status => {
    vi.mocked(obtenerFeedback).mockRejectedValue(new HttpError(status, '{"email":"private@example.test","session":"PRIVATE_SESSION","stack":"PrismaError"}'));
    render(<FeedPrincipal />);
    await userEvent.click(await screen.findByRole("button", { name: "Ocultar experiencia" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/nuevamente|Volvé|Revisá|Iniciá/);
    expect(document.body.textContent).not.toMatch(/private@example|PRIVATE_SESSION|PrismaError|[{}]/);
    expect(ocultarFeedback).not.toHaveBeenCalled();
  });

  it("bloquea doble envío mientras se procesa el ocultamiento", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof ocultarFeedback>>) => void;
    vi.mocked(ocultarFeedback).mockReturnValue(new Promise(done => { resolve = done; }));
    render(<FeedPrincipal />);
    await userEvent.click(await screen.findByRole("button", { name: "Ocultar experiencia" }));
    await waitFor(() => expect(confirmHide().hasAttribute("disabled")).toBe(false));
    const button = confirmHide();
    fireEvent.click(button); fireEvent.click(button);
    expect(ocultarFeedback).toHaveBeenCalledOnce();
    expect(button.hasAttribute("disabled")).toBe(true);
    vi.mocked(listarFeedComentarios).mockResolvedValue(feed([]));
    await act(async () => resolve({ ...own(), ocultoAutor: true, versionModeracion: 8 }));
  });
});
