// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi, type Mock } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MateriasList } from "@/components/academic/MateriasList";
import { UsuariosList } from "@/components/admin/UsuariosList";
import { listarMaterias } from "@/services/materias";
import { listarUsuarios } from "@/services/users";

const { router, location } = vi.hoisted(() => ({ router: { replace: vi.fn() }, location: { pathname: "/" } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => location.pathname,
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/services/academic", () => ({ listarMaterias: vi.fn() }));
vi.mock("@/services/materias", () => ({ listarMaterias: vi.fn() }));
vi.mock("@/services/users", () => ({ listarUsuarios: vi.fn() }));

afterEach(cleanup);

const usuario = (id: string) => ({ id, email: `${id}@alu.frlp.utn.edu.ar`, displayName: `Cuenta ${id}`, role: "USER" as const, createdAt: "2026-01-02T00:00:00.000Z" });
const materia = (id: string) => ({ id, anioCarrera: null, nombre: `Materia ${id}`, createdAt: "2026-01-02T00:00:00.000Z", nivelElectiva: null, deletedAt: null });

describe.each([
  { name: "MateriasList", Component: MateriasList, fetch: vi.mocked(listarMaterias) as Mock, pathname: "/home/materias", heading: "Materias", item: materia, itemText: "Materia a", loading: "Cargando materias…", empty: /No hay materias que coincidan con la búsqueda y los filtros/ },
  { name: "UsuariosList", Component: UsuariosList, fetch: vi.mocked(listarUsuarios) as Mock, pathname: "/home/admin/usuarios", heading: "Usuarios registrados", item: usuario, itemText: "Cuenta a", loading: "Cargando usuarios…", empty: /Todavía no hay cuentas registradas/ },
])("$name", ({ name, Component, fetch, pathname, heading, item, itemText, loading, empty }) => {
  const page = (ids: string[], total = ids.length) => ({ items: ids.map((id) => item(id)), total, page: 1, pageSize: 10 });

  function setup() {
    location.pathname = pathname;
    router.replace.mockReset();
    return render(<Component />);
  }

  it("muestra la carga y después los datos", async () => {
    fetch.mockResolvedValue(page(["a"]));
    setup();
    expect(screen.getByRole("status")).toHaveProperty("textContent", loading);
    expect(await screen.findByText(itemText)).toBeTruthy();
    expect(fetch).toHaveBeenCalledWith(name === "MateriasList" ? { page: 1, anioCarrera: undefined } : { page: 1 });
  });

  it("ante un error, Reintentar vuelve a pedir la página", async () => {
    fetch.mockRejectedValueOnce(new Error("Servicio no disponible")).mockResolvedValue(page(["a"]));
    setup();
    expect((await screen.findByRole("alert")).textContent).toContain("Servicio no disponible");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(itemText)).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("muestra el estado vacío", async () => {
    fetch.mockResolvedValue(page([]));
    setup();
    expect(await screen.findByText(empty)).toBeTruthy();
  });

  it("Siguiente reemplaza la URL con ?page=2 y pide esa página", async () => {
    fetch.mockResolvedValue(page(["a"], 25));
    setup();
    await userEvent.click(await screen.findByRole("button", { name: "Página siguiente" }));
    expect(router.replace).toHaveBeenCalledWith(`${pathname}?page=2`, { scroll: false });
    if (name !== "MateriasList") expect(fetch).toHaveBeenLastCalledWith({ page: 2 });
  });

  it("lleva el foco al h1 al montar", () => {
    fetch.mockReturnValue(new Promise(() => {}));
    setup();
    if (name === "MateriasList") expect(document.activeElement?.getAttribute("tabindex")).toBe("-1");
    else expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: heading }));
  });
});
