// @vitest-environment jsdom
import { useContext } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthContext, AuthProvider } from "@/components/auth/AuthProvider";
import { HttpError } from "@/services/http";
import type { PublicAccount } from "@/types/auth";

const { service, router } = vi.hoisted(() => ({ service: {
  me: vi.fn(), probe: vi.fn(), login: vi.fn(), logout: vi.fn(),
  coordinator: { available: true, read: vi.fn(), subscribe: vi.fn() },
}, router: { replace: vi.fn() } }));
vi.mock("@/services/auth", () => ({ getAuthService: () => service }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/services/session", () => ({ getSessionService: () => ({ getEndReason: () => null }) }));
// El monitor ya tiene pruebas de su política; aquí importa que su diálogo herede el mismo tema.
vi.mock("@/components/auth/SessionIdleMonitor", () => ({ SessionIdleMonitor: () => <div role="dialog" aria-label="Control de sesión">Aviso compartido</div> }));

const admin: PublicAccount = { id: "admin-theme", email: "admin@example.test", displayName: "Administrador", role: "ADMIN" };
const student: PublicAccount = { ...admin, id: "user-theme", role: "USER" };

function Content() {
  const auth = useContext(AuthContext)!;
  return <>
    <p>Cuenta: {auth.account?.role ?? "ninguna"}</p>
    <p>Estado: {auth.status}</p>
    <button type="button" onClick={() => { void auth.checkSession(); }}>Recomprobar</button>
    <button type="button" onClick={() => { void auth.logout().catch(() => {}); }}>Salir</button>
    <button type="button" onClick={() => { void auth.login({ email: student.email, password: "mock-password" }); }}>Entrar estudiante</button>
  </>;
}
function renderSession() { return render(<AuthProvider><Content /></AuthProvider>); }
function currentTheme() { return screen.getByText(/^Cuenta:/).closest("[data-role-theme]")?.getAttribute("data-role-theme"); }

beforeEach(() => {
  vi.resetAllMocks();
  service.me.mockResolvedValue(admin);
  service.coordinator.read.mockReturnValue(null);
  service.coordinator.subscribe.mockReturnValue(() => {});
  service.logout.mockImplementation(async (done: () => void) => { done(); });
  service.login.mockImplementation(async (_input: unknown, done: (account: PublicAccount) => void) => { done(student); return student; });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
});
afterEach(cleanup);

describe("Tema transversal conectado a la sesión real del provider", () => {
  it("la comprobación inicial y la recarga no muestran tema de estudiante antes de confirmar ADMIN", async () => {
    let resolve!: (account: PublicAccount) => void;
    service.me.mockReturnValueOnce(new Promise<PublicAccount>(done => { resolve = done; }));
    const first = renderSession();
    expect(currentTheme()).toBe("pending");
    await act(async () => { resolve(admin); });
    expect(currentTheme()).toBe("admin");
    first.unmount();
    renderSession();
    await waitFor(() => expect(currentTheme()).toBe("admin"));
  });

  it("el contenido de cualquier página y el aviso de sesión comparten el ámbito del tema", async () => {
    renderSession();
    await screen.findByText("Cuenta: ADMIN");
    const wrapper = screen.getByText("Cuenta: ADMIN").closest("[data-role-theme]");
    expect(wrapper?.getAttribute("data-role-theme")).toBe("admin");
    expect(screen.getByRole("dialog", { name: "Control de sesión" }).closest("[data-role-theme]")).toBe(wrapper);
  });

  it("un error temporal mantiene la cuenta pero retira el tema ADMIN hasta revalidar", async () => {
    renderSession(); await screen.findByText("Cuenta: ADMIN");
    service.me.mockRejectedValueOnce(new HttpError(0, "Sin conexión"));
    fireEvent.click(screen.getByRole("button", { name: "Recomprobar" }));
    await screen.findByText("Estado: temporary-error");
    await waitFor(() => expect(currentTheme()).toBe("pending"));
    expect(screen.getByText("Cuenta: ADMIN")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Recomprobar" }));
    await waitFor(() => expect(currentTheme()).toBe("admin"));
  });

  it("logout confirmado restaura público y un login USER no hereda el bordó administrativo", async () => {
    renderSession(); await screen.findByText("Cuenta: ADMIN");
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    await waitFor(() => expect(currentTheme()).toBe("public"));
    fireEvent.click(screen.getByRole("button", { name: "Entrar estudiante" }));
    await waitFor(() => expect(currentTheme()).toBe("student"));
  });

  it("un logout fallido no finge cierre ni cambia la identidad de la cuenta vigente", async () => {
    renderSession(); await screen.findByText("Cuenta: ADMIN");
    service.logout.mockRejectedValueOnce(new HttpError(0, "Sin conexión"));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Salir" })); });
    expect(currentTheme()).toBe("admin");
    expect(screen.getByText("Cuenta: ADMIN")).toBeTruthy();
  });

  it("una revalidación que devuelve otro rol cambia tema sin recrear la página", async () => {
    renderSession(); await screen.findByText("Cuenta: ADMIN");
    service.me.mockResolvedValueOnce(student);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(currentTheme()).toBe("student"));
    expect(screen.getByText("Cuenta: USER")).toBeTruthy();
  });
});
