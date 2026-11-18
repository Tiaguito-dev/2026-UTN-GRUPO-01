// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AccountForm } from "@/components/auth/AccountForm";
import { obtenerTerminosCondiciones } from "@/services/terminos";
import { HttpError } from "@/services/http";

const { register, replace } = vi.hoisted(() => ({ register: vi.fn(), replace: vi.fn() }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ register, coordinationAvailable: true }) }));
vi.mock("@/services/terminos", () => ({ obtenerTerminosCondiciones: vi.fn() }));
const terms = { version: "terminos-2026-11-17", secciones: [
  { titulo: "Propósito académico", parrafos: ["Compartimos experiencias académicas propias."] },
  { titulo: "Privacidad", parrafos: ["El anonimato público no elimina la vinculación interna con la cuenta."] },
] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obtenerTerminosCondiciones).mockResolvedValue(terms);
  register.mockResolvedValue({ id: "u1" });
  window.history.replaceState({}, "", "/register");
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
    this.querySelector<HTMLElement>("button, a[href], input")?.focus();
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open"); this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);
async function fill() {
  await userEvent.type(screen.getByRole("textbox", { name: "Email" }), "estudiante@alu.frlp.utn.edu.ar");
  await userEvent.type(screen.getByRole("textbox", { name: "Nombre visible" }), "Estudiante");
  await userEvent.type(screen.getByLabelText("Contraseña"), "contraseña segura");
}
describe("Términos en registro", () => {
  it("empieza desmarcado, bloquea el alta y envía aceptación y versión solo al marcar", async () => {
    render(<AccountForm mode="register" />);
    const checkbox = await screen.findByRole("checkbox", { name: /He leído y acepto los Términos y condiciones/ }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    await fill();
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(await screen.findByText("Debés aceptar los términos y condiciones para crear tu cuenta")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() => expect(register).toHaveBeenCalledExactlyOnceWith({ email: "estudiante@alu.frlp.utn.edu.ar", displayName: "Estudiante", password: "contraseña segura", aceptaTerminos: true, versionTerminos: terms.version }));
  });

  it.each(["Cerrar", "X", "Escape"])("lee el documento y cierra con %s sin enviar, aceptar ni perder datos; restaura foco", async method => {
    render(<AccountForm mode="register" />);
    const checkbox = await screen.findByRole("checkbox") as HTMLInputElement;
    await fill();
    const link = screen.getByRole("link", { name: "Términos y condiciones" });
    await userEvent.click(link);
    const dialog = screen.getByRole("dialog", { name: "Términos y condiciones" });
    expect(dialog.contains(document.activeElement)).toBe(true);
    for (const section of terms.secciones) {
      expect(within(dialog).getByRole("heading", { name: section.titulo })).toBeTruthy();
      for (const paragraph of section.parrafos) expect(within(dialog).getByText(paragraph)).toBeTruthy();
    }
    expect(checkbox.checked).toBe(false);
    expect(register).not.toHaveBeenCalled();
    if (method === "Escape") {
      act(() => { if (fireEvent(dialog, new Event("cancel", { cancelable: true }))) (dialog as HTMLDialogElement).close(); });
    } else {
      const close = within(dialog).getAllByRole("button", { name: "Cerrar" });
      await userEvent.click(method === "X" ? close[close.length - 1]! : close[0]!);
    }
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(link);
    expect((screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement).value).toBe("estudiante@alu.frlp.utn.edu.ar");
    expect((screen.getByRole("textbox", { name: "Nombre visible" }) as HTMLInputElement).value).toBe("Estudiante");
    expect((screen.getByLabelText("Contraseña") as HTMLInputElement).value).toBe("contraseña segura");
    expect(checkbox.checked).toBe(false);
    expect(register).not.toHaveBeenCalled();
  });

  it("un error al cargar términos no permite registrar un documento no mostrado", async () => {
    vi.mocked(obtenerTerminosCondiciones).mockRejectedValue(new Error("No se pudieron cargar los términos"));
    render(<AccountForm mode="register" />);
    await screen.findByText(/No se pudieron cargar los términos/);
    await fill();
    fireEvent.submit(screen.getByRole("button", { name: "Crear cuenta" }).closest("form")!);
    await waitFor(() => expect(register).not.toHaveBeenCalled());
  });

  it("si cambia la versión, recarga el documento y exige otra aceptación conservando los campos", async () => {
    vi.mocked(obtenerTerminosCondiciones).mockResolvedValueOnce(terms).mockResolvedValueOnce({ ...terms, version: "terminos-nuevos" });
    register.mockRejectedValueOnce(new HttpError(400, "Los términos y condiciones cambiaron. Leelos nuevamente y aceptá la versión vigente."));
    render(<AccountForm mode="register" />);
    const checkbox = await screen.findByRole("checkbox") as HTMLInputElement;
    await fill();
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() => expect(obtenerTerminosCondiciones).toHaveBeenCalledTimes(2));
    expect(checkbox.checked).toBe(false);
    expect((screen.getByLabelText("Contraseña") as HTMLInputElement).value).toBe("contraseña segura");
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    await waitFor(() => expect(register).toHaveBeenLastCalledWith(expect.objectContaining({ versionTerminos: "terminos-nuevos", aceptaTerminos: true })));
  });
});
