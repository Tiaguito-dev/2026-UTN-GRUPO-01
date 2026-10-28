// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoleRouteBoundary } from "@/components/home/RoleRouteBoundary";
import { RequireGuest } from "@/components/auth/RequireGuest";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AccountForm } from "@/components/auth/AccountForm";

const { state, replace, login } = vi.hoisted(() => ({
  state: { status: "authenticated", role: "ADMIN", pathname: "/home", search: "" },
  replace: vi.fn(),
  login: vi.fn(),
}));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({
  usePathname: () => state.pathname,
  useSearchParams: () => new URLSearchParams(state.search),
  useRouter: () => ({ replace }),
}));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({
  status: state.status, account: state.status === "authenticated" ? { role: state.role } : null,
  coordinationAvailable: true,
  login,
}) }));

beforeEach(() => {
  replace.mockClear();
  login.mockReset();
  state.status = "authenticated";
  state.role = "ADMIN";
  state.pathname = "/home";
  state.search = "";
  window.history.replaceState({}, "", "/login");
});
afterEach(cleanup);

describe("límite de navegación según rol", () => {
  it("ADMIN no monta el inicio estudiantil antes de redirigir al panel", async () => {
    render(<RoleRouteBoundary><p>Invitación para publicar</p></RoleRouteBoundary>);
    expect(screen.queryByText("Invitación para publicar")).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home/admin"));
  });

  it("un acceso directo a comisión conserva su identificador y evita montar participación", async () => {
    state.pathname = "/home/materias/m1/cursadas/c1/comisiones/comision-3";
    render(<RoleRouteBoundary><p>Formulario estudiantil</p></RoleRouteBoundary>);
    expect(screen.queryByText("Formulario estudiantil")).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^\/home\/admin\/comisiones\/comision-3(?:\?|$)/)));
  });

  it("conserva carrera, materia y página al entrar al equivalente administrativo", async () => {
    state.pathname = "/home/experiencias";
    state.search = "carrera=S&materiaId=m1&page=3";
    render(<RoleRouteBoundary><p>Contenido público</p></RoleRouteBoundary>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home/admin/experiencias?carrera=S&materiaId=m1&page=3"));
  });

  it.each(["/home/admin", "/home/admin/materias/m1", "/account"])('no redirige ni oculta un destino válido ADMIN: %s', (pathname) => {
    state.pathname = pathname;
    render(<RoleRouteBoundary><p>Contenido autorizado</p></RoleRouteBoundary>);
    expect(screen.getByText("Contenido autorizado")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("USER conserva el contenido y la navegación de estudiantes", () => {
    state.role = "USER";
    state.pathname = "/home/materias/m1";
    render(<RoleRouteBoundary><p>Materia del estudiante</p></RoleRouteBoundary>);
    expect(screen.getByText("Materia del estudiante")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("inicio tras autenticar y recuperación de sesión", () => {
  it.each([
    ["ADMIN", "", "/home/admin"],
    ["ADMIN", "/home/materias/materia-1", "/home/admin/materias/materia-1"],
    ["USER", "/home/experiencias?carrera=S&page=2", "/home/experiencias?carrera=S&page=2"],
  ])("el formulario usa el rol recién autenticado %s y el retorno %s", async (role, origin, expected) => {
    state.status = "anonymous";
    // No hay cuenta en el contexto antes del login: debe usarse la respuesta real.
    login.mockResolvedValue({ id: "cuenta-1", role, displayName: "Nombre público", email: "cuenta@alu.frlp.utn.edu.ar" });
    window.history.replaceState({}, "", `/login${origin ? `?returnTo=${encodeURIComponent(origin)}` : ""}`);
    render(<AccountForm mode="login" />);
    await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "cuenta@alu.frlp.utn.edu.ar");
    await userEvent.type(screen.getByLabelText("Contraseña"), "clave-valida");
    await userEvent.click(screen.getByRole("button", { name: "Iniciar sesión" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(expected));
    expect(login).toHaveBeenCalledWith({ email: "cuenta@alu.frlp.utn.edu.ar", password: "clave-valida" });
  });

  it.each([["ADMIN", "/home/admin"], ["USER", "/home"]])("sesión %s entra a su inicio", async (role, destination) => {
    state.role = role;
    render(<RequireGuest><p>Formulario de acceso</p></RequireGuest>);
    expect(screen.queryByText("Formulario de acceso")).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith(destination));
  });

  it("el login ADMIN respeta un retorno interno traduciéndolo al detalle administrativo", async () => {
    window.history.replaceState({}, "", "/login?returnTo=%2Fhome%2Fmaterias%2Fmateria-1");
    render(<RequireGuest preserveReturn><p>Formulario de acceso</p></RequireGuest>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(expect.stringMatching(/^\/home\/admin\/materias\/materia-1(?:\?|$)/)));
  });

  it("un retorno externo no cambia el inicio ADMIN", async () => {
    window.history.replaceState({}, "", "/login?returnTo=https%3A%2F%2Fevil.test");
    render(<RequireGuest preserveReturn><p>Formulario de acceso</p></RequireGuest>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home/admin"));
  });

  it("antes de iniciar sesión conserva el destino y sus filtros", async () => {
    state.status = "anonymous";
    state.pathname = "/home/experiencias";
    state.search = "carrera=S&materiaId=m1&page=2";
    render(<RequireAuth><p>Contenido privado</p></RequireAuth>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/login?returnTo=${encodeURIComponent("/home/experiencias?carrera=S&materiaId=m1&page=2")}`));
    expect(screen.queryByText("Contenido privado")).toBeNull();
  });
});
