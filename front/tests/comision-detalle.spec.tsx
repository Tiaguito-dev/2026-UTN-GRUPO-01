// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComisionDetail } from "@/components/academic/ComisionDetail";
import { obtenerDetalleAdministrativo } from "@/services/admin-detail";
import { obtenerMateria } from "@/services/materias";
import { asignarProfesorComision, listarComisionesPorCursada, listarProfesores, obtenerComision, quitarProfesorComision } from "@/services/academic";
const { authState, push, origin } = vi.hoisted(() => ({ authState: { role: "USER" }, push: vi.fn(), origin: { extra: "" } }));
vi.mock("@/services/admin-detail", () => ({ obtenerDetalleAdministrativo: vi.fn() }));
vi.mock("next/link", () => import("./support/next-link"));
// TASK-057: feedback interactions are covered separately; this suite checks academic context.
vi.mock("@/components/feedback/ComisionFeedback", () => ({
  ComisionFeedback: ({ comision, administrative }: { comision: { id: string }; administrative?: boolean }) => <div data-testid="feedback-comision" data-comision-id={comision.id} data-administrative={String(Boolean(administrative))} />,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(`carrera=S&anioCarrera=ELECTIVA&listadoPage=2&q=Plan&nivelElectiva=4&cursadaId=cur1&comisionesPage=3${origin.extra}`),
  useRouter: () => ({ push }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: authState.role } }) }));
