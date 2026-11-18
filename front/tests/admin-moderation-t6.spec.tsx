// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminModerationActions, AdminModerationStatus } from "@/components/admin/AdminModerationActions";
import { AdminReporteDetail } from "@/components/admin/AdminReporteDetail";
import { AdminExperiencias } from "@/components/admin/AdminExperiencias";
import { UserAudit } from "@/components/admin/UserAudit";
import { listarFeedbackModeracion, moderarFeedback } from "@/services/feedback";
import { listarReportesFeedback, obtenerReporteFeedback, resolverReporteFeedback } from "@/services/feedback-reportes";
import { HttpError } from "@/services/http";
import type { ReporteDetail } from "@/types/feedback-reportes";
import type { AdminRecord } from "@/services/admin-detail";

vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/hooks/useIsAdmin", () => ({ useIsAdmin: () => true }));
const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query), usePathname: () => "/home/admin/experiencias", useRouter: () => ({ replace: navigation.replace }) }));
vi.mock("@/services/feedback", () => ({ moderarFeedback: vi.fn(), listarFeedbackModeracion: vi.fn() }));
vi.mock("@/services/feedback-reportes", () => ({ obtenerReporteFeedback: vi.fn(), resolverReporteFeedback: vi.fn(), listarReportesFeedback: vi.fn() }));
const state = { estadoModeracion: "APROBADO", versionModeracion: 7, requiereRevisionHumana: false, motivoRechazo: null, ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: false };
const date = "2026-11-17T12:00:00.000Z";
function report(): ReporteDetail {
  return {
    cantidadReportesActivos: 3, denunciantesAbiertos: 3, ultimoReporteAt: date,
    reporte: { id: "r1", feedbackId: "f1", versionReportada: 2, motivo: "DATOS_PERSONALES", descripcion: "Detalle reservado del reporte", estado: "ABIERTO", createdAt: date, resolvedAt: null, denuncianteId: "u2", historialId: "h1", administradorId: null, justificacion: null, denunciante: { id: "u2", displayName: "Persona denunciante" } },
    experiencia: { ...state, estadoModeracion: "APROBADO", id: "f1", deletedAt: null, ocultoReportes: true, contexto: { carrera: "S", comisionId: "c1", nombre: "K101", materiaId: "m1", materiaNombre: "Álgebra", cursadaId: "cu1", anio: 2026, cuatrimestre: "PRIMERO", modalidad: "PRIMERO" } },
    evidencia: { id: "h1", texto: "Contenido exacto denunciado", puntuacion: 3, anonimo: true, versionModeracion: 2, createdAt: date },
    resolucionesAnteriores: { items: [], total: 0, page: 1, pageSize: 3 },
  };
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
beforeEach(() => { vi.resetAllMocks(); navigation.query = ""; vi.mocked(obtenerReporteFeedback).mockResolvedValue(report()); });
afterEach(cleanup);

describe("T6 decisiones administrativas", () => {
  it("envía versión y justificación solo al confirmar y devuelve foco al cancelar", async () => {
    const refresh = vi.fn();
    render(<AdminModerationActions id="f1" record={{ ...state }} onRefresh={refresh} />);
    const open = screen.getByRole("button", { name: "Rechazar experiencia" });
    await userEvent.click(open);
    expect(moderarFeedback).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(document.activeElement).toBe(open);
    await userEvent.click(open);
    await userEvent.type(screen.getByLabelText("Justificación obligatoria"), "Corregir información personal");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar decisión" }));
    expect(moderarFeedback).toHaveBeenCalledExactlyOnceWith("f1", { accion: "RECHAZO", versionEsperada: 7, motivo: "Corregir información personal" });
    expect(refresh).toHaveBeenCalled();
  });

  it("previene motivo vacío y controles y conserva el texto ante errores", async () => {
    render(<AdminModerationActions id="f1" record={{ ...state }} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Rechazar experiencia" }));
    const form = screen.getByRole("dialog").querySelector("form")!;
    fireEvent.submit(form);
    await screen.findByText("Escribí una justificación para continuar.");
    const reason = screen.getByLabelText("Justificación obligatoria");
    fireEvent.change(reason, { target: { value: "motivo\ncon salto" } }); fireEvent.submit(form);
    await screen.findByText(/contiene caracteres no permitidos/);
    expect(moderarFeedback).not.toHaveBeenCalled();
    fireEvent.change(reason, { target: { value: "Motivo válido" } });
    vi.mocked(moderarFeedback).mockRejectedValue(new HttpError(422, "Revise la decisión")); fireEvent.submit(form);
    await screen.findByText(/No pudimos procesar los datos/);
    expect(screen.queryByText("Revise la decisión")).toBeNull();
    expect((reason as HTMLTextAreaElement).value).toBe("Motivo válido");
  });

  it("solicita datos actuales ante versión obsoleta", async () => {
    const refresh = vi.fn(); vi.mocked(moderarFeedback).mockRejectedValue(new HttpError(409, "Versión desactualizada"));
    render(<AdminModerationActions id="f1" record={{ ...state }} onRefresh={refresh} />);
    await userEvent.click(screen.getByRole("button", { name: "Rechazar experiencia" }));
    await userEvent.type(screen.getByLabelText("Justificación obligatoria"), "Justificación");
    await userEvent.click(screen.getByRole("button", { name: "Confirmar decisión" }));
    await screen.findByText(/La información cambió o la acción ya fue realizada/); expect(refresh).toHaveBeenCalledWith(true);
  });

  it("evita doble envío mientras procesa", async () => {
    let complete!: () => void;
    vi.mocked(moderarFeedback).mockImplementation(() => new Promise(resolve => { complete = () => resolve({ ...state, estadoModeracion: "RECHAZADO" }); }));
    render(<AdminModerationActions id="f1" record={{ ...state }} onRefresh={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Rechazar experiencia" }));
    await userEvent.type(screen.getByLabelText("Justificación obligatoria"), "Justificación");
    await userEvent.dblClick(screen.getByRole("button", { name: "Confirmar decisión" }));
    expect(moderarFeedback).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Procesando…" }).hasAttribute("disabled")).toBe(true);
    await act(async () => { complete(); });
  });

  it("no ofrece aprobación propia ni decisiones para bajas", () => {
    const view = render(<AdminModerationActions id="f1" record={{ ...state, estadoModeracion: "PENDIENTE" }} own onRefresh={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Aprobar experiencia" })).toBeNull();
    view.rerender(<AdminModerationActions id="f1" record={{ ...state, deletedAt: date }} onRefresh={vi.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([0, 1, 2, 3])("restitución preventiva con %s denunciantes abiertos respeta el umbral", count => {
    render(<AdminModerationActions id="f1" record={{ ...state, ocultoReportes: true }} denunciantesAbiertos={count} onRefresh={vi.fn()} />);
    expect(Boolean(screen.queryByRole("button", { name: "Restituir ocultamiento preventivo" }))).toBe(count < 2);
    if (count >= 2) expect(screen.getByText(/menos de dos denunciantes distintos/)).toBeTruthy();
  });

  it.each(["PENDIENTE", "RECHAZADO"])("puede levantar exclusivamente causa administrativa incluso en %s", status => {
    render(<AdminModerationActions id="f1" record={{ ...state, estadoModeracion: status, ocultoAdministracion: true, ocultoAutor: true }} onRefresh={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Restituir ocultamiento administrativo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ocultar por administración" })).toBeNull();
  });

  it("presenta causas simultáneas sin afirmar publicación", () => {
    render(<AdminModerationStatus record={{ ...state, ocultoAutor: true, ocultoAdministracion: true, ocultoReportes: true }} />);
    expect(screen.getByText("Aprobada, sin visibilidad pública")).toBeTruthy();
    expect(screen.getByText("Oculta por el autor")).toBeTruthy();
    expect(screen.getByText("Oculta por administración")).toBeTruthy();
    expect(screen.getByText("Oculta preventivamente por reportes")).toBeTruthy();
    expect(screen.queryByText("Publicada")).toBeNull();
  });
});

describe("T6 detalle administrativo de reportes", () => {
  it("consulta evidencia e identidad segura, conserva retorno y pagina historial de tres", async () => {
    const data = report(); data.resolucionesAnteriores.total = 4; vi.mocked(obtenerReporteFeedback).mockResolvedValue(data);
    const origin = "/home/admin/experiencias?seccion=reportes&estadoReporte=ABIERTO&page=2";
    render(<AdminReporteDetail id="r1" returnTo={origin} />);
    await screen.findByText("Contenido exacto denunciado");
    expect(obtenerReporteFeedback).toHaveBeenCalledWith("r1", { page: 1, pageSize: 3 });
    const identity = screen.getByText("Denunciante").nextElementSibling?.textContent;
    expect(identity).toContain("Persona denunciante"); expect(identity).toContain("ID: u2");
    expect(screen.getByRole("link", { name: /Volver/ }).getAttribute("href")).toBe(origin);
    const detail = new URL(screen.getByRole("link", { name: "Ver experiencia actual e historial" }).getAttribute("href")!, "https://local.invalid");
    expect(detail.searchParams.get("returnTo")).toBe(`${origin}&reporteId=r1`);
    expect(screen.queryByText(/email|token|sesión/i)).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(obtenerReporteFeedback).toHaveBeenLastCalledWith("r1", { page: 2, pageSize: 3 }));
  });

  it("cerrar un reporte exige motivo y nunca llama moderación ni restitución implícita", async () => {
    const data = report();
    render(<AdminReporteDetail id="r1" returnTo="/home/admin/experiencias?seccion=reportes" />);
    await screen.findByText("Contenido exacto denunciado");
    expect(screen.getByText(/Cerrar un reporte no vuelve a publicar/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Desestimar reporte" }));
    const dialog = screen.getByRole("dialog", { name: "Desestimar reporte" });
    await userEvent.type(within(dialog).getByLabelText("Justificación obligatoria"), "No corresponde a la evidencia");
    vi.mocked(obtenerReporteFeedback).mockResolvedValue({ ...data, denunciantesAbiertos: 1, reporte: { ...data.reporte, estado: "DESESTIMADO", justificacion: "No corresponde a la evidencia", resolvedAt: date } });
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar decisión" }));
    await screen.findByText(/El reporte se cerró correctamente/);
    expect(screen.getByText(/La experiencia sigue oculta por reportes/)).toBeTruthy();
    expect(screen.getByText(/usá Restituir ocultamiento preventivo/)).toBeTruthy();
    expect(resolverReporteFeedback).toHaveBeenCalledExactlyOnceWith("r1", { estado: "DESESTIMADO", motivo: "No corresponde a la evidencia" });
    expect(moderarFeedback).not.toHaveBeenCalled();
    await screen.findByRole("button", { name: "Restituir ocultamiento preventivo" });
    expect(screen.getByText("Oculta preventivamente por reportes")).toBeTruthy();
  });

  it("actualiza un reporte cerrado concurrentemente y deja de ofrecer su resolución", async () => {
    render(<AdminReporteDetail id="r1" returnTo="/home/admin/experiencias?seccion=reportes" />);
    await screen.findByText("Contenido exacto denunciado");
    await userEvent.click(screen.getByRole("button", { name: "Resolver reporte" }));
    await userEvent.type(screen.getByLabelText("Justificación obligatoria"), "Comprobado");
    vi.mocked(resolverReporteFeedback).mockRejectedValue(new HttpError(409, "El reporte ya está cerrado"));
    const current = report(); current.reporte.estado = "RESUELTO";
    vi.mocked(obtenerReporteFeedback).mockResolvedValue(current);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar decisión" }));
    await screen.findByText(/La información cambió o la acción ya fue realizada/);
    await screen.findByText("Resuelto");
    expect(screen.queryByRole("button", { name: "Resolver reporte" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("T6 bandeja administrativa existente", () => {
  it("consulta experiencias por estado con nueve elementos y retorno al listado", async () => {
    navigation.query = "estadoModeracion=RECHAZADO&page=2";
    const data = report();
    vi.mocked(listarFeedbackModeracion).mockResolvedValue({ total: 10, page: 2, pageSize: 9, items: [{ ...data.experiencia, propio: false, texto: "Experiencia rechazada", autor: null, puntuacion: 4, anonimo: true, profesor: null, createdAt: date, updatedAt: date, estadoModeracion: "RECHAZADO" }] });
    render(<AdminExperiencias />);
    await screen.findByText("Experiencia rechazada");
    expect(listarFeedbackModeracion).toHaveBeenCalledWith({ page: 2, pageSize: 9, estado: "RECHAZADO" });
    expect(screen.getByRole("link", { name: "Ver detalle" }).getAttribute("href")).toContain(encodeURIComponent("/home/admin/experiencias?estadoModeracion=RECHAZADO&page=2"));
    await userEvent.selectOptions(screen.getByLabelText("Estado de moderación"), "APROBADO");
    expect(navigation.replace).toHaveBeenCalledWith("/home/admin/experiencias?estadoModeracion=APROBADO", { scroll: false });
  });

  it("filtra reportes y oculta identidades en listado, con paginación nueve", async () => {
    navigation.query = "seccion=reportes&estadoReporte=ABIERTO&motivo=SPAM&ocultoReportes=true&page=2";
    const data = report();
    vi.mocked(listarReportesFeedback).mockResolvedValue({ total: 10, page: 2, pageSize: 9, items: [{ ...data.reporte, experiencia: data.experiencia, cantidadReportesActivos: 3, denunciantesAbiertos: 3, ultimoReporteAt: date }] });
    render(<AdminExperiencias />);
    await screen.findByRole("link", { name: "Ver reporte" });
    expect(listarReportesFeedback).toHaveBeenCalledWith({ page: 2, pageSize: 9, estado: "ABIERTO", motivo: "SPAM", ocultoReportes: true });
    expect(screen.queryByText("Persona denunciante")).toBeNull(); expect(screen.queryByText("u2")).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText("Motivo"), "OTRO");
    expect(navigation.replace).toHaveBeenCalledWith("/home/admin/experiencias?seccion=reportes&estadoReporte=ABIERTO&motivo=OTRO&ocultoReportes=true", { scroll: false });
  });
});

describe("T6 historial administrativo comprensible", () => {
  it("traduce decisiones, campos, estados y origen sin mostrar metadata técnica o JSON", () => {
    const reference = "f5a60f57-48b7-4a44-868d-896543030eed";
    const audit = { id: reference, createdAt: date, createdBy: reference, createdByName: "Administradora", updatedAt: date, updatedBy: reference, updatedByName: "Administradora", deletedAt: null, deletedBy: null };
    const actions = ["APROBACION", "RECHAZO", "OCULTAMIENTO_AUTOR", "RESTITUCION_AUTOR", "OCULTAMIENTO_ADMIN", "RESTITUCION_ADMIN", "SOLICITUD_REVISION", "OCULTAMIENTO_REPORTES", "RESTITUCION_REPORTES"];
    const changes = [
      { campo: "estadoModeracion", anterior: "PENDIENTE", nuevo: "APROBADO" },
      { campo: "estadoModeracion", anterior: "APROBADO", nuevo: "RECHAZADO" },
      { campo: "origen", anterior: "AUTOMATICO", nuevo: "ADMINISTRATIVO" },
      { campo: "versionModeracion", anterior: "7", nuevo: "8" },
      { campo: "requiereRevisionHumana", anterior: "false", nuevo: "true" },
      { campo: "ocultoReportes", anterior: "false", nuevo: "true" },
      { campo: "valoracionMateria.puntuacion", anterior: "4", nuevo: "5" },
      { campo: "valoracionMateria.deletedAt", anterior: null, nuevo: date },
      { campo: "motivoRechazo", anterior: null, nuevo: "Revisá la información personal" },
      { campo: "interno", anterior: reference, nuevo: '{"token":"secret"}' },
      { campo: "motivo", anterior: null, nuevo: '{"message":"internal error"}' },
    ];
    const data: AdminRecord = { registro: {}, auditoria: audit, historial: { total: actions.length, page: 1, pageSize: 3, items: actions.map((accion, index) => ({ id: String(index), actorId: reference, actorName: "Administradora", accion, createdAt: date, cambios: index === 0 ? changes : [] })) } };
    const view = render(<UserAudit data={data} kind="feedback" page={1} onPageChange={vi.fn()} />);
    const text = view.container.textContent!;
    for (const raw of [...actions, "PENDIENTE", "APROBADO", "RECHAZADO", "AUTOMATICO", "ADMINISTRATIVO", "valoracionMateria", "versionModeracion", "requiereRevisionHumana", reference, "secret", "internal error", '{"']) expect(text).not.toContain(raw);
    for (const translated of ["Aprobación de la experiencia", "Rechazo de la experiencia", "Solicitud de nueva revisión", "Ocultamiento preventivo por reportes", "Restitución del ocultamiento preventivo", "Estado de moderación", "Pendiente de revisión", "Aprobada", "Rechazada", "Automático por reportes", "Decisión administrativa", "Versión de la experiencia", "Revisión administrativa requerida", "Valoración de la materia", "Fecha de retiro de la valoración", "4 de 5", "5 de 5"]) expect(text).toContain(translated);
  });
});
