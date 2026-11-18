// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ComunidadTerminos } from "@/components/comunidad/ComunidadTerminos";
import { obtenerTerminosCondiciones } from "@/services/terminos";

vi.mock("@/services/terminos", () => ({ obtenerTerminosCondiciones: vi.fn() }));
const terms = { version: "terminos-2026-11-17", secciones: [{ titulo: "Propósito", parrafos: ["El documento vigente se consulta sin volver a aceptarlo."] }] };
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(obtenerTerminosCondiciones).mockResolvedValue(terms);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); this.querySelector<HTMLElement>("button")?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(cleanup);

describe("HU-C05 consulta de términos desde Comunidad", () => {
  it("ofrece la consulta común sin cargar anticipadamente ni solicitar consentimiento", () => {
    render(<ComunidadTerminos />);
    expect(screen.getByRole("heading", { name: "Términos y condiciones" })).toBeTruthy();
    expect(screen.getByText("Consultá las condiciones de uso de nuestra plataforma.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver términos y condiciones" })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull(); expect(obtenerTerminosCondiciones).not.toHaveBeenCalled();
  });

  it.each(["Cerrar", "X", "Escape"])("abre el documento y cierra por %s devolviendo el foco al disparador", async method => {
    render(<ComunidadTerminos />);
    const opener = screen.getByRole("button", { name: "Ver términos y condiciones" }); fireEvent.click(opener);
    const dialog = await screen.findByRole("dialog", { name: "Términos y condiciones" });
    expect(await within(dialog).findByText(terms.secciones[0]!.parrafos[0]!)).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    if (method === "Escape") {
      act(() => { if (fireEvent(dialog, new Event("cancel", { cancelable: true }))) (dialog as HTMLDialogElement).close(); });
    } else {
      const buttons = within(dialog).getAllByRole("button", { name: "Cerrar" }); fireEvent.click(method === "X" ? buttons[buttons.length - 1]! : buttons[0]!);
    }
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(opener); expect(obtenerTerminosCondiciones).toHaveBeenCalledTimes(1);
  });

  it("cada apertura consulta la versión vigente en vez de reutilizar una copia anterior", async () => {
    vi.mocked(obtenerTerminosCondiciones).mockResolvedValueOnce(terms).mockResolvedValueOnce({ ...terms, version: "terminos-actualizados" });
    render(<ComunidadTerminos />);
    fireEvent.click(screen.getByRole("button", { name: "Ver términos y condiciones" }));
    await screen.findByText(`Versión ${terms.version}`);
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Cerrar" })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Ver términos y condiciones" }));
    await screen.findByText("Versión terminos-actualizados"); expect(obtenerTerminosCondiciones).toHaveBeenCalledTimes(2);
  });

  it("un error permite reintentar y también cerrar sin aceptar nada", async () => {
    vi.mocked(obtenerTerminosCondiciones).mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce(terms);
    render(<ComunidadTerminos />); fireEvent.click(screen.getByRole("button", { name: "Ver términos y condiciones" }));
    await screen.findByRole("alert"); const retry = screen.getByRole("button", { name: "Reintentar términos y condiciones" }); retry.focus(); fireEvent.click(retry);
    await screen.findByText(`Versión ${terms.version}`); expect(obtenerTerminosCondiciones).toHaveBeenCalledTimes(2); expect(screen.queryByRole("checkbox")).toBeNull();
    await waitFor(() => expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true));
  });

  it("cerrar una carga pendiente invalida su respuesta aunque se abra otro documento mientras tanto", async () => {
    let resolveOld!: (value: typeof terms) => void; let resolveNew!: (value: typeof terms) => void;
    vi.mocked(obtenerTerminosCondiciones).mockReturnValueOnce(new Promise(done => { resolveOld = done; })).mockReturnValueOnce(new Promise(done => { resolveNew = done; }));
    render(<ComunidadTerminos />); const opener = screen.getByRole("button", { name: "Ver términos y condiciones" });
    fireEvent.click(opener); expect(screen.getByRole("status").textContent).toBe("Cargando términos y condiciones…");
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Cerrar" })[0]!);
    expect(screen.queryByRole("dialog")).toBeNull(); fireEvent.click(opener);
    await act(async () => { resolveNew({ ...terms, version: "nueva-vigente" }); });
    expect(screen.getByText("Versión nueva-vigente")).toBeTruthy();
    await act(async () => { resolveOld(terms); });
    expect(screen.getByText("Versión nueva-vigente")).toBeTruthy(); expect(screen.queryByText(`Versión ${terms.version}`)).toBeNull();
  });

  it("desmontar durante una consulta pendiente no permite que aparezca luego el modal", async () => {
    let resolve!: (value: typeof terms) => void; vi.mocked(obtenerTerminosCondiciones).mockReturnValue(new Promise(done => { resolve = done; }));
    const view = render(<ComunidadTerminos />); fireEvent.click(screen.getByRole("button", { name: "Ver términos y condiciones" })); view.unmount();
    await act(async () => { resolve(terms); }); expect(screen.queryByRole("dialog")).toBeNull();
  });
});