vi.mock("@/services/materias", () => ({ obtenerMateria: vi.fn() }));
vi.mock("@/services/academic", () => ({
  obtenerComision: vi.fn(), listarComisionesPorCursada: vi.fn(), listarProfesores: vi.fn(),
  asignarProfesorComision: vi.fn(), quitarProfesorComision: vi.fn(), CARGOS: ["TITULAR", "ADJUNTO", "JTP"],
}));
const comisionMock = {
  id: "com1", cursadaId: "cur1", carrera: "S" as const, numero: 31, nombre: "S-31", activa: true,
  profesores: [{ id: "p1", nombreCompleto: "Prof. Rossi", cargo: "TITULAR" as const }],
  createdAt: "2026-01-01", deletedAt: null,
  cursada: { id: "cur1", anio: 2026, cuatrimestre: "PRIMERO" as const, materia: { id: "mat1", nombre: "Álgebra" } },
};
const alternativas = {
  items: [comisionMock, { ...comisionMock, id: "com2", numero: 32, nombre: "S-32", profesores: [] }],
  total: 2, page: 1, pageSize: 100,
};
beforeEach(() => {
  vi.clearAllMocks();
  // HU11 integrado: el editor compartido consume la asignación confirmada por PUT.
  vi.mocked(asignarProfesorComision).mockImplementation(async (_comisionId, profesorId, cargo) => ({
    id: profesorId, nombreCompleto: profesorId === "p1" ? "Prof. Rossi" : "Dra. Gomez", cargo,
  }));
  vi.mocked(obtenerDetalleAdministrativo).mockImplementation(async () => ({registro:{...comisionMock},auditoria:{id:comisionMock.id,createdAt:comisionMock.createdAt,createdBy:null,updatedAt:null,updatedBy:null,deletedAt:null,deletedBy:null},historial:{items:[],total:0,page:1,pageSize:3}}));
  authState.role = "USER";
  origin.extra = "";
  vi.mocked(obtenerComision).mockResolvedValue(comisionMock);
  vi.mocked(obtenerMateria).mockResolvedValue({ id: "mat1", nombre: "Álgebra", carreras: [{ carrera: "S", anioCarrera: "2", nivelElectiva: null }], createdAt: "2026-01-01", deletedAt: null });
  vi.mocked(listarComisionesPorCursada).mockResolvedValue(alternativas);
  vi.mocked(listarProfesores).mockResolvedValue({ items: [
    { id: "p1", nombreCompleto: "Prof. Rossi", createdAt: "", deletedAt: null },
    { id: "p2", nombreCompleto: "Dra. Gomez", createdAt: "", deletedAt: null },
  ], total: 2, page: 1, pageSize: 100 });
});
afterEach(cleanup);
// TASK-059 intentionally changes the former commission-title/sidebar-list presentation.
describe("Detalle de comisión centrado en experiencias", () => {
  it("el detalle administrativo conserva el origen filtrado y abre solo entidades administrativas", async () => {
    authState.role = "ADMIN";
    const returnTo = "/home/admin/comisiones?materiaId=mat1&cursadaId=cur1&carrera=S&page=3";
    origin.extra = `&${new URLSearchParams({ returnTo })}`;
    render(<ComisionDetail comisionId="com1" administrative />);
    await screen.findByRole("heading", { name: "Álgebra" });
    const breadcrumb = within(screen.getByRole("navigation", { name: "Ubicación actual" }));
    expect(breadcrumb.getAllByRole("link")[0]!.textContent).toBe("Administración");
    // El origen administrativo debe corresponder a la materia y cursada del registro.
    expect(breadcrumb.getByRole("link", { name: "Comisiones" }).getAttribute("href")).toBe(returnTo);
    expect(screen.getByRole("link", { name: /Volver a contexto administrativo/ }).getAttribute("href")).toBe(returnTo);
    const teacher = new URL(screen.getByRole("link", { name: "Prof. Rossi" }).getAttribute("href")!, "https://local.test");
    expect(teacher.pathname).toBe("/home/admin/profesores/p1");
    // TASK-admin-navigation-context: los accesos desde el detalle regresan a la comisión.
    const detailHref = `/home/admin/comisiones/com1?${new URLSearchParams({ returnTo })}`;
    expect(teacher.searchParams.get("returnTo")).toBe(detailHref);
    const edit = new URL(screen.getByRole("link", { name: "Editar comisión" }).getAttribute("href")!, "https://local.test");
    expect(edit.pathname).toBe("/home/admin/comisiones/com1/editar");
    expect(edit.searchParams.get("returnTo")).toBe(detailHref);
    expect(screen.getByTestId("feedback-comision").getAttribute("data-administrative")).toBe("true");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Comisión del período" }), "com2");
    const destination = new URL(String(push.mock.calls.at(-1)?.[0]), "https://local.test");
    expect(destination.pathname).toBe("/home/admin/comisiones/com2");
    expect(destination.searchParams.get("returnTo")).toBe(returnTo);
    expect(document.querySelector('a[href^="/home/materias"]')).toBeNull();
  });

  it("el ingreso administrativo desde Experiencias conserva breadcrumb, filtros y página al recargar", async () => {
    authState.role = "ADMIN";
    const returnTo = "/home/admin/experiencias?carrera=S&materiaId=mat1&page=3";
    origin.extra = `&${new URLSearchParams({ returnTo })}`;
    const assertContext = async () => {
      await screen.findByRole("heading", { name: "Álgebra" });
      const breadcrumb = screen.getByRole("navigation", { name: "Ubicación actual" });
      expect(Array.from(breadcrumb.querySelectorAll("li")).map(item => item.textContent)).toEqual(["Administración", "Experiencias", "Comisión S-31"]);
      expect(within(breadcrumb).getByRole("link", { name: "Experiencias" }).getAttribute("href")).toBe(returnTo);
      expect(within(breadcrumb).getByText("Comisión S-31").getAttribute("aria-current")).toBe("page");
      expect(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")).toBe(returnTo);
      expect(within(breadcrumb).queryByRole("link", { name: "Materias" })).toBeNull();
      expect(within(breadcrumb).queryByText(/comentario/i)).toBeNull();
      expect(document.querySelector('a[href^="/home/materias"]')).toBeNull();
    };
    const view = render(<ComisionDetail comisionId="com1" administrative />);
    await assertContext();
    view.unmount();
    render(<ComisionDetail comisionId="com1" administrative />);
    await assertContext();
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Comisión del período" }), "com2");
    const next = new URL(String(push.mock.calls.at(-1)?.[0]), "https://local.test");
    expect(next.pathname).toBe("/home/admin/comisiones/com2");
    expect(next.searchParams.get("returnTo")).toBe(returnTo);
  });

  it.each([
    "", "https://externo.test/home/admin/experiencias", "/home/admin/usuarios?page=3",
    "/home/admin/comisiones?materiaId=mat2&cursadaId=cur2&page=9",
    "/home/admin/comisiones/com1", "/home/admin/experiencias?page=0",
  ])("sin origen compatible %s reconstruye los padres reales", async (returnTo) => {
    authState.role = "ADMIN";
    origin.extra = `&${new URLSearchParams({ returnTo })}`;
    render(<ComisionDetail comisionId="com1" administrative />);
    await screen.findByRole("heading", { name: "Álgebra" });
    const breadcrumb = within(screen.getByRole("navigation", { name: "Ubicación actual" }));
    expect(breadcrumb.getByRole("link", { name: "Materias" })).toBeTruthy();
    expect(breadcrumb.queryByRole("link", { name: "Experiencias" })).toBeNull();
    const back = new URL(screen.getByRole("link", { name: /Volver a/ }).getAttribute("href")!, "https://local.test");
    expect(back.pathname).toBe("/home/admin/comisiones");
    expect(back.searchParams.get("materiaId")).toBe("mat1");
    expect(back.searchParams.get("cursadaId")).toBe("cur1");
    expect(back.searchParams.get("page")).toBeNull();
  });

  it("regresa a Experiencias con sus filtros y conserva el origen al cambiar comisión", async () => {
    origin.extra = "&origen=experiencias&experienciasCarrera=I&experienciasMateriaId=mat1&experienciasPage=3";
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
    expect((await screen.findByRole("link", { name: "Volver a Experiencias" })).getAttribute("href")).toBe("/home/experiencias?carrera=I&materiaId=mat1&page=3");
    await userEvent.selectOptions(await screen.findByRole("combobox", { name: "Comisión del período" }), "com2");
    const query = new URL(String(push.mock.calls.at(-1)?.[0]), "http://local").searchParams;
    expect(Object.fromEntries(query)).toMatchObject({ origen: "experiencias", experienciasCarrera: "I", experienciasMateriaId: "mat1", experienciasPage: "3" });
  });
  it("titula con la materia y muestra carrera/año reales y equipo docente sin edición para USER", async () => {
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Álgebra" })).toBeTruthy();
    expect(await screen.findByText(/Ingeniería en Sistemas.*2\.º año/)).toBeTruthy();
    expect(screen.getAllByText(/2026/).length).toBeGreaterThan(0);
    const equipo = (await screen.findByRole("heading", { name: "Equipo docente" })).closest("section")!;
    expect(within(equipo).getByText("Prof. Rossi")).toBeTruthy();
    expect(within(equipo).getByText("Titular")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Quitar" })).toBeNull();
    expect(screen.queryByText("Gestionar equipo docente")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Datos de la comisión" })).toBeNull();
    expect((await screen.findByTestId("feedback-comision")).getAttribute("data-comision-id")).toBe("com1");
  });
  // TASK-061: experiences precede the team in a single column, and return restores the period.
  it("ubica equipo docente después de experiencias y vuelve directamente a materia con período y página", async () => {
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
    const team = await screen.findByRole("heading", { name: "Equipo docente" });
    const experiences = screen.getByTestId("feedback-comision");
    expect(experiences.compareDocumentPosition(team) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(team.closest("aside")).toBeNull();
    const back = screen.getByRole("link", { name: /Volver a/ });
    const url = new URL(back.getAttribute("href")!, "http://localhost");
    expect(url.pathname).toBe("/home/materias/mat1");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ cursadaId: "cur1", comisionesPage: "3", carrera: "S", anioCarrera: "ELECTIVA", listadoPage: "2", q: "Plan", nivelElectiva: "4" });
    expect(screen.queryByRole("link", { name: "2026" })).toBeNull();
  });
  it("selector navega a otra comisión manteniendo el contexto original de búsqueda", async () => {
    const user = userEvent.setup();
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
    const select = await screen.findByRole("combobox", { name: "Comisión del período" });
    expect((select as HTMLSelectElement).value).toBe("com1");
    await user.selectOptions(select, "com2");
    const url = new URL(String(push.mock.calls[0][0]), "http://localhost");
    expect(url.pathname).toBe("/home/materias/mat1/cursadas/cur1/comisiones/com2");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ carrera: "S", anioCarrera: "ELECTIVA", listadoPage: "2", q: "Plan", nivelElectiva: "4" });
  });
  it("distingue carga de alternativas de una comisión única", async () => {
    vi.mocked(listarComisionesPorCursada).mockReturnValueOnce(new Promise(() => {}));
    const { unmount } = render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
    expect(await screen.findByText("Cargando comisiones…")).toBeTruthy();
    expect(screen.queryByText("Esta es la única comisión de este período.")).toBeNull();
    unmount();
    vi.mocked(listarComisionesPorCursada).mockResolvedValue({ items: [comisionMock], total: 1, page: 1, pageSize: 100 });
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
    expect(await screen.findByText("Esta es la única comisión de este período.")).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Comisión del período" })).toBeNull();
  });
  it("fallo de alternativas ofrece reintentar sin simular que la comisión es única", async () => {
    const user = userEvent.setup();
    vi.mocked(listarComisionesPorCursada).mockRejectedValueOnce(new Error("Error de conexión"));
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
    const retry = await screen.findByRole("button", { name: "Reintentar comisiones" });
    expect(screen.queryByText("Esta es la única comisión de este período.")).toBeNull();
    await user.click(retry);
    expect(await screen.findByRole("combobox", { name: "Comisión del período" })).toBeTruthy();
  });
  it("el año no se infiere de la URL cuando falla la consulta de materia", async () => {
    vi.mocked(obtenerMateria).mockRejectedValueOnce(new Error("Sin datos"));
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Álgebra" })).toBeTruthy();
    expect(await screen.findByText("No pudimos recuperar el año de la materia.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reintentar datos de materia" })).toBeTruthy();
    expect(screen.queryByText(/Ingeniería en Sistemas.*Electiva/)).toBeNull();
  });
  it("ADMIN conserva cambios de cargo, baja y asignación dentro de gestión desplegable", async () => {
    const user = userEvent.setup(); authState.role = "ADMIN";
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
    const summary = await screen.findByText("Gestionar equipo docente");
    expect(summary.closest("details")?.open).toBe(false);
    await user.click(summary);
    expect(summary.closest("details")?.open).toBe(true);
    await user.selectOptions(screen.getByLabelText("Cambiar cargo de Prof. Rossi"), "JTP");
    await waitFor(() => expect(asignarProfesorComision).toHaveBeenCalledWith("com1", "p1", "JTP"));
    await user.click(screen.getByRole("button", { name: "Quitar asignación de Prof. Rossi" }));
    expect(quitarProfesorComision).toHaveBeenCalledWith("com1", "p1");
    await user.selectOptions(screen.getByLabelText("Profesor"), "p2");
    await user.click(screen.getByRole("button", { name: "Asignar profesor" }));
    expect(asignarProfesorComision).toHaveBeenCalledWith("com1", "p2", "TITULAR");
  });
  it("representa ausencia de docentes y error principal con acción visible", async () => {
    vi.mocked(obtenerComision).mockResolvedValueOnce({ ...comisionMock, profesores: [] });
    const { unmount } = render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
    expect(await screen.findByText(/No hay profesores asignados/)).toBeTruthy();
    unmount();
    vi.mocked(obtenerComision).mockRejectedValueOnce(new Error("No se pudo cargar la comisión."));
    render(<ComisionDetail materiaId="mat1" cursadaId="cur1" comisionId="com1" />);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("No se pudo cargar la comisión."));
  });
});
