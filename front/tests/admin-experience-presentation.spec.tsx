// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminRecordDetail } from "@/components/admin/AdminRecordDetail";
import { obtenerDetalleAdministrativo, type AdminRecord } from "@/services/admin-detail";

const state = vi.hoisted(() => ({ role: "ADMIN", query: "" }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(state.query) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { id: "admin", role: state.role } }) }));
vi.mock("@/services/admin-detail", () => ({ obtenerDetalleAdministrativo: vi.fn() }));

const date = "2026-10-29T15:30:00.000Z";
const reference = "644e6a1a-b99b-42f5-b677-098a37af0951";
const name = "María de los Ángeles Fernández del Valle";
let record: Record<string, unknown>;
let history: AdminRecord["historial"];
function detail(page = 1): AdminRecord {
  return {
    registro: { ...record },
    auditoria: { id: reference, createdAt: date, createdBy: reference, createdByName: "Persona creadora", updatedAt: date, updatedBy: reference, updatedByName: "Persona editora", deletedAt: typeof record.deletedAt === "string" ? record.deletedAt : null, deletedBy: null },
    historial: { ...history, page },
  };
}
beforeEach(() => {
  vi.resetAllMocks(); state.role = "ADMIN"; state.query = "";
  record = { id: "f1", autorId: reference, comisionId: "co1", materiaId: reference, cursadaId: reference, texto: "Una experiencia completa de la cursada.", anonimo: false, autor: { displayName: name }, comisionNombre: "S-31", materiaNombre: "Álgebra histórica", anio: 2026, cuatrimestre: "PRIMERO", modalidad: "ANUAL", profesorId: "p1", profesorNombre: "Ana Profesora", profesorCargo: "TITULAR", deletedAt: null };
  history = { items: [], total: 0, page: 1, pageSize: 3 };
  vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async (_kind, _id, page = 1) => detail(page));
});
afterEach(cleanup);

async function renderDetail() {
  const view = render(<AdminRecordDetail kind="feedback" id="f1" />);
  await screen.findByText("Una experiencia completa de la cursada.");
  return view;
}
function field(label: string) {
  return screen.getByText(label, { selector: "dt" }).closest("div")!.querySelector("dd")!;
}

