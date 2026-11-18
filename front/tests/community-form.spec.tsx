// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NormasForm } from "@/components/comunidad/NormasForm";
import { obtenerNormas, actualizarNormas } from "@/services/comunidad";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/services/comunidad", () => ({ obtenerNormas: vi.fn(), actualizarNormas: vi.fn() }));
const document = { id: "vigentes", titulo: "Construyamos una comunidad que sume", introduccion: "Mensaje del equipo.", normas: ["Primera norma.", "Segunda norma."], cierre: "Gracias por participar.", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(obtenerNormas).mockResolvedValue(document);
  vi.mocked(actualizarNormas).mockResolvedValue(document);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); this.querySelector<HTMLElement>("button")?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
  window.history.replaceState({}, "", "/home/admin/comunidad/editar");
});
afterEach(cleanup);
async function loaded() { render(<NormasForm />); return await screen.findByRole("textbox", { name: "Título" }); }

describe("HU-C04 edición local de normas", () => {
  it("precarga todo el documento persistido sin enviar modificaciones", async () => {
    const title = await loaded() as HTMLInputElement;
    expect(title.value).toBe(document.titulo);
    expect((screen.getByRole("textbox", { name: "Mensaje introductorio" }) as HTMLTextAreaElement).value).toBe(document.introduccion);
    expect((screen.getByRole("textbox", { name: "Norma 1" }) as HTMLTextAreaElement).value).toBe(document.normas[0]);
    expect((screen.getByRole("textbox", { name: "Norma 2" }) as HTMLTextAreaElement).value).toBe(document.normas[1]);
    expect((screen.getByRole("textbox", { name: "Mensaje de cierre" }) as HTMLTextAreaElement).value).toBe(document.cierre);
    expect(actualizarNormas).not.toHaveBeenCalled();
  });

  it("cancela un formulario limpio sin confirmar ni escribir", async () => {
    await loaded(); fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(replace).toHaveBeenCalledWith("/home/admin/comunidad");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(actualizarNormas).not.toHaveBeenCalled();
  });

  it("un borrador requiere confirmar salida y seguir editando conserva los campos", async () => {
    const title = await loaded(); fireEvent.change(title, { target: { value: "Borrador sin guardar" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect((screen.getByRole("textbox", { name: "Título" }) as HTMLInputElement).value).toBe("Borrador sin guardar");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Descartar y salir" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home/admin/comunidad"));
    expect(actualizarNormas).not.toHaveBeenCalled();
  });

  it("permite agregar, reordenar y quitar normas, enviando su orden visible sin metadatos", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Agregar norma" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Norma 3" }), { target: { value: " Tercera norma nueva. " } });
    fireEvent.click(screen.getByRole("button", { name: "Subir norma 3" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar norma 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(actualizarNormas).toHaveBeenCalledExactlyOnceWith({ titulo: document.titulo, introduccion: document.introduccion, normas: ["Tercera norma nueva.", "Segunda norma."], cierre: document.cierre }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/home/admin/comunidad?actualizada=1"));
  });

  it("impide guardar texto vacío y enfoca el primer campo inválido", async () => {
    const title = await loaded(); fireEvent.change(title, { target: { value: " " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarNormas).not.toHaveBeenCalled();
    await waitFor(() => expect(globalThis.document.activeElement).toBe(title));
  });

  it.each([
    ["Título", "x".repeat(161)], ["Mensaje introductorio", " \n "], ["Mensaje de cierre", " "], ["Norma 1", " "],
  ])("valida %s antes de enviar", async (label, value) => {
    await loaded(); fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(actualizarNormas).not.toHaveBeenCalled();
  });

  it("intercepta enlaces al abandonar y permite conservar el borrador", async () => {
    render(<><a href="/account">Perfil de prueba</a><NormasForm /></>);
    const title = await screen.findByRole("textbox", { name: "Título" });
    fireEvent.change(title, { target: { value: "Borrador del administrador" } });
    fireEvent.click(screen.getByRole("link", { name: "Perfil de prueba" }));
    expect(screen.getByRole("dialog", { name: "Descartar cambios" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect((title as HTMLInputElement).value).toBe("Borrador del administrador");
    expect(replace).not.toHaveBeenCalled();
  });

  it("protege recarga/cierre solo con cambios y limpia los listeners al desmontar", async () => {
    const view = render(<NormasForm />);
    const title = await screen.findByRole("textbox", { name: "Título" });
    const clean = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(clean); expect(clean.defaultPrevented).toBe(false);
    fireEvent.change(title, { target: { value: "Borrador protegido" } });
    const dirty = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(dirty); expect(dirty.defaultPrevented).toBe(true);
    view.unmount();
    const gone = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(gone); expect(gone.defaultPrevented).toBe(false);
  });

  it("confirma el cierre de sesión manual y vuelve a proteger el borrador si el cierre falla", async () => {
    const logout = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<><div className="logout-control"><button type="button" onClick={logout}>Cerrar sesión de prueba</button></div><NormasForm /></>);
    const title = await screen.findByRole("textbox", { name: "Título" });
    fireEvent.change(title, { target: { value: "Borrador antes de cerrar sesión" } });
    const button = screen.getByRole("button", { name: "Cerrar sesión de prueba" });
    fireEvent.click(button);
    expect(logout).not.toHaveBeenCalled();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect((title as HTMLInputElement).value).toBe("Borrador antes de cerrar sesión");
    confirm.mockReturnValue(true);
    fireEvent.click(button);
    await waitFor(() => expect(logout).toHaveBeenCalledTimes(1));
    // El botón simula un logout fallido: no navega ni desmonta; el guard debe seguir activo.
    confirm.mockReturnValue(false);
    fireEvent.click(button);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(confirm).toHaveBeenCalledTimes(3);
    expect((title as HTMLInputElement).value).toBe("Borrador antes de cerrar sesión");
    expect(actualizarNormas).not.toHaveBeenCalled();
  });

  it("conserva borrador y orden ante error y permite reintentar", async () => {
    vi.mocked(actualizarNormas).mockRejectedValueOnce(new Error("No se pudo guardar.")).mockResolvedValueOnce(document);
    const title = await loaded(); fireEvent.change(title, { target: { value: "Texto a conservar" } });
    fireEvent.click(screen.getByRole("button", { name: "Subir norma 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(actualizarNormas).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((screen.getByRole("button", { name: "Guardar cambios" }) as HTMLButtonElement).disabled).toBe(false));
    expect((screen.getByRole("textbox", { name: "Título" }) as HTMLInputElement).value).toBe("Texto a conservar");
    expect((screen.getByRole("textbox", { name: "Norma 1" }) as HTMLTextAreaElement).value).toBe("Segunda norma.");
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(actualizarNormas).toHaveBeenCalledTimes(2));
    expect(vi.mocked(actualizarNormas).mock.calls[0]).toEqual(vi.mocked(actualizarNormas).mock.calls[1]);
  });

  it("bloquea doble envío y edición mientras guarda", async () => {
    let resolve!: (value: typeof document) => void;
    vi.mocked(actualizarNormas).mockReturnValue(new Promise(done => { resolve = done; }));
    const title = await loaded(); fireEvent.change(title, { target: { value: "Edición única" } });
    const save = screen.getByRole("button", { name: "Guardar cambios" });
    fireEvent.click(save); fireEvent.click(save);
    expect(actualizarNormas).toHaveBeenCalledTimes(1);
    expect(title.matches(":disabled")).toBe(true);
    expect(save.matches(":disabled")).toBe(true);
    await act(async () => { resolve(document); });
  });
});
