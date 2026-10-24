import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RequireAuth } from "../src/components/auth/RequireAuth";
import { RequireRole } from "../src/components/auth/RequireRole";
import { COORDINATION_NOTICE } from "../src/services/session-coordinator";

const { state } = vi.hoisted(() => ({ state: { value: {} as Record<string, unknown> } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.value }));
vi.mock("next/navigation", () => ({ usePathname: () => "/account", useRouter: () => ({ replace: vi.fn() }) }));

const content = createElement("span", null, "Contenido administrativo de prueba");
function setAuth(status: string, role = "USER", temporaryError?: string, coordinationAvailable = true) {
  state.value = { status, account: status === "authenticated" ? { id: "public-id", role } : null, error: temporaryError,
    checkSession: vi.fn(), coordinationAvailable };
}
function render(status: string, role = "USER", temporaryError?: string) {
  setAuth(status, role, temporaryError);
  return renderToStaticMarkup(createElement(RequireAuth, { children: content }));
}
function renderRole(role: string) {
  // Web Locks unavailable: RequireRole must still not repeat the notice that RequireAuth shows.
  setAuth("authenticated", role, undefined, false);
  return renderToStaticMarkup(createElement(RequireRole, { roles: ["ADMIN"], children: content }));
}
describe("Navegación protegida sin rutas administrativas ficticias", () => {
  it("distingue comprobación inicial, sin sesión y error temporal", () => {
    expect(render("checking")).toContain("Comprobando sesión");
    expect(render("anonymous")).toContain("iniciar sesión");
    const temporary = render("temporary-error", "USER", "Comunicación temporalmente indisponible.");
    expect(temporary).toMatch(/<h1[^>]*>No pudimos comprobar tu sesión<\/h1>/);
    expect(temporary).toContain("Comunicación temporalmente indisponible."); expect(temporary).toContain("Reintentar comprobación");
    expect(temporary).toMatch(/<a class="button button-secondary" href="\/login">Volver a iniciar sesión<\/a>/);
  });
  it("ADMIN ve contenido declarado y USER recibe rechazo de permisos", () => {
    expect(renderRole("ADMIN")).toContain("Contenido administrativo de prueba");
    const rejected = renderRole("USER"); expect(rejected).toContain("no tiene permisos");
    expect(rejected).toMatch(/<h1[^>]*>Acceso no permitido<\/h1>/);
    expect(rejected).toMatch(/<a href="\/home">Volver al inicio<\/a>/);
    expect(rejected).not.toContain("Contenido administrativo de prueba");
  });
  it("RequireRole nunca muestra el aviso de coordinación", () => {
    expect(renderRole("ADMIN")).not.toContain(COORDINATION_NOTICE);
    expect(renderRole("USER")).not.toContain(COORDINATION_NOTICE);
  });
});
