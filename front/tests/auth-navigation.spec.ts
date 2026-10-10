import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { RequireAuth } from "../src/components/auth/RequireAuth";

const { state } = vi.hoisted(() => ({ state: { value: {} as Record<string, unknown> } }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => state.value }));
vi.mock("next/navigation", () => ({ usePathname: () => "/account", useRouter: () => ({ replace: vi.fn() }) }));

function render(status: string, role = "USER", temporaryError?: string) {
  state.value = { status, account: status === "authenticated" ? { id: "public-id", role } : null, error: temporaryError,
    checkSession: vi.fn(), coordinationAvailable: true };
  return renderToStaticMarkup(createElement(RequireAuth, { roles: ["ADMIN"], children: createElement("span", null, "Contenido administrativo de prueba") }));
}
describe("Navegación protegida sin rutas administrativas ficticias", () => {
  it("distingue comprobación inicial, sin sesión y error temporal", () => {
    expect(render("checking")).toContain("Comprobando sesión");
    expect(render("anonymous")).toContain("iniciar sesión");
    const temporary = render("temporary-error", "USER", "Comunicación temporalmente indisponible.");
    expect(temporary).toContain("Comunicación temporalmente indisponible."); expect(temporary).toContain("Reintentar comprobación");
  });
  it("ADMIN ve contenido declarado y USER recibe rechazo de permisos", () => {
    expect(render("authenticated", "ADMIN")).toContain("Contenido administrativo de prueba");
    const rejected = render("authenticated", "USER"); expect(rejected).toContain("no tiene permisos");
    expect(rejected).not.toContain("Contenido administrativo de prueba");
  });
});
