// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SiteHeader } from "@/components/SiteHeader";
import { SidebarNav } from "@/components/home/SidebarNav";
import { joinedReturnTo, returnToQuery } from "@/validations/admin";
import { comisionDetailHref } from "@/validations/admin-academic-navigation";

const { auth, location } = vi.hoisted(() => ({
  auth: { value: { status: "authenticated", account: { role: "USER" }, logout: async () => {} } as Record<string, unknown> },
  location: { pathname: "/home", query: "", replace: vi.fn() },
}));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: location.replace }), usePathname: () => location.pathname, useSearchParams: () => new URLSearchParams(location.query) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.value }));

afterEach(() => { cleanup(); location.query = ""; });

describe("SiteHeader", () => {
  it.each([["ADMIN", "/home/admin"], ["USER", "/home"]])("marca BookOpen decorativa conserva destino de %s", (role, href) => {
    auth.value = { status: "authenticated", account: { role } };
    render(<SiteHeader />);
    const brand = screen.getByRole("link", { name: "Profesor Butchery" });
    expect(brand.getAttribute("href")).toBe(href);
    expect(brand.querySelector("svg.lucide-book-open")?.getAttribute("aria-hidden")).toBe("true");
    expect(brand.textContent).not.toContain("PB");
  });
  function setup() {
    auth.value = { status: "authenticated", account: { role: "USER" }, logout: async () => {} };
    render(<><SiteHeader /><p>Contenido</p></>);
    return screen.getByRole("button", { name: "Opciones de cuenta" });
  }

  it("abre y cierra el menú con el botón", async () => {
    const trigger = setup();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: "Mi perfil" })).toBeTruthy();
    await userEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: "Mi perfil" })).toBeNull();
  });

  it("Escape cierra y devuelve el foco al botón", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Mi perfil" }));
    await userEvent.keyboard("{Escape}");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });

  it("un clic afuera cierra el menú", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByText("Contenido"));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("ADMIN regresa al panel desde la marca y conserva perfil y cierre de sesión", async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    auth.value = { status: "authenticated", account: { role: "ADMIN" }, logout };
    render(<SiteHeader />);
    expect(screen.getByRole("link", { name: /Profesor Butchery/ }).getAttribute("href")).toBe("/home/admin");
    await userEvent.click(screen.getByRole("button", { name: "Opciones de cuenta" }));
    expect(screen.getByRole("link", { name: "Mi perfil" }).getAttribute("href")).toBe("/account");
    expect(screen.getByRole("link", { name: "Cambiar contraseña" }).getAttribute("href")).toBe("/account/change-password");
    await userEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    expect(location.replace).toHaveBeenCalledWith("/login?notice=logout");
  });
});

