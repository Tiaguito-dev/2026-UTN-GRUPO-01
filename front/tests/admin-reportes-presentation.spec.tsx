// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminExperiencias } from "@/components/admin/AdminExperiencias";
import { AdminReporteDetail } from "@/components/admin/AdminReporteDetail";
import { listarReportesFeedback, obtenerReporteFeedback, resolverReporteFeedback } from "@/services/feedback-reportes";
import { moderarFeedback } from "@/services/feedback";
import type { ReporteDetail } from "@/types/feedback-reportes";

vi.mock("next/link", () => import("./support/next-link"));
const navigation = vi.hoisted(() => ({ query: "", replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(navigation.query), usePathname: () => "/home/admin/experiencias", useRouter: () => ({ replace: navigation.replace }) }));
vi.mock("@/services/feedback-reportes", () => ({ listarReportesFeedback: vi.fn(), obtenerReporteFeedback: vi.fn(), resolverReporteFeedback: vi.fn() }));
vi.mock("@/services/feedback", () => ({ moderarFeedback: vi.fn() }));

const date = "2026-11-17T12:00:00.000Z";
const authorId = "f5a60f57-48b7-4a44-868d-896543030eed";
const administratorId = "644e6a1a-b99b-42f5-b677-098a37af0951";
const origin = "/home/admin/experiencias?seccion=reportes&estadoReporte=ABIERTO&page=2";
function fixture(): ReporteDetail {
  return {
    cantidadReportesActivos: 3, denunciantesAbiertos: 2, ultimoReporteAt: date,
    reporte: { id: "r1", feedbackId: "f1", versionReportada: 2, motivo: "DATOS_PERSONALES", descripcion: "Descripción suministrada por la persona denunciante.", estado: "ABIERTO", createdAt: date, resolvedAt: null, denuncianteId: authorId, historialId: "h1", administradorId: null, justificacion: null, denunciante: { id: authorId, displayName: "Persona denunciante autorizada" } },
    experiencia: { id: "f1", deletedAt: null, estadoModeracion: "APROBADO", versionModeracion: 7, requiereRevisionHumana: false, motivoRechazo: null, ocultoAutor: false, ocultoAdministracion: false, ocultoReportes: true, contexto: { carrera: "S", comisionId: "c1", nombre: "K101", materiaId: "m1", materiaNombre: "Álgebra", cursadaId: "cu1", anio: 2026, cuatrimestre: "PRIMERO", modalidad: "PRIMERO" } },
    evidencia: { id: "h1", texto: "Evidencia histórica exacta, distinta del comentario actual.", puntuacion: 3, anonimo: true, versionModeracion: 2, createdAt: date },
    resolucionesAnteriores: { items: [], total: 0, page: 1, pageSize: 3 },
  };
}
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
beforeEach(() => { vi.resetAllMocks(); navigation.query = ""; vi.mocked(obtenerReporteFeedback).mockResolvedValue(fixture()); });
afterEach(cleanup);

async function detail(data = fixture()) {
  vi.mocked(obtenerReporteFeedback).mockResolvedValue(data);
  const view = render(<AdminReporteDetail id="r1" returnTo={origin} />);
  await screen.findByRole("region", { name: "Versión denunciada" });
  return view;
}

