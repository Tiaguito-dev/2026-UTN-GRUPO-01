// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { TerminosDialog } from "@/components/terminos/TerminosDialog";

const terms = { version: "terminos-2026-11-17", secciones: [
  { titulo: "Propósito académico", parrafos: ["Compartimos experiencias propias.", "Nos ayudamos entre estudiantes."] },
  { titulo: "Privacidad", parrafos: ["Respetá los datos personales de terceros."] },
] };
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); this.querySelector<HTMLElement>("button")?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(cleanup);
describe("HU-C05 visor compartido de términos", () => {
  it("muestra el documento completo recibido sin agregar aceptación", () => {
    render(<TerminosDialog documento={terms} onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Términos y condiciones" });
    expect(within(dialog).getByText(`Versión ${terms.version}`)).toBeTruthy();
    expect(dialog.contains(document.activeElement)).toBe(true);
    const region = within(dialog).getByRole("region", { name: "Texto de los términos y condiciones" });
    expect(region.tabIndex).toBe(0);
    for (const section of terms.secciones) {
      expect(within(dialog).getByRole("heading", { name: section.titulo })).toBeTruthy();
      for (const paragraph of section.parrafos) expect(within(dialog).getByText(paragraph)).toBeTruthy();
    }
    expect(within(dialog).queryByRole("checkbox")).toBeNull();
  });
  it("permite anunciar carga antes de recibir el documento y cerrar", () => {
    render(<TerminosDialog documento={null} onClose={vi.fn()} />);
    expect(screen.getByRole("status").textContent).toBe("Cargando términos y condiciones…");
    expect(screen.getAllByRole("button", { name: "Cerrar" })).toHaveLength(2);
  });
  it("muestra el error recibido y permite reintentar sin enviar el formulario contenedor", () => {
    const retry = vi.fn(); const submit = vi.fn();
    render(<form onSubmit={event => { event.preventDefault(); submit(); }}><TerminosDialog documento={null} error="No se pudieron cargar los términos." onRetry={retry} onClose={vi.fn()} /></form>);
    expect(screen.getByRole("alert").textContent).toContain("No se pudieron cargar los términos.");
    fireEvent.click(screen.getByRole("button", { name: "Reintentar términos y condiciones" }));
    expect(retry).toHaveBeenCalledTimes(1); expect(submit).not.toHaveBeenCalled();
  });
  it.each(["Cerrar", "X", "Escape"])("notifica el cierre por %s sin aceptar ni enviar", method => {
    const close = vi.fn(); const submit = vi.fn();
    render(<form onSubmit={event => { event.preventDefault(); submit(); }}><TerminosDialog documento={terms} onClose={close} /></form>);
    const dialog = screen.getByRole("dialog", { name: "Términos y condiciones" });
    if (method === "Escape") {
      act(() => { if (fireEvent(dialog, new Event("cancel", { cancelable: true }))) (dialog as HTMLDialogElement).close(); });
    } else {
      const buttons = within(dialog).getAllByRole("button", { name: "Cerrar" });
      fireEvent.click(method === "X" ? buttons[buttons.length - 1]! : buttons[0]!);
    }
    expect(close).toHaveBeenCalledTimes(1); expect(submit).not.toHaveBeenCalled();
  });
  it("presenta texto plano y permite identificar la región del documento sin duplicar HTML", () => {
    const text = '<img src="x" onerror="alert(1)">';
    const view = render(<TerminosDialog documento={{ ...terms, secciones: [{ titulo: "Texto seguro", parrafos: [text] }] }} documentId="terminos-test" onClose={vi.fn()} />);
    expect(screen.getByText(text)).toBeTruthy(); expect(view.container.querySelector("img")).toBeNull();
    expect(screen.getByRole("region", { name: "Texto de los términos y condiciones" }).id).toBe("terminos-test");
  });
});
