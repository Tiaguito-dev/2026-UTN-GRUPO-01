// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MateriasList } from "@/components/academic/MateriasList";
import { UsuariosList } from "@/components/admin/UsuariosList";
import { ProfesoresList } from "@/components/admin/ProfesoresList";
import { MateriasAdminList } from "@/components/admin/MateriasAdminList";
import { CursadasAdminList } from "@/components/admin/CursadasAdminList";
import { ComisionesAdminList } from "@/components/admin/ComisionesAdminList";
import { listarMaterias } from "@/services/materias";
import { listarUsuarios } from "@/services/users";
import { listarProfesores, listarMaterias as listarMateriasAdmin, listarCursadasPorMateria, listarComisionesPorCursada, type Comision, type CursadaResumen } from "@/services/academic";
import { materiaFixture, cursadaDetalleFixture } from "./support/academic-fixtures";

const { router, location } = vi.hoisted(() => ({ router: { replace: vi.fn() }, location: { pathname: "/", search: "" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(location.search),
}));
vi.mock("@/services/academic", () => ({ listarMaterias: vi.fn(), listarProfesores: vi.fn(), listarCursadasPorMateria: vi.fn(), listarComisionesPorCursada: vi.fn(), obtenerCursada: vi.fn(async (id: string) => cursadaDetalleFixture(id)) }));
vi.mock("@/services/materias", () => ({ listarMaterias: vi.fn(), obtenerMateria: vi.fn(async (id: string) => materiaFixture(id)) }));
vi.mock("@/services/users", () => ({ listarUsuarios: vi.fn() }));
// TASK-043: MateriasList reads the role (useIsAdmin → useAuth) for "Nueva materia".
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ account: { role: "USER" } }) }));

afterEach(cleanup);

const usuario = (id: string) => ({ id, email: `${id}@alu.frlp.utn.edu.ar`, displayName: `Cuenta ${id}`, role: "USER" as const, createdAt: "2026-01-02T00:00:00.000Z" });
const materia = (id: string) => ({ id, nombre: `Materia ${id}`, carreras: [], createdAt: "2026-01-02T00:00:00.000Z", deletedAt: null });
const profesor = (id: string) => ({ id, nombreCompleto: `Profesor ${id}`, createdAt: "2026-01-02T00:00:00.000Z", deletedAt: null });