describe("presentación de reportes administrativos", () => {
  it("agrupa la bandeja, sus filtros etiquetados y datos sin revelar denunciantes", async () => {
    const data = fixture();
    vi.mocked(listarReportesFeedback).mockResolvedValue({ total: 13, page: 1, pageSize: 9, items: [{ ...data.reporte, experiencia: data.experiencia, cantidadReportesActivos: 3, denunciantesAbiertos: 2, ultimoReporteAt: date }] });
    render(<AdminExperiencias />);
    await screen.findByRole("link", { name: /^Ver reporte/ });
    expect(screen.getByRole("heading", { level: 1, name: "Reportes de experiencias" })).toBeTruthy();
    const filters = within(screen.getByRole("region", { name: "Filtros de reportes" }));
    for (const label of ["Estado del reporte", "Motivo", "Ocultamiento preventivo"]) expect(filters.getByRole("combobox", { name: label })).toBeTruthy();
    const list = within(screen.getByRole("list", { name: "Reportes de experiencias" }));
    const item = list.getByRole("listitem");
    for (const text of ["Álgebra", "K101", "Información personal", "Abierto", "2"]) expect(item.textContent).toContain(text);
    expect(item.textContent).toMatch(/preventiv/i);
    expect(screen.queryByText(data.reporte.denunciante.displayName)).toBeNull();
    expect(screen.queryByText(authorId, { exact: false })).toBeNull();
    expect(screen.getByText(/13 registros/)).toBeTruthy();
    const destination = new URL(screen.getByRole("link", { name: /^Ver reporte/ }).getAttribute("href")!, "https://local.test");
    expect(destination.pathname).toBe("/home/admin/experiencias"); expect(destination.searchParams.get("reporteId")).toBe("r1");
  });

  it.each([
    ["Estado del reporte", "DESESTIMADO", "estadoReporte"],
    ["Motivo", "OTRO", "motivo"],
    ["Ocultamiento preventivo", "false", "ocultoReportes"],
  ])("conserva filtros y reinicia página al cambiar %s", async (label, value, key) => {
    navigation.query = "seccion=reportes&estadoReporte=ABIERTO&motivo=SPAM&ocultoReportes=true&page=2";
    vi.mocked(listarReportesFeedback).mockResolvedValue({ total: 0, page: 2, pageSize: 9, items: [] });
    render(<AdminExperiencias />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: label }), value);
    const [href, options] = navigation.replace.mock.calls.at(-1)!;
    const next = new URL(String(href), "https://local.test");
    expect(next.searchParams.get(key)).toBe(value); expect(next.searchParams.has("page")).toBe(false);
    expect(next.searchParams.get("seccion")).toBe("reportes"); expect(options).toEqual({ scroll: false });
    for (const [filter, previous] of [["estadoReporte", "ABIERTO"], ["motivo", "SPAM"], ["ocultoReportes", "true"]]) if (filter !== key) expect(next.searchParams.get(filter)).toBe(previous);
  });

  it("pagina la bandeja conservando filtros y nueve elementos por solicitud", async () => {
    navigation.query = "seccion=reportes&motivo=SPAM";
    vi.mocked(listarReportesFeedback).mockResolvedValue({ total: 10, page: 1, pageSize: 9, items: [] });
    render(<AdminExperiencias />);
    await userEvent.click(await screen.findByRole("button", { name: "Página siguiente" }));
    expect(listarReportesFeedback).toHaveBeenCalledExactlyOnceWith({ page: 1, pageSize: 9, estado: undefined, motivo: "SPAM", ocultoReportes: undefined });
    expect(navigation.replace).toHaveBeenCalledWith("/home/admin/experiencias?seccion=reportes&motivo=SPAM&page=2", { scroll: false });
  });

  it("presenta evidencia histórica como contenido principal y conserva metadatos y navegación", async () => {
    await detail();
    const evidence = screen.getByRole("region", { name: "Versión denunciada" });
    expect(within(evidence).getByRole("heading", { name: "Contenido denunciado" })).toBeTruthy();
    expect(within(evidence).getByText(fixture().evidencia.texto)).toBeTruthy();
    for (const text of ["Materia", "Álgebra", "Comisión", "K101", "Versión denunciada", "2", "Valoración de esta versión"]) expect(evidence.textContent).toContain(text);
    expect(obtenerReporteFeedback).toHaveBeenCalledExactlyOnceWith("r1", { page: 1, pageSize: 3 });
    const link = within(evidence).getByRole("link", { name: "Ver experiencia actual e historial" });
    const destination = new URL(link.getAttribute("href")!, "https://local.test");
    expect(destination.pathname).toBe("/home/admin/experiencias/f1");
    expect(destination.searchParams.get("returnTo")).toBe(`${origin}&reporteId=r1`);
  });

  it("mantiene todo el contenido extenso, párrafos e identificador como dato secundario", async () => {
    const data = fixture(); data.evidencia.texto = `Inicio.\n\n${"Texto muy largo sin recortar. ".repeat(120)}\nFinal.`;
    const { container } = await detail(data);
    expect([...container.querySelectorAll("p, blockquote")].some(node => node.textContent === data.evidencia.texto)).toBe(true);
    const identity = screen.getByRole("region", { name: "Identidad del denunciante" });
    expect(within(identity).getByText(data.reporte.denunciante.displayName)).toBeTruthy();
    expect(identity.textContent).toContain(authorId);
    expect(within(identity).getByRole("heading", { name: "Denunciante" }).textContent).not.toContain(authorId);
    expect(container.textContent).not.toMatch(/@|credencial|sesión|token/i);
  });

  it("explica ausencias de valoración y descripción sin fabricar datos", async () => {
    const data = fixture(); data.evidencia.puntuacion = null; data.reporte.descripcion = null;
    await detail(data);
    expect(within(screen.getByRole("region", { name: "Versión denunciada" })).getByText("Sin valoración")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Datos del reporte" })).getByText("Sin descripción")).toBeTruthy();
    expect(screen.queryByText(administratorId, { exact: false })).toBeNull();
  });

  it("muestra error recuperable sin datos y permite reintentar la misma consulta", async () => {
    vi.mocked(obtenerReporteFeedback).mockRejectedValueOnce(new Error("Fallo interno"));
    render(<AdminReporteDetail id="r1" returnTo={origin} />);
    await userEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    await screen.findByRole("region", { name: "Versión denunciada" });
    expect(obtenerReporteFeedback).toHaveBeenCalledTimes(2);
    expect(obtenerReporteFeedback).toHaveBeenLastCalledWith("r1", { page: 1, pageSize: 3 });
    expect(screen.queryByText("Fallo interno")).toBeNull();
  });

  it("conserva orden de lectura, breadcrumbs, retorno filtrado y foco inicial", async () => {
    await detail();
    const h1 = screen.getByRole("heading", { level: 1, name: "Detalle de reporte" });
    expect(document.activeElement).toBe(h1);
    expect(screen.getByRole("link", { name: /Volver/ }).getAttribute("href")).toBe(origin);
    const breadcrumb = within(screen.getByRole("navigation", { name: "Ubicación actual" }));
    expect(breadcrumb.getByRole("link", { name: "Reportes" }).getAttribute("href")).toBe(origin);
    expect(breadcrumb.getByText("Detalle").getAttribute("aria-current")).toBe("page");
    const labels = ["Versión denunciada", "Situación actual de la experiencia", "Historial de resoluciones", "Datos del reporte", "Identidad del denunciante", "Estado y resolución del reporte"];
    const regions = labels.map(name => screen.getByRole("region", { name }));
    for (let index = 1; index < regions.length; index++) expect(regions[index - 1].compareDocumentPosition(regions[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it.each(["ABIERTO", "RESUELTO", "DESESTIMADO"] as const)("distingue el reporte %s de la moderación y su visibilidad", async estado => {
    const data = fixture(); data.reporte.estado = estado;
    if (estado !== "ABIERTO") Object.assign(data.reporte, { justificacion: "Decisión fundamentada sobre la evidencia", resolvedAt: date, administradorId: administratorId });
    await detail(data);
    const resolution = within(screen.getByRole("region", { name: "Estado y resolución del reporte" }));
    const label = estado === "ABIERTO" ? "Abierto" : estado === "RESUELTO" ? "Resuelto" : "Desestimado";
    expect(resolution.getByText(label)).toBeTruthy();
    expect(Boolean(resolution.queryByRole("button", { name: "Resolver reporte" }))).toBe(estado === "ABIERTO");
    expect(Boolean(resolution.queryByRole("button", { name: "Desestimar reporte" }))).toBe(estado === "ABIERTO");
    if (estado !== "ABIERTO") {
      expect(resolution.getByText("Decisión fundamentada sobre la evidencia", { exact: false })).toBeTruthy();
      expect(screen.getByRole("region", { name: "Estado y resolución del reporte" }).textContent).toContain(administratorId);
      expect(screen.getByRole("region", { name: "Estado y resolución del reporte" }).querySelector(`time[datetime="${date}"]`)).toBeTruthy();
    }
    const current = within(screen.getByRole("region", { name: "Situación actual de la experiencia" }));
    expect(current.getByText("Estado de moderación")).toBeTruthy(); expect(current.getByText("Aprobada")).toBeTruthy();
    expect(current.getByText("Visibilidad")).toBeTruthy(); expect(current.getByText("Oculta preventivamente por reportes")).toBeTruthy();
    expect(current.getByText(/permanece oculta para la comunidad mientras administración revisa/)).toBeTruthy();
  });

  it("diferencia causas simultáneas y exige justificación y versión al restituir exclusivamente la preventiva", async () => {
    const data = fixture(); Object.assign(data.experiencia, { ocultoAutor: true, ocultoAdministracion: true }); data.denunciantesAbiertos = 1;
    await detail(data);
    const current = within(screen.getByRole("region", { name: "Situación actual de la experiencia" }));
    expect(current.getByText(/Oculta (voluntariamente|por el autor)/)).toBeTruthy();
    expect(current.getByText(/Oculta (administrativamente|por administración)/)).toBeTruthy();
    const opener = current.getByRole("button", { name: "Restituir ocultamiento preventivo" });
    await userEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Restituir ocultamiento preventivo" });
    const reason = within(dialog).getByLabelText("Justificación obligatoria"); expect(document.activeElement).toBe(reason);
    fireEvent.submit(dialog.querySelector("form")!);
    await within(dialog).findByText("Escribí una justificación para continuar."); expect(moderarFeedback).not.toHaveBeenCalled();
    await userEvent.type(reason, "Se revisaron los antecedentes del reporte");
    await userEvent.click(within(dialog).getByRole("button", { name: "Confirmar decisión" }));
    await waitFor(() => expect(moderarFeedback).toHaveBeenCalledExactlyOnceWith("f1", { accion: "RESTITUCION_REPORTES", versionEsperada: 7, motivo: "Se revisaron los antecedentes del reporte" }));
    expect(resolverReporteFeedback).not.toHaveBeenCalled();
  });

  it.each([
    ["PENDIENTE", "Pendiente de revisión"],
    ["RECHAZADO", "Rechazada"],
  ] as const)("separa moderación %s de las causas de ocultamiento", async (estado, label) => {
    const data = fixture(); data.experiencia.estadoModeracion = estado;
    if (estado === "RECHAZADO") data.experiencia.motivoRechazo = "Se requiere corregir la información personal";
    await detail(data);
    const current = within(screen.getByRole("region", { name: "Situación actual de la experiencia" }));
    expect(current.getByText(label)).toBeTruthy(); expect(current.getByText("Oculta preventivamente por reportes")).toBeTruthy();
    expect(current.queryByRole("button", { name: "Aprobar experiencia" })).toBeNull();
    expect(current.queryByRole("button", { name: "Ocultar por administración" })).toBeNull();
    expect(Boolean(current.queryByRole("button", { name: "Rechazar experiencia" }))).toBe(estado === "PENDIENTE");
    if (estado === "RECHAZADO") expect(current.getByText(/Se requiere corregir la información personal/)).toBeTruthy();
  });

  it("distingue visibilidad pública sin ocultamientos y no ofrece restituciones inválidas", async () => {
    const data = fixture(); data.experiencia.ocultoReportes = false;
    await detail(data);
    const current = within(screen.getByRole("region", { name: "Situación actual de la experiencia" }));
    expect(current.getByText("Aprobada")).toBeTruthy(); expect(current.getByText("Pública")).toBeTruthy();
    expect(current.queryByRole("button", { name: /Restituir/ })).toBeNull();
    expect(current.getByRole("button", { name: "Ocultar por administración" })).toBeTruthy();
  });

  it("identifica experiencia eliminada sin ofrecer decisiones administrativas", async () => {
    const data = fixture(); data.experiencia.deletedAt = date;
    await detail(data);
    const current = within(screen.getByRole("region", { name: "Situación actual de la experiencia" }));
    expect(current.getByText(/Eliminada/)).toBeTruthy(); expect(current.queryByRole("button")).toBeNull();
  });

  it("muestra eventos reales del historial con decisión, motivo, responsable y fecha, sin inventar eventos", async () => {
    const data = fixture(); data.resolucionesAnteriores = { total: 4, page: 1, pageSize: 3, items: [{ ...data.reporte, id: "r0", estado: "RESUELTO", justificacion: "Revisión anterior de los datos publicados", administradorId: administratorId, resolvedAt: date }] };
    await detail(data);
    const history = screen.getByRole("region", { name: "Historial de resoluciones" });
    const item = within(history).getByRole("listitem");
    expect(item.textContent).toContain("Resuelto"); expect(item.textContent).toContain("Información personal");
    expect(item.textContent).toContain("Revisión anterior de los datos publicados"); expect(item.textContent).toContain(administratorId);
    expect(item.querySelector(`time[datetime="${date}"]`)).toBeTruthy();
    await userEvent.click(within(history).getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => expect(obtenerReporteFeedback).toHaveBeenLastCalledWith("r1", { page: 2, pageSize: 3 }));
  });

  it("muestra un historial vacío compacto sin eventos ficticios", async () => {
    await detail();
    const history = within(screen.getByRole("region", { name: "Historial de resoluciones" }));
    expect(history.getByText("No hay resoluciones anteriores.")).toBeTruthy();
    expect(history.queryByRole("listitem")).toBeNull(); expect(history.queryByRole("navigation", { name: "Paginación" })).toBeNull();
  });
});
