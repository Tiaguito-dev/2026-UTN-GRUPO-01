// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ComunidadPageContent } from "@/components/comunidad/ComunidadPageContent";
import { RoleTheme } from "@/components/auth/RoleTheme";
import { obtenerNormas } from "@/services/comunidad";
import { obtenerTerminosCondiciones } from "@/services/terminos";
import { HttpError } from "@/services/http";

vi.mock("@/services/comunidad", () => ({ obtenerNormas: vi.fn(), registrarSugerencia: vi.fn(), listarSugerencias: vi.fn(async () => ({ items: [], total: 0, page: 1, pageSize: 20 })) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(), useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/home/admin/comunidad" }));
vi.mock("next/link", () => import("./support/next-link"));
vi.mock("@/services/terminos", () => ({ obtenerTerminosCondiciones: vi.fn() }));
const terms = { version: "terminos-2026-11-17", secciones: [{ titulo: "Documento común", parrafos: ["Contenido del mismo documento usado en registro."] }] };
const document = {
  id: "vigentes", titulo: "Construyamos una comunidad que sume", introduccion: "Primer párrafo del equipo.\n\nSegundo párrafo constructivo.",
  normas: ["Compartí experiencias reales.", "Respetá la privacidad de los demás."],
  cierre: "Tu experiencia puede hacer la diferencia.\n\nDe estudiantes, para estudiantes.\n\n— El equipo.",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z",
};
beforeEach(() => {
  vi.clearAllMocks(); vi.mocked(obtenerNormas).mockResolvedValue(document); vi.mocked(obtenerTerminosCondiciones).mockResolvedValue(terms);
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); this.querySelector<HTMLElement>("button")?.focus(); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); this.dispatchEvent(new Event("close")); };
});
afterEach(cleanup);

