// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { RoleTheme } from "@/components/auth/RoleTheme";
import { SiteHeader } from "@/components/SiteHeader";
import type { AuthStatus, Role } from "@/types/auth";

const { auth } = vi.hoisted(() => ({ auth: { value: {} as Record<string, unknown> } }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => auth.value }));
afterEach(cleanup);

function theme(status: AuthStatus, role?: Role) {
  return <RoleTheme status={status} role={role}><p>Contenido compartido</p></RoleTheme>;
}

describe("Identidad visual por rol confirmado", () => {
  it.each([
    ["authenticated", "ADMIN", "admin"],
    ["authenticated", "USER", "student"],
    ["checking", "ADMIN", "pending"],
    ["temporary-error", "ADMIN", "pending"],
    ["anonymous", "ADMIN", "public"],
  ] as const)("%s con rol %s utiliza %s", (status, role, expected) => {
    render(theme(status, role));
    expect(screen.getByText("Contenido compartido").closest("[data-role-theme]")?.getAttribute("data-role-theme")).toBe(expected);
  });

  it("restaura el tema público al cerrar sesión y no conserva el del administrador previo", () => {
    const view = render(theme("authenticated", "ADMIN"));
    const content = screen.getByText("Contenido compartido");
    expect(content.closest("[data-role-theme]")?.getAttribute("data-role-theme")).toBe("admin");
    view.rerender(theme("anonymous"));
    expect(content.closest("[data-role-theme]")?.getAttribute("data-role-theme")).toBe("public");
    view.rerender(theme("authenticated", "USER"));
    expect(content.closest("[data-role-theme]")?.getAttribute("data-role-theme")).toBe("student");
  });

  it("no toma el rol de la URL ni escribe una preferencia persistente", () => {
    window.history.replaceState({}, "", "/home/admin/usuarios");
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(theme("authenticated", "USER"));
    expect(screen.getByText("Contenido compartido").closest("[data-role-theme]")?.getAttribute("data-role-theme")).toBe("student");
    expect(storage).not.toHaveBeenCalled();
  });
});

describe("Identificación del entorno en el encabezado", () => {
  it("identifica Administración únicamente para ADMIN autenticado y conserva marca y destino", () => {
    auth.value = { status: "authenticated", account: { role: "ADMIN" } };
    render(<SiteHeader />);
    expect(screen.getByText("Administración")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Professors' butchery" }).getAttribute("href")).toBe("/home/admin");
    expect(screen.getByRole("button", { name: "Opciones de cuenta" })).toBeTruthy();
  });

  it.each([
    ["authenticated", "USER"], ["checking", "ADMIN"], ["temporary-error", "ADMIN"], ["anonymous", "ADMIN"],
  ] as const)("no anuncia entorno administrativo en %s/%s", (status, role) => {
    auth.value = { status, account: { role } };
    render(<SiteHeader />);
    expect(screen.queryByText("Administración")).toBeNull();
    if (status !== "authenticated") expect(screen.queryByRole("button", { name: "Opciones de cuenta" })).toBeNull();
  });
});
