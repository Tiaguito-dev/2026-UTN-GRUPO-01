// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackModerationStatus } from "@/components/feedback/FeedbackModerationStatus";
import { ReportFeedbackAction } from "@/components/feedback/ReportFeedbackAction";
import { FeedbackDetail } from "@/components/feedback/FeedbackDetail";
import { MisExperiencias } from "@/components/feedback/MisExperiencias";
import { crearReporteFeedback } from "@/services/feedback-reportes";
import { obtenerFeedback, ocultarFeedback, restaurarFeedback, listarFeedbackPropios } from "@/services/feedback";
import { HttpError } from "@/services/http";
import type { FeedbackOwn } from "@/types/feedback";
const { setPage } = vi.hoisted(() => ({ setPage: vi.fn() }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/useUrlPagination", () => ({ useUrlPagination: () => ({ page: 2, setPage }) }));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => false }));
vi.mock("@/services/feedback-reportes", () => ({ crearReporteFeedback: vi.fn() }));
vi.mock("@/services/academic", () => ({ obtenerComision: vi.fn().mockResolvedValue({ activa: true }) }));
vi.mock("@/services/feedback", () => ({ obtenerFeedback: vi.fn(), ocultarFeedback: vi.fn(), restaurarFeedback: vi.fn(), solicitarRevisionFeedback: vi.fn(), eliminarFeedback: vi.fn(), listarHistorialFeedback: vi.fn(), listarFeedbackPropios: vi.fn() }));
const item: FeedbackOwn = { id: "f1", texto: "Texto propio", anonimo: true, autor: null, propio: true, puntuacion: 4, profesor: null, contexto: { comisionId: "c1", nombre: "S-1", materiaId: "m1", materiaNombre: "Materia", cursadaId: "cu1", anio: 2026, cuatrimestre: null }, createdAt: "2026-11-17", updatedAt: "2026-11-17", estadoModeracion: "APROBADO", versionModeracion: 7, requiereRevisionHumana: false, motivoRechazo: null, ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false };
beforeEach(() => { vi.clearAllMocks(); HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); }; vi.mocked(obtenerFeedback).mockResolvedValue(item); vi.mocked(listarFeedbackPropios).mockResolvedValue({ items: [item], page: 2, pageSize: 9, total: 10 }); });
afterEach(cleanup);
describe("T6 estados y experiencias propias", () => {
  it("el error de carga propio no muestra JSON ni secretos del servidor", async () => {
    vi.mocked(obtenerFeedback).mockRejectedValueOnce(new HttpError(500, '{"token":"PRIVATE_TOKEN","email":"secreto@example.test","stack":"PrismaError"}'));
    render(<FeedbackDetail feedbackId="f1" />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("No pudimos");
    expect(alert.textContent).not.toMatch(/PRIVATE_TOKEN|secreto@|PrismaError|token|email|stack|[{}]/);
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeTruthy();
  });
  it("no afirma publicación con tres causas simultáneas", () => { render(<FeedbackModerationStatus feedback={{ ...item, ocultoAutor: true, ocultoAdministracion: true, ocultoReportes: true }} />); expect(screen.queryByText("Publicada")).toBeNull(); // Cambio visual: badges asociados a la tarjeta conservan todas las causas.
    expect(screen.getByText("Oculta voluntariamente")).toBeTruthy(); expect(screen.getByText("Oculta por administración")).toBeTruthy(); expect(screen.getByText("Oculta por reportes")).toBeTruthy(); });
  it("el motivo comunicado de rechazo omite respuestas estructuradas y conserva acciones comprensibles", () => {
    const view = render(<FeedbackModerationStatus feedback={{ ...item, estadoModeracion: "RECHAZADO", motivoRechazo: '{"email":"secreto@example.test","token":"PRIVATE_TOKEN","stack":"RepositoryError"}' }} />);
    expect(view.container.textContent).toContain("Rechazada");
    expect(view.container.textContent).toContain("solicitar una nueva revisión");
    expect(view.container.textContent).not.toMatch(/secreto@|PRIVATE_TOKEN|RepositoryError|email|token|stack|[{}]/);
  });
  it.each(["PENDIENTE", "RECHAZADO"] as const)("estado %s nunca se presenta publicado", estadoModeracion => { render(<FeedbackModerationStatus feedback={{ ...item, estadoModeracion, motivoRechazo: "Corregí el texto" }} />); expect(screen.queryByText("Publicada")).toBeNull(); expect(screen.getByText(estadoModeracion === "PENDIENTE" ? /Tu comentario está pendiente/ : /Corregí el texto/)).toBeTruthy(); });
  it("propias solicita página nueve y conserva origen en enlace sin reportar", async () => { render(<MisExperiencias />); await screen.findByText("Texto propio"); expect(listarFeedbackPropios).toHaveBeenCalledWith({ page: 2, pageSize: 9 }); expect(screen.queryByRole("button", { name: "Reportar" })).toBeNull(); const href = screen.getByRole("link", { name: "Ver mi experiencia" }).getAttribute("href"); expect(href).toContain("experienciasSeccion=propias"); expect(href).toContain("experienciasPage=2"); await userEvent.click(screen.getByRole("button", { name: "Página anterior" })); expect(setPage).toHaveBeenCalledWith(1); });
  it("ocultar exige confirmación y versión; restaura datos después del éxito", async () => { vi.mocked(ocultarFeedback).mockResolvedValue({ ...item, ocultoAutor: true, versionModeracion: 8 }); render(<FeedbackDetail feedbackId="f1" />); await userEvent.click(await screen.findByRole("button", { name: "Ocultar comentario" })); expect(ocultarFeedback).not.toHaveBeenCalled(); vi.mocked(obtenerFeedback).mockResolvedValue({ ...item, ocultoAutor: true, versionModeracion: 8 }); await userEvent.click(screen.getByRole("button", { name: "Confirmar" })); await screen.findByRole("button", { name: "Mostrar experiencia" }); expect(ocultarFeedback).toHaveBeenCalledExactlyOnceWith("f1", 7); });
  it("restaurar solo causa propia informa restricciones restantes", async () => { vi.mocked(obtenerFeedback).mockResolvedValue({ ...item, ocultoAutor: true, ocultoAdministracion: true, ocultoReportes: true }); vi.mocked(restaurarFeedback).mockResolvedValue({ ...item, ocultoAdministracion: true, ocultoReportes: true }); render(<FeedbackDetail feedbackId="f1" />); await userEvent.click(await screen.findByRole("button", { name: "Quitar mi ocultamiento voluntario" })); expect(screen.queryByRole("button", { name: "Mostrar experiencia" })).toBeNull(); await userEvent.click(screen.getByRole("button", { name: "Confirmar" })); expect(await screen.findByText(/permanece oculta por las otras restricciones/)).toBeTruthy(); expect(restaurarFeedback).toHaveBeenCalledExactlyOnceWith("f1", 7); });
  it("409 recarga versión y cierra confirmación sin repetir la mutación", async () => { vi.mocked(ocultarFeedback).mockRejectedValue(new HttpError(409, "Versión obsoleta")); render(<FeedbackDetail feedbackId="f1" />); await userEvent.click(await screen.findByRole("button", { name: "Ocultar comentario" })); await userEvent.click(screen.getByRole("button", { name: "Confirmar" })); await screen.findByText(/La información cambió o la acción ya fue realizada/); await waitFor(() => expect(obtenerFeedback).toHaveBeenCalledTimes(2)); expect(ocultarFeedback).toHaveBeenCalledTimes(1); expect(screen.queryByRole("dialog")).toBeNull(); });
});
describe("Experiencias: presentación de moderación y acciones", () => {
  it("no agrega estados a la proyección pública sin metadatos privados", () => {
    const publicItem = { ...item, estadoModeracion: undefined };
    const view = render(<FeedbackModerationStatus feedback={publicItem} />);
    expect(view.container.textContent).toBe("");
  });
  it.each([
    [{}, "Publicada"],
    [{ estadoModeracion: "PENDIENTE" }, "Pendiente de revisión"],
    [{ estadoModeracion: "RECHAZADO", motivoRechazo: "Corregí el lenguaje ofensivo" }, "Rechazada"],
    [{ ocultoAutor: true }, "Oculta voluntariamente"],
    [{ ocultoAdministracion: true }, "Oculta por administración"],
    [{ ocultoReportes: true }, "Oculta por reportes"],
  ] as const)("expresa el estado %s con etiqueta legible", (extra, label) => {
    render(<FeedbackModerationStatus feedback={{ ...item, ...extra }} variant="compact" />);
    expect(screen.getByText(label)).toBeTruthy();
    if (label !== "Publicada") expect(screen.queryByText("Publicada")).toBeNull();
    if (label === "Rechazada") expect(screen.getByText(/Corregí el lenguaje ofensivo/)).toBeTruthy();
  });
  it.each(Array.from({ length: 8 }, (_, mask) => mask))("conserva cada causa independiente para la combinacion %s", mask => {
    const extra = { ocultoAutor: Boolean(mask & 1), ocultoAdministracion: Boolean(mask & 2), ocultoReportes: Boolean(mask & 4) };
    render(<FeedbackModerationStatus feedback={{ ...item, ...extra }} variant="compact" />);
    const group = screen.getByRole("group", { name: "Estado de tu experiencia" });
    const labels = ["Oculta voluntariamente", "Oculta por administraci\u00f3n", "Oculta por reportes"];
    labels.forEach((label, index) => expect(within(group).queryByText(label) !== null).toBe(Boolean(mask & (1 << index))));
    expect(within(group).queryByText("Publicada") !== null).toBe(mask === 0);
    expect(group.querySelectorAll('svg:not([aria-hidden="true"])')).toHaveLength(0);
  });
  it("el listado integra estado, aclaración y enlace dentro de cada tarjeta propia", async () => {
    vi.mocked(listarFeedbackPropios).mockResolvedValue({ items: [{ ...item, ocultoReportes: true }], page: 2, pageSize: 9, total: 10 });
    render(<MisExperiencias />);
    const card = await screen.findByRole("article", { name: "Comentario de Anónimo" });
    // TASK-selector-visibilidad-ui: el listado propio explicita el carácter preventivo.
    expect(within(card).getByText("Oculta preventivamente por reportes")).toBeTruthy();
    expect(within(card).getByText("Pendiente de revisión administrativa")).toBeTruthy();
    expect(within(card).getByText(/Tu experiencia está oculta temporalmente para la comunidad porque recibió reportes/)).toBeTruthy();
    expect(card.textContent).toMatch(/seguir consultando/);
    expect(within(card).getByRole("link", { name: "Ver mi experiencia" }).getAttribute("href")).toBe("/home/feedback/f1?origen=experiencias&experienciasSeccion=propias&experienciasPage=2");
    expect(card.textContent).not.toMatch(/denunciantes|reportantes/);
  });
  it("el detalle coloca el aviso preventivo antes del contenido y conserva acciones e historial", async () => {
    vi.mocked(obtenerFeedback).mockResolvedValue({ ...item, ocultoReportes: true });
    render(<FeedbackDetail feedbackId="f1" />);
    const heading = await screen.findByText("Tu comentario está pendiente de revisión");
    const content = screen.getByText("Texto propio");
    expect(heading.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText(/Recibimos reportes sobre esta experiencia y fue retirada temporalmente de la vista pública/)).toBeTruthy();
    expect(screen.getByText(/El comentario no fue rechazado/)).toBeTruthy();
    expect(await screen.findByRole("link", { name: "Editar comentario" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Eliminar comentario" })).toBeTruthy();
    expect(screen.getByText("Historial de cambios")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mostrar experiencia" })).toBeNull();
  });
  it("un rechazo simultáneo con reportes conserva motivo y no afirma ausencia de rechazo", () => {
    render(<FeedbackModerationStatus feedback={{ ...item, estadoModeracion: "RECHAZADO", motivoRechazo: "Revisá las expresiones", ocultoReportes: true }} />);
    expect(screen.getByText("Rechazada")).toBeTruthy();
    expect(screen.getByText(/Revisá las expresiones/)).toBeTruthy();
    expect(screen.getByText("Oculta por reportes")).toBeTruthy();
    expect(screen.queryByText(/El comentario no fue rechazado/)).toBeNull();
    expect(screen.queryByText("Publicada")).toBeNull();
  });
  it("ocultar bajo reportes agrega solo la causa voluntaria mediante la operación existente", async () => {
    vi.mocked(obtenerFeedback).mockResolvedValue({ ...item, ocultoReportes: true });
    vi.mocked(ocultarFeedback).mockResolvedValue({ ...item, ocultoReportes: true, ocultoAutor: true, versionModeracion: 8 });
    render(<FeedbackDetail feedbackId="f1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Ocultar comentario" }));
    expect(ocultarFeedback).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog").textContent).toMatch(/voluntari|decisión propia/);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(ocultarFeedback).toHaveBeenCalledExactlyOnceWith("f1", 7));
    expect(restaurarFeedback).not.toHaveBeenCalled();
  });
});
describe("T6 formulario de reporte", () => {
  async function open() { render(<ReportFeedbackAction feedbackId="f1" />); await userEvent.click(screen.getByRole("button", { name: "Reportar" })); }
  it("exige motivo y presenta seis motivos sin identidad ajena", async () => { await open(); await userEvent.click(screen.getByRole("button", { name: "Enviar reporte" })); expect(await screen.findByText("Elegí un motivo para reportar.")).toBeTruthy(); expect(crearReporteFeedback).not.toHaveBeenCalled(); expect(screen.getAllByRole("option")).toHaveLength(7); });
  it("conserva borrador ante 429 y permite reintentar sin doble envío", async () => { vi.mocked(crearReporteFeedback).mockRejectedValueOnce(new HttpError(429, "Límite")); await open(); await userEvent.selectOptions(screen.getByLabelText("Motivo obligatorio"), "OTRO"); await userEvent.type(screen.getByLabelText("Descripción opcional"), "Contexto"); await userEvent.click(screen.getByRole("button", { name: "Enviar reporte" })); await screen.findByText(/Esperá diez minutos/); expect((screen.getByLabelText("Descripción opcional") as HTMLTextAreaElement).value).toBe("Contexto"); let resolve!: (value: Awaited<ReturnType<typeof crearReporteFeedback>>) => void; vi.mocked(crearReporteFeedback).mockReturnValueOnce(new Promise(yes => { resolve = yes; })); const send = screen.getByRole("button", { name: "Enviar reporte" }); fireEvent.click(send); fireEvent.click(send); expect(crearReporteFeedback).toHaveBeenCalledTimes(2); await act(async () => resolve({ id: "r1", feedbackId: "f1", versionReportada: 7, motivo: "OTRO", descripcion: "Contexto", estado: "ABIERTO", createdAt: "2026-11-17", resolvedAt: null })); expect(await screen.findByText(/El reporte se envió correctamente/)).toBeTruthy(); });
  it.each([401, 403, 404, 409, 422, 500])("error %s conserva el formulario y muestra un llamado a acción sin JSON ni secretos", async status => {
    vi.mocked(crearReporteFeedback).mockRejectedValueOnce(new HttpError(status, '{"session":"PRIVATE_SESSION","email":"secreto@example.test","stack":"RepositoryError"}'));
    await open(); await userEvent.selectOptions(screen.getByLabelText("Motivo obligatorio"), "SPAM");
    await userEvent.type(screen.getByLabelText("Descripción opcional"), "Contexto conservado");
    await userEvent.click(screen.getByRole("button", { name: "Enviar reporte" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).not.toMatch(/PRIVATE_SESSION|secreto@|RepositoryError|session|email|stack|[{}]/);
    expect(alert.textContent).toMatch(/nuevamente|Volvé|Revisá|Iniciá/);
    expect(screen.getByLabelText("Motivo obligatorio")).toBeTruthy();
    expect((screen.getByLabelText("Descripción opcional") as HTMLTextAreaElement).value).toBe("Contexto conservado");
  });
});
