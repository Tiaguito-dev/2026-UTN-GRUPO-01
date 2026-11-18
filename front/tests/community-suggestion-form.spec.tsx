// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SugerenciaForm } from "@/components/comunidad/SugerenciaForm";
import { registrarSugerencia } from "@/services/comunidad";
import { HttpError } from "@/services/http";

vi.mock("@/services/comunidad", () => ({ registrarSugerencia: vi.fn() }));
const receipt = { id: "be6a4090-7221-4340-aacc-27715417dd1c", createdAt: "2026-11-18T10:00:00.000Z" };
const success = "¡Gracias por tu sugerencia! Tu opinión nos ayuda a seguir mejorando Professors' Butchery.";
beforeEach(() => { vi.resetAllMocks(); vi.mocked(registrarSugerencia).mockResolvedValue(receipt); });
afterEach(cleanup);
function fill(content = "Una mejora privada.", category = "OTROS") {
  fireEvent.change(screen.getByRole("combobox", { name: "Categoría" }), { target: { value: category } });
  fireEvent.change(screen.getByRole("textbox", { name: "Sugerencia" }), { target: { value: content } });
}
function submit() { fireEvent.click(screen.getByRole("button", { name: "Enviar sugerencia" })); }
describe("HU-C02 formulario privado de sugerencias", () => {
  it("presenta categoría obligatoria sin elección inicial y contenido vacío", () => {
    render(<SugerenciaForm />);
    const category = screen.getByRole("combobox") as HTMLSelectElement;
    const content = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(category.value).toBe(""); expect(category.required).toBe(true);
    expect(content.value).toBe(""); expect(content.required).toBe(true);
    expect(content.maxLength).toBe(5000);
    expect(Array.from(category.options).filter(option => option.value).map(option => option.textContent)).toEqual(["Mejora de la plataforma", "Nueva funcionalidad", "Reportar un error", "Corrección de información académica", "Otros"]);
    expect(screen.getByText("Solo los administradores podrán leer tu sugerencia.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Dale una sugerencia a los creadores." })).toBeTruthy();
  });

  it("envía categoría y contenido normalizado con una clave, agradece y limpia completamente", async () => {
    render(<SugerenciaForm />); fill(" Idea uno.\n\nIdea dos. ", "MEJORA_PLATAFORMA"); submit();
    expect(await screen.findByText(success)).toBeTruthy();
    expect(registrarSugerencia).toHaveBeenCalledExactlyOnceWith({ solicitudId: expect.any(String), categoria: "MEJORA_PLATAFORMA", contenido: "Idea uno.\n\nIdea dos." });
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("otra sugerencia legítima posterior usa una clave nueva", async () => {
    render(<SugerenciaForm />); fill(); submit(); await screen.findByText(success);
    fill("Otra idea legítima."); submit(); await waitFor(() => expect(registrarSugerencia).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(registrarSugerencia).mock.calls;
    expect(calls[1]![0].solicitudId).not.toBe(calls[0]![0].solicitudId);
  });

  it("falla sin perder borrador y el reintento idéntico conserva la misma clave", async () => {
    vi.mocked(registrarSugerencia).mockRejectedValueOnce(new HttpError(503, "Fallo temporal")).mockResolvedValueOnce(receipt);
    render(<SugerenciaForm />); fill("Borrador que debe conservarse.", "REPORTAR_ERROR"); submit(); await screen.findByRole("alert");
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Borrador que debe conservarse.");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("REPORTAR_ERROR");
    submit(); await screen.findByText(success);
    const calls = vi.mocked(registrarSugerencia).mock.calls;
    expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
  });

  it.each(["contenido", "categoria"])("requiere una nueva operación explícita si cambia %s después de un envío incierto", async field => {
    vi.mocked(registrarSugerencia).mockRejectedValueOnce(new HttpError(0, "Respuesta perdida")).mockResolvedValueOnce(receipt);
    render(<SugerenciaForm />); fill(); submit(); await screen.findByRole("alert");
    if (field === "contenido") fireEvent.change(screen.getByRole("textbox"), { target: { value: "Una idea diferente" } });
    else fireEvent.change(screen.getByRole("combobox"), { target: { value: "NUEVA_FUNCIONALIDAD" } });
    submit(); expect(await screen.findByText("Para enviar otro contenido, elegí Nueva sugerencia.")).toBeTruthy();
    expect(registrarSugerencia).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Nueva sugerencia" })); submit();
    await screen.findByText(success); expect(registrarSugerencia).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(registrarSugerencia).mock.calls;
    expect(calls[1]![0].solicitudId).not.toBe(calls[0]![0].solicitudId);
  });

  it.each([["", "Texto válido"], ["OTROS", " \n "], ["OTROS", "x".repeat(5001)]])("valida categoría/contenido antes de solicitar y enfoca el error", async (category, content) => {
    render(<SugerenciaForm />); fill(content, category); submit();
    expect(registrarSugerencia).not.toHaveBeenCalled();
    const invalid = category ? screen.getByRole("textbox") : screen.getByRole("combobox");
    await waitFor(() => expect(document.activeElement).toBe(invalid));
  });

  it("acepta 5000 caracteres y bloquea doble envío y edición mientras guarda", async () => {
    let resolve!: (value: typeof receipt) => void;
    vi.mocked(registrarSugerencia).mockReturnValue(new Promise(done => { resolve = done; }));
    render(<SugerenciaForm />); fill("x".repeat(5000));
    const button = screen.getByRole("button", { name: "Enviar sugerencia" }); fireEvent.click(button); fireEvent.click(button);
    expect(registrarSugerencia).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("textbox").matches(":disabled")).toBe(true);
    expect(screen.getByRole("combobox").matches(":disabled")).toBe(true);
    expect(button.matches(":disabled")).toBe(true);
    await act(async () => { resolve(receipt); });
  });

  it("no guarda sugerencias privadas en almacenamiento del navegador", async () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    render(<SugerenciaForm />); fill("Contenido privado sin persistencia local."); submit(); await screen.findByText(success);
    expect(storage).not.toHaveBeenCalled();
  });
});