describe.each([
  { name: "MateriasList", Component: MateriasList, fetch: vi.mocked(listarMaterias) as Mock, pathname: "/home/materias", heading: "Materias", item: materia, itemText: "Materia a", loading: "Cargando materias…", empty: /No hay materias que coincidan con la búsqueda y los filtros/ },
  { name: "UsuariosList", Component: UsuariosList, fetch: vi.mocked(listarUsuarios) as Mock, pathname: "/home/admin/usuarios", heading: "Usuarios registrados", item: usuario, itemText: "Cuenta a", loading: "Cargando usuarios…", empty: /Todavía no hay cuentas registradas/ },
  { name: "ProfesoresList", Component: ProfesoresList, fetch: vi.mocked(listarProfesores) as Mock, pathname: "/home/admin/profesores", heading: "Profesores", item: profesor, itemText: "Profesor a", loading: "Cargando profesores…", empty: /No hay registros para mostrar/ },
  { name: "MateriasAdminList", Component: MateriasAdminList, fetch: vi.mocked(listarMateriasAdmin) as Mock, pathname: "/home/admin/materias", heading: "Materias", item: materia, itemText: "Materia a", loading: "Cargando materias…", empty: /No hay registros para mostrar/ },
  { name: "CursadasAdminList", Component: CursadasAdminList, fetch: vi.mocked(listarCursadasPorMateria) as Mock, pathname: "/home/admin/cursadas", heading: "Cursadas", item: (id: string): CursadaResumen => ({ id, anio: 2026, cuatrimestre: "PRIMERO", comisiones: 1, profesores: 1, carreras: ["S"] }), itemText: "1er cuatrimestre 2026", loading: "Cargando cursadas…", empty: /No hay registros para mostrar/, search: "materiaId=m1" },
  { name: "ComisionesAdminList", Component: ComisionesAdminList, fetch: vi.mocked(listarComisionesPorCursada) as Mock, pathname: "/home/admin/comisiones", heading: "Comisiones", item: (id: string): Comision => ({ id, cursadaId: "c1", nombre: "S-31", carrera: "S", numero: 31, profesores: [], activa: true, createdAt: "2026-01-01T00:00:00.000Z", deletedAt: null }), itemText: "S-31", loading: "Cargando comisiones…", empty: /No hay registros para mostrar/, search: "materiaId=m1&cursadaId=c1" },
])("$name", ({ name, Component, fetch, pathname, heading, item, itemText, loading, empty, search }) => {
  const page = (ids: string[], total = ids.length) => ({ items: ids.map((id) => item(id)), total, page: 1, pageSize: 9 });
  // TASK-069: los tooltips también nombran el registro; buscar la celda identifica el dato visible.
  const visibleItem = () => name === "MateriasList" ? screen.findByText(itemText) : screen.findByRole("cell", { name: itemText });

  // BUG-02: los enlaces de fila vuelven solo a esta lista (un nivel); los ancestros salen de los IDs.
  function expectedReturnTo(pageNumber = 1) {
    const query = new URLSearchParams(search);
    if (pageNumber > 1) query.set("page", String(pageNumber));
    return `${pathname}${query.size ? `?${query}` : ""}`;
  }

  function setup() {
    location.pathname = pathname;
    location.search = search ?? "";
    if (name === "CursadasAdminList" || name === "ComisionesAdminList") {
      vi.mocked(listarMateriasAdmin).mockResolvedValue({ items: [materia("m1")], total: 1, page: 1, pageSize: 100 });
      if (name === "ComisionesAdminList") vi.mocked(listarCursadasPorMateria).mockResolvedValue({ items: [{ id: "c1", anio: 2026, cuatrimestre: "PRIMERO", comisiones: 1, profesores: 0, carreras: ["S"] }], total: 1, page: 1, pageSize: 100 });
    }
    router.replace.mockReset();
    router.replace.mockImplementation((url: string) => { location.search = new URL(url, "http://local").search; });
    return render(<Component />);
  }

  it("muestra la carga y después los datos", async () => {
    let resolve!: (value: ReturnType<typeof page>) => void;
    fetch.mockReturnValue(new Promise((done) => { resolve = done; }));
    setup();
    // La carga de filas comienza después de resolver materia/período en listados anidados.
    await waitFor(() => expect(screen.getAllByRole("status").some((status) => status.textContent === loading)).toBe(true));
    resolve(page(["a"]));
    expect(await visibleItem()).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(...fetchArgs(1));
  });

  it("ante un error, Reintentar vuelve a pedir la página", async () => {
    fetch.mockRejectedValueOnce(new Error("Servicio no disponible")).mockResolvedValue(page(["a"]));
    setup();
    expect((await screen.findByRole("alert")).textContent).toContain("Servicio no disponible");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await visibleItem()).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("muestra el estado vacío", async () => {
    fetch.mockResolvedValue(page([]));
    setup();
    // TASK-069: las tablas distinguen resultados filtrados vacíos del catálogo estudiantil.
    expect(await screen.findByText(name === "MateriasList" ? empty : /No hay registros que coincidan con los filtros/)).toBeTruthy();
  });

  it("los listados administrativos son tablas y usuarios no ofrece gestión", async () => {
    if (name === "MateriasList") return;
    fetch.mockResolvedValue(page(["a"]));
    setup();
    await visibleItem();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(2);
    if (name === "UsuariosList") {
      expect(screen.queryByRole("button", { name: /eliminar|rol|editar/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /crear|editar/i })).toBeNull();
    } else {
      expect(screen.getByRole("link", { name: /editar/i })).toBeTruthy();
      // TASK-068: los detalles de tablas administrativas conservan su origen y nunca abren el recorrido público.
      const detail = new URL(screen.getByRole("link", { name: /^Ver detalle de/ }).getAttribute("href")!, "https://local.test");
      expect(detail.pathname).toBe(`${pathname}/a`);
      expect(detail.searchParams.get("returnTo")).toBe(expectedReturnTo());
      if (search) expect(detail.searchParams.get("materiaReturnTo")).toBe("/home/admin/materias");
    }
  });

  it("Siguiente reemplaza la URL con ?page=2 y pide esa página", async () => {
    // TASK-070: todas las tablas piden únicamente la página remota solicitada.
    fetch.mockResolvedValue(page(["a"], 25));
    const view = setup();
    await userEvent.click(await screen.findByRole("button", { name: "Página siguiente" }));
    expect(router.replace).toHaveBeenCalledWith(`${pathname}?${search ? `${search}&` : ""}page=2`, { scroll: false });
    view.rerender(<Component />);
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(...fetchArgs(2)));
    if (name !== "MateriasList" && name !== "UsuariosList") {
      const detail = new URL((await screen.findAllByRole("link", { name: /^Ver detalle de/ }))[0].getAttribute("href")!, "https://local.test");
      expect(detail.searchParams.get("returnTo")).toBe(expectedReturnTo(2));
    }
  });

  function fetchArgs(page: number) {
    if (name === "MateriasList") return [{ page, carrera: undefined, anioCarrera: undefined }];
    if (name === "MateriasAdminList") return [{ page, pageSize: 9, q: undefined, carrera: undefined, anioCarrera: undefined, nivelElectiva: undefined }];
    if (name === "ProfesoresList") return [{ page, pageSize: 9, q: undefined }];
    if (name === "CursadasAdminList") return ["m1", { page, pageSize: 9 }];
    if (name === "ComisionesAdminList") return ["c1", { page, pageSize: 9, carrera: undefined }];
    return [{ page, pageSize: 9, q: undefined, rol: undefined, estado: undefined }];
  }

  it("lleva el foco al h1 al montar", () => {
    fetch.mockReturnValue(new Promise(() => {}));
    setup();
    if (name === "MateriasList") expect(document.activeElement).toBe(screen.getByRole("status").parentElement);
    else expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: heading }));
  });
});
