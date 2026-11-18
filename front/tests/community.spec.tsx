// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ComunidadPageContent } from "@/components/comunidad/ComunidadPageContent";
import { RoleTheme } from "@/components/auth/RoleTheme";
import { obtenerNormas } from "@/services/comunidad";
import { HttpError } from "@/services/http";

vi.mock("@/services/comunidad", () => ({ obtenerNormas: vi.fn() }));
const document = {
  id: "vigentes", titulo: "Construyamos una comunidad que sume", introduccion: "Primer párrafo del equipo.\n\nSegundo párrafo constructivo.",
  normas: ["Compartí experiencias reales.", "Respetá la privacidad de los demás."],
  cierre: "Tu experiencia puede hacer la diferencia.\n\nDe estudiantes, para estudiantes.\n\n— El equipo.",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
};
beforeEach(() => { vi.clearAllMocks(); vi.mocked(obtenerNormas).mockResolvedValue(document); });
afterEach(cleanup);

describe("HU-C01 Comunidad de consulta", () => {
  it.each(["USER", "ADMIN"] as const)("muestra el mismo contenido vigente bajo el tema de %s, sin controles de edición ni feed", async role => {
    render(<RoleTheme status="authenticated" role={role}><ComunidadPageContent /></RoleTheme>);
    expect(await screen.findByRole("heading", { name: document.titulo })).toBeTruthy();
    const title = screen.getByRole("heading", { name: "Comunidad", level: 1 });
    expect(title.closest("[data-role-theme]")?.getAttribute("data-role-theme")).toBe(role === "ADMIN" ? "admin" : "student");
    expect(screen.getByRole("heading", { name: "Normas de convivencia" })).toBeTruthy();
    expect(screen.getByText("Primer párrafo del equipo.")).toBeTruthy();
    expect(screen.getByText("Segundo párrafo constructivo.")).toBeTruthy();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem").map(item => item.textContent)).toEqual(document.normas);
    expect(screen.getByText("De estudiantes, para estudiantes.")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /editar|guardar|enviar|publicar/i })).toBeNull();
    expect(screen.queryByText(/próximamente|Estamos preparando esta sección/i)).toBeNull();
    expect(obtenerNormas).toHaveBeenCalledTimes(1);
  });

  it("muestra carga mientras espera y no presenta normas inventadas", () => {
    vi.mocked(obtenerNormas).mockReturnValue(new Promise(() => {}));
    render(<ComunidadPageContent />);
    expect(screen.getByRole("status").textContent).toMatch(/Cargando normas de convivencia/);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("permite reintentar un fallo sin descartar la estructura de la página", async () => {
    vi.mocked(obtenerNormas).mockRejectedValueOnce(new Error("secret database detail")).mockResolvedValueOnce(document);
    render(<ComunidadPageContent />);
    expect(await screen.findByText("No pudimos cargar las normas de convivencia.")).toBeTruthy();
    expect(screen.queryByText(/secret database detail/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("heading", { name: document.titulo })).toBeTruthy();
    expect(obtenerNormas).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("heading", { name: "Comunidad", level: 1 })).toBeTruthy();
  });

  it("informa ausencia del documento y permite consultar nuevamente", async () => {
    vi.mocked(obtenerNormas).mockRejectedValue(new HttpError(404, "Not found"));
    render(<ComunidadPageContent />);
    expect(await screen.findByText("Todavía no hay normas de convivencia disponibles.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(obtenerNormas).toHaveBeenCalledTimes(2));
  });

  it("presenta el contenido persistido como texto sin ejecutar HTML", async () => {
    vi.mocked(obtenerNormas).mockResolvedValue({ ...document, normas: ['<img src="x" onerror="alert(1)">'] });
    const view = render(<ComunidadPageContent />);
    expect(await screen.findByText('<img src="x" onerror="alert(1)">')).toBeTruthy();
    expect(view.container.querySelector("img")).toBeNull();
  });
});