describe("HU-C01 Comunidad de consulta", () => {
  it.each(["USER", "ADMIN"] as const)("HU-C05 permite a %s consultar el documento común sin alterar el resto de Comunidad", async role => {
    render(<RoleTheme status="authenticated" role={role}><ComunidadPageContent administrative={role === "ADMIN"} /></RoleTheme>);
    await screen.findByRole("heading", { name: document.titulo });
    expect(screen.getByRole("heading", { name: "Términos y condiciones" })).toBeTruthy();
    expect(obtenerTerminosCondiciones).not.toHaveBeenCalled();
    if (role === "USER") fireEvent.change(screen.getByRole("textbox", { name: "Sugerencia" }), { target: { value: "Borrador privado antes de consultar términos" } });
    const opener = screen.getByRole("button", { name: "Ver términos y condiciones" }); fireEvent.click(opener);
    await screen.findByText(`Versión ${terms.version}`);
    const dialog = screen.getByRole("dialog", { name: "Términos y condiciones" });
    expect(dialog.closest("[data-role-theme]")?.getAttribute("data-role-theme")).toBe(role === "ADMIN" ? "admin" : "student");
    fireEvent.click(within(dialog).getAllByRole("button", { name: "Cerrar" })[0]!);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); expect(globalThis.document.activeElement).toBe(opener);
    if (role === "USER") expect((screen.getByRole("textbox", { name: "Sugerencia" }) as HTMLTextAreaElement).value).toBe("Borrador privado antes de consultar términos");
    expect(screen.getByRole("heading", { name: document.titulo })).toBeTruthy();
  });

  it("HU-C05 la consulta de términos sigue disponible aunque falle la consulta de normas", async () => {
    vi.mocked(obtenerNormas).mockRejectedValue(new Error("temporary"));
    render(<ComunidadPageContent />); await screen.findByText("No pudimos cargar las normas de convivencia.");
    fireEvent.click(screen.getByRole("button", { name: "Ver términos y condiciones" }));
    expect(await screen.findByText(`Versión ${terms.version}`)).toBeTruthy();
  });
  it("HU-C04 ofrece la administración solo en la variante administrativa y muestra el éxito solicitado", async () => {
    const view = render(<ComunidadPageContent administrative updated />);
    expect(await screen.findByRole("link", { name: "Administrar normas de convivencia" })).toHaveProperty("href", expect.stringContaining("/home/admin/comunidad/editar"));
    expect(screen.getByText(/normas.*actualiz/i)).toBeTruthy();
    view.unmount(); render(<ComunidadPageContent />);
    await screen.findByRole("heading", { name: document.titulo });
    expect(screen.queryByRole("link", { name: "Administrar normas de convivencia" })).toBeNull();
    expect(screen.queryByText(/normas.*actualiz/i)).toBeNull();
  });
  it.each(["USER", "ADMIN"] as const)("muestra el mismo contenido vigente bajo el tema de %s, sin controles de edición ni feed", async role => {
    render(<RoleTheme status="authenticated" role={role}><ComunidadPageContent administrative={role === "ADMIN"} /></RoleTheme>);
    expect(await screen.findByRole("heading", { name: document.titulo })).toBeTruthy();
    const title = screen.getByRole("heading", { name: "Comunidad", level: 1 });
    expect(title.closest("[data-role-theme]")?.getAttribute("data-role-theme")).toBe(role === "ADMIN" ? "admin" : "student");
    expect(screen.getByRole("heading", { name: "Normas de convivencia" })).toBeTruthy();
    expect(screen.getByText("Primer párrafo del equipo.")).toBeTruthy();
    expect(screen.getByText("Segundo párrafo constructivo.")).toBeTruthy();
    const list = screen.getByRole("list");
    expect(within(list).getAllByRole("listitem").map(item => item.textContent)).toEqual(document.normas);
    expect(screen.getByText("De estudiantes, para estudiantes.")).toBeTruthy();
    // HU-C02 agrega solo el formulario privado de sugerencias USER; las normas siguen siendo lectura.
    expect(screen.queryAllByRole("textbox")).toHaveLength(role === "USER" ? 1 : 0);
    expect(screen.queryAllByRole("button", { name: "Enviar sugerencia" })).toHaveLength(role === "USER" ? 1 : 0);
    expect(screen.queryByRole("button", { name: /editar|guardar|publicar/i })).toBeNull();
    expect(screen.queryByText(/próximamente|Estamos preparando esta sección/i)).toBeNull();
    expect(obtenerNormas).toHaveBeenCalledTimes(1);
  });

  it("muestra carga mientras espera y no presenta normas inventadas", () => {
    vi.mocked(obtenerNormas).mockReturnValue(new Promise(() => {}));
    render(<ComunidadPageContent />);
    expect(screen.getByRole("status").textContent).toMatch(/Cargando normas de convivencia/);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("HU-C02 conserva el borrador privado cuando termina de cargar el documento de normas", async () => {
    let resolve!: (value: typeof document) => void;
    vi.mocked(obtenerNormas).mockReturnValue(new Promise(done => { resolve = done; }));
    render(<ComunidadPageContent />);
    const content = screen.getByRole("textbox", { name: "Sugerencia" });
    fireEvent.change(content, { target: { value: "Borrador mientras cargan las normas." } });
    fireEvent.change(screen.getByRole("combobox", { name: "Categoría" }), { target: { value: "OTROS" } });
    resolve(document); await screen.findByRole("heading", { name: document.titulo });
    expect((screen.getByRole("textbox", { name: "Sugerencia" }) as HTMLTextAreaElement).value).toBe("Borrador mientras cargan las normas.");
    expect((screen.getByRole("combobox", { name: "Categoría" }) as HTMLSelectElement).value).toBe("OTROS");
  });

  it("HU-C02 conserva el borrador y la categoría al reintentar una consulta de normas fallida", async () => {
    vi.mocked(obtenerNormas).mockRejectedValueOnce(new Error("temporary")).mockResolvedValueOnce(document);
    render(<ComunidadPageContent />);
    await screen.findByText("No pudimos cargar las normas de convivencia.");
    fireEvent.change(screen.getByRole("textbox", { name: "Sugerencia" }), { target: { value: "Borrador que no depende del documento." } });
    fireEvent.change(screen.getByRole("combobox", { name: "Categoría" }), { target: { value: "REPORTAR_ERROR" } });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await screen.findByRole("heading", { name: document.titulo });
    expect((screen.getByRole("textbox", { name: "Sugerencia" }) as HTMLTextAreaElement).value).toBe("Borrador que no depende del documento.");
    expect((screen.getByRole("combobox", { name: "Categoría" }) as HTMLSelectElement).value).toBe("REPORTAR_ERROR");
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