describe("presentación administrativa de Experiencias", () => {
  it("organiza identidad, estado y contexto registrado con etiquetas legibles", async () => {
    const { container } = await renderDetail();
    expect(screen.getByRole("heading", { level: 1, name: "Detalle de comentario" })).toBeTruthy();
    expect(field("Autor").textContent).toBe(name);
    expect(field("Estado").textContent).toBe("Publicado");
    expect(field("Publicación anónima").textContent).toBe("No");
    expect(field("Materia").textContent).toBe("Álgebra histórica");
    expect(field("Comisión").textContent).toBe("S-31");
    expect(field("Año").textContent).toBe("2026");
    expect(field("Período").textContent).toMatch(/cuatrimestre/i);
    expect(field("Período").textContent).not.toContain("PRIMERO");
    expect(field("Modalidad").textContent).toBe("Anual");
    expect(field("Docente mencionado").textContent).toBe("Ana Profesora");
    expect(field("Cargo en esta comisión").textContent).toBe("Titular");
    expect(container.textContent).not.toContain(reference);
    expect(container.querySelector("img")).toBeNull();
    // TASK-feedback-removal-permissions agrega eliminación administrativa con confirmación.
    expect(screen.getByRole("button", { name: "Eliminar comentario" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Editar|Restaurar|Dar de baja/i })).toBeNull();
  });

  it("mantiene nombre autorizado del autor aunque la publicación sea anónima", async () => {
    record.anonimo = true;
    await renderDetail();
    expect(field("Autor").textContent).toBe(name);
    expect(field("Publicación anónima").textContent).toBe("Sí");
  });

  it("presenta eliminación explícita y auditoría de eliminación, sin ofrecer operaciones nuevas", async () => {
    record.deletedAt = date;
    await renderDetail();
    expect(field("Estado").textContent).toBe("Eliminado");
    expect(screen.getByRole("heading", { level: 3, name: "Eliminación" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Restaurar|Borrar definitivamente/i })).toBeNull();
  });

  it("usa No registrado para campos ausentes sin convertir ausencia de anonimato en No", async () => {
    record = { id: "f1", texto: "Una experiencia completa de la cursada.", autorId: reference, profesorId: "p1", deletedAt: null };
    const { container } = await renderDetail();
    for (const label of ["Autor", "Publicación anónima", "Materia", "Comisión", "Año", "Período", "Modalidad", "Docente mencionado", "Cargo en esta comisión"]) expect(field(label).textContent).toBe("No registrado");
    expect(screen.queryByRole("link", { name: "Ver comisión" })).toBeNull();
    expect(container.textContent).not.toContain(reference);
  });

  it("conserva contenido largo completo, saltos de línea y nombres extensos", async () => {
    const content = `Primer párrafo.\n\n${"Contenido extenso sin recortar. ".repeat(110)}\nÚltimo párrafo.`;
    record.texto = content;
    record.materiaNombre = "Nombre de materia extraordinariamente extenso ".repeat(8);
    const { container } = render(<AdminRecordDetail kind="feedback" id="f1" />);
    await screen.findByText(name);
    expect([...container.querySelectorAll("p, dd")].some(node => node.textContent === content)).toBe(true);
    expect(field("Materia").textContent).toBe(String(record.materiaNombre).trim());
  });

  it("respeta los snapshots del comentario y no solicita nuevamente la auditoría ya cargada", async () => {
    await renderDetail();
    expect(field("Materia").textContent).toBe("Álgebra histórica");
    expect(obtenerDetalleAdministrativo).toHaveBeenCalledTimes(1);
    expect(obtenerDetalleAdministrativo).toHaveBeenCalledWith("feedback", "f1", 1);
  });

  it("conserva Volver, breadcrumb y Ver comisión con el contexto filtrado", async () => {
    const origin = "/home/admin/experiencias?carrera=S&materiaId=mat1&page=3";
    state.query = new URLSearchParams({ returnTo: origin }).toString();
    await renderDetail();
    expect(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")).toBe(origin);
    const breadcrumb = within(screen.getByRole("navigation", { name: "Ubicación actual" }));
    expect(breadcrumb.getByRole("link", { name: "Experiencias" }).getAttribute("href")).toBe(origin);
    const commission = new URL(screen.getByRole("link", { name: "Ver comisión" }).getAttribute("href")!, "https://local.test");
    expect(commission.pathname).toBe("/home/admin/comisiones/co1");
    expect(commission.searchParams.get("returnTo")).toBe(origin);
  });

  it("reutiliza auditoría con nombres y fechas legibles e historial cerrado inicialmente", async () => {
    const { container } = await renderDetail();
    expect(screen.getByRole("heading", { name: "Auditoría" })).toBeTruthy();
    expect(screen.getByText("Solo administración")).toBeTruthy();
    expect(screen.getByText("Persona creadora")).toBeTruthy();
    expect(screen.getByText("Persona editora")).toBeTruthy();
    expect(screen.getByText(/La fecha de actualización no constituye un historial completo/)).toBeTruthy();
    const disclosure = container.querySelector("details")!;
    expect(disclosure.open).toBe(false);
    expect(disclosure.querySelector("summary svg.lucide-history")).toBeTruthy();
    expect(disclosure.querySelector("summary svg.lucide-chevron-down")).toBeTruthy();
    expect([...container.querySelectorAll("time")].some(node => node.dateTime === date && node.textContent?.includes("2026"))).toBe(true);
  });

  it("historial vacío mantiene su control nativo enfocable y desplegable", async () => {
    const { container } = await renderDetail();
    const summary = container.querySelector("summary")!;
    summary.focus();
    expect(document.activeElement).toBe(summary);
    // jsdom no emula la activación por Enter del control summary nativo del navegador.
    await userEvent.click(summary);
    expect(container.querySelector("details")!.open).toBe(true);
    expect(screen.getByText("No hay eventos registrados")).toBeTruthy();
  });

  it("presenta cambios reales de contenido y anonimato y pagina sin duplicar solicitudes", async () => {
    history = { items: [{ id: "e1", actorId: reference, actorName: "Actor autorizado", accion: "EDICION", createdAt: date, cambios: [{ campo: "texto", anterior: "Versión anterior", nuevo: "Versión nueva" }, { campo: "anonimo", anterior: "false", nuevo: "true" }] }], total: 4, page: 1, pageSize: 3 };
    const { container } = await renderDetail();
    await userEvent.click(container.querySelector("summary")!);
    const event = within(container.querySelector("details")!).getByRole("listitem");
    expect(event.textContent).toContain("Actor: Actor autorizado");
    const table = within(event).getByRole("table");
    expect(within(table).getByRole("rowheader", { name: "Contenido" })).toBeTruthy();
    expect(within(table).getByRole("rowheader", { name: "Publicación anónima" })).toBeTruthy();
    expect(within(table).getByRole("cell", { name: "Versión anterior" })).toBeTruthy();
    expect(within(table).getByRole("cell", { name: "Versión nueva" })).toBeTruthy();
    expect(within(table).getByRole("cell", { name: "No" })).toBeTruthy();
    expect(within(table).getByRole("cell", { name: "Sí" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Página siguiente/ }));
    await waitFor(() => expect(obtenerDetalleAdministrativo).toHaveBeenLastCalledWith("feedback", "f1", 2));
    expect(obtenerDetalleAdministrativo).toHaveBeenCalledTimes(2);
  });

  it("la presentación compartida no revela auditoría a usuarios comunes", async () => {
    state.role = "USER";
    await renderDetail();
    expect(screen.queryByRole("heading", { name: "Auditoría" })).toBeNull();
    expect(screen.queryByText("Persona creadora")).toBeNull();
    expect(screen.queryByText("Persona editora")).toBeNull();
  });

  it("no interpreta contenido literal como valores booleanos del historial", async () => {
    history = { items: [{ id: "e1", actorId: reference, actorName: "Actor autorizado", accion: "EDICION", createdAt: date, cambios: [{ campo: "texto", anterior: "false", nuevo: "true" }] }], total: 1, page: 1, pageSize: 3 };
    const { container } = await renderDetail();
    await userEvent.click(container.querySelector("summary")!);
    const table = screen.getByRole("table");
    expect(within(table).getByRole("cell", { name: "false" })).toBeTruthy();
    expect(within(table).getByRole("cell", { name: "true" })).toBeTruthy();
    expect(within(table).queryByRole("cell", { name: "Sí" })).toBeNull();
    expect(within(table).queryByRole("cell", { name: "No" })).toBeNull();
  });
});