describe("SidebarNav", () => {
  const current = () => screen.getAllByRole("link").filter((link) => link.getAttribute("aria-current") === "page").map((link) => link.textContent);

  it.each(["/home/admin/comisiones/co1", "/home/admin/comisiones/co1/editar"])("mantiene Experiencias seleccionado en %s con origen persistido en URL", (pathname) => {
    const list = "/home/admin/experiencias?carrera=S&materiaId=m1&page=3";
    // BUG-02: la comisión lleva origen=experiencias plano; su edición vuelve a esa misma URL.
    const commission = comisionDetailHref("co1", list);
    location.pathname = pathname;
    location.query = pathname.endsWith("/editar") ? new URLSearchParams({ returnTo: commission }).toString() : new URL(commission, "https://local.test").search.slice(1);
    auth.value = { status: "authenticated", account: { role: "ADMIN" } };
    render(<SidebarNav />);
    expect(current()).toEqual(["Experiencias"]);
  });

  it("deja de conservar Experiencias cuando se abre explícitamente una materia", () => {
    location.pathname = "/home/admin/materias/m1";
    location.query = new URLSearchParams({ returnTo: "/home/admin/experiencias?page=3" }).toString();
    auth.value = { status: "authenticated", account: { role: "ADMIN" } };
    render(<SidebarNav />);
    expect(current()).toEqual(["Materias"]);
  });

  it.each([
    ["/home/admin/experiencias?carrera=S&page=3", "Experiencias"],
    ["/home/admin/comisiones?materiaId=m1&cursadaId=cu1&page=2", "Materias"],
  ])("comentario desde comisión conserva la sección de %s", (origin, expected) => {
    // La experiencia vuelve a la comisión ya plana (comisionNavigation.detailHref), con su página.
    const flat = joinedReturnTo(returnToQuery(comisionDetailHref("co1", origin)))!;
    const commission = `${flat}${flat.includes("?") ? "&" : "?"}page=2`;
    location.pathname = "/home/admin/experiencias/f1";
    location.query = new URLSearchParams({ returnTo: commission }).toString();
    auth.value = { status: "authenticated", account: { role: "ADMIN" } };
    render(<SidebarNav />);
    expect(current()).toEqual([expected]);
  });

  it.each(["https://externo.test", "/home/admin/usuarios?page=2", "/home/admin/experiencias?page=0"])("un origen inválido %s no cambia el recorrido académico", (returnTo) => {
    location.pathname = "/home/admin/comisiones/co1";
    location.query = new URLSearchParams({ returnTo }).toString();
    auth.value = { status: "authenticated", account: { role: "ADMIN" } };
    render(<SidebarNav />);
    expect(current()).toEqual(["Materias"]);
  });

  it("conserva el menú estudiantil aunque la URL contenga un origen administrativo", () => {
    location.pathname = "/home/materias/m1/cursadas/cu1/comisiones/co1";
    location.query = new URLSearchParams({ returnTo: "/home/admin/experiencias?page=3" }).toString();
    auth.value = { status: "authenticated", account: { role: "USER" } };
    render(<SidebarNav />);
    expect(current()).toEqual(["Materias"]);
    expect(screen.queryByText("Administración")).toBeNull();
  });

  it.each([
    ["/home", "Inicio"],
    ["/home/materias", "Materias"],
    ["/home/materias/m1/cursadas/c1", "Materias"],
    ["/home/profesores", "Profesores"],
    ["/account", "Inicio"],
    ["/account/change-password", "Inicio"],
  ])("en %s marca %s con aria-current", (pathname, expected) => {
    location.pathname = pathname;
    auth.value = { status: "authenticated", account: { role: "USER" } };
    render(<SidebarNav />);
    expect(current()).toEqual([expected]);
  });

  // TASK-060 replaces letter/symbol glyphs with one decorative outline icon collection.
  it("cada entrada conserva enlace nativo y usa un icono decorativo uniforme", () => {
    location.pathname = "/home/admin/materias";
    auth.value = { status: "authenticated", account: { role: "ADMIN" } };
    render(<SidebarNav />);
    const links = screen.getAllByRole("link");
    // TASK-068: administración tiene su propio recorrido, sin enlaces de participación.
    expect(links.map(link => link.getAttribute("href"))).toEqual(["/home/admin", "/home/admin/materias", "/home/admin/profesores", "/home/admin/usuarios", "/home/admin/experiencias"]);
    expect(links.map(link => link.textContent)).toEqual(["Inicio", "Materias", "Profesores", "Usuarios", "Experiencias"]);
    expect(screen.getByText("Administración")).toBeTruthy();
    expect(screen.queryByText(/De estudiantes/)).toBeNull();
    for (const link of links) {
      const icon = link.querySelector("svg")!;
      expect(icon).not.toBeNull();
      expect(icon.getAttribute("width")).toBe("18");
      expect(icon.getAttribute("height")).toBe("18");
      expect(icon.getAttribute("stroke-width")).toBe("1.75");
      expect(icon.getAttribute("aria-hidden")).toBe("true");
      expect(icon.getAttribute("focusable")).toBe("false");
    }
  });

  it("con el header, el sidebar es el único landmark Navegación principal", () => {
    location.pathname = "/home";
    auth.value = { status: "authenticated", account: { role: "USER" }, logout: async () => {} };
    render(<><SiteHeader /><SidebarNav /></>);
    expect(screen.getAllByRole("navigation").map((nav) => nav.getAttribute("aria-label"))).toEqual(["Navegación principal"]);
    expect(screen.queryByRole("complementary", { name: /./ })).toBeNull();
  });

  it("USER conserva las cinco secciones estudiantiles", () => {
    location.pathname = "/home";
    auth.value = { status: "authenticated", account: { role: "USER" } };
    render(<SidebarNav />);
    expect(screen.getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/home", "/home/profesores", "/home/materias", "/home/experiencias", "/home/comunidad"]);
    expect(screen.queryByText("Administración")).toBeNull();
  });

  it.each([
    ["/home/admin", "Inicio"],
    ["/home/admin/materias/m1", "Materias"],
    ["/home/admin/cursadas?materiaId=m1", "Materias"],
    ["/home/admin/comisiones/co1", "Materias"],
    ["/home/admin/profesores/p1/editar", "Profesores"],
    ["/home/admin/usuarios", "Usuarios"],
    ["/home/admin/experiencias?page=2", "Experiencias"],
    ["/account", "Inicio"],
  ])("ADMIN en %s tiene una única sección activa: %s", (path, expected) => {
    location.pathname = path.split("?")[0];
    auth.value = { status: "authenticated", account: { role: "ADMIN" } };
    render(<SidebarNav />);
    expect(current()).toEqual([expected]);
  });

  it("no presenta enlaces administrativos antes de confirmar la sesión", () => {
    auth.value = { status: "checking", account: { role: "ADMIN" } };
    render(<SidebarNav />);
    expect(screen.queryAllByRole("link").some(link => link.getAttribute("href")?.startsWith("/home/admin"))).toBe(false);
  });
});
