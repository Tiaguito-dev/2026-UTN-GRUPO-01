// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Page from "@/app/page";
import { listarExperienciasExplorador, listarMateriasExplorador } from "@/services/subject-preview";

vi.mock("next/link", () => import("./support/next-link"));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ status: "anonymous", account: null }) }));
vi.mock("@/services/subject-preview", () => ({ listarExperienciasExplorador: vi.fn(), listarMateriasExplorador: vi.fn() }));
afterEach(cleanup);

const algebra = { id: "materia-a", nombre: "Álgebra" };
const fisica = { id: "materia-b", nombre: "Física" };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listarMateriasExplorador).mockResolvedValue({ items: [algebra] });
  vi.mocked(listarExperienciasExplorador).mockResolvedValue({ items: Array.from({ length: 5 }, (_, index) => ({
    id: `experiencia-${index + 1}`, texto: `Comentario público ${index + 1}`,
    createdAt: `2026-11-0${5 - index}T12:00:00.000Z`, materia: algebra,
  })) });
});

function loginReturnLinks(links: HTMLElement[]) {
  return links.map((link) => link.getAttribute("href")).filter((href) => href?.startsWith("/login")).map((href) => new URL(href!, "http://localhost").searchParams.get("returnTo"));
}

describe("Bienvenida pública", () => {
  it("explora el catálogo sin pedir experiencias", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Explorar materias" }));
    const search = await screen.findByRole("button", { name: /buscar/i });
    const query = screen.getByRole("searchbox");
    await user.type(query, "Álgebra");
    await user.click(search);
    expect(await screen.findByText("Álgebra")).toBeTruthy();
    expect(listarMateriasExplorador).toHaveBeenCalledWith("Álgebra");
    expect(listarExperienciasExplorador).not.toHaveBeenCalled();
  });

  it("busca y elige una materia antes de leer sus cinco publicaciones", async () => {
    const user = userEvent.setup();
    vi.mocked(listarMateriasExplorador).mockResolvedValue({ items: [algebra, fisica] });
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Leer experiencias" }));
    expect(listarExperienciasExplorador).not.toHaveBeenCalled();
    await user.type(screen.getByRole("searchbox"), "Álgebra");
    await user.click(screen.getByRole("button", { name: /buscar/i }));
    const result = await screen.findByRole("button", { name: "Álgebra" });
    expect(listarMateriasExplorador).toHaveBeenCalledWith("Álgebra");
    expect(listarExperienciasExplorador).not.toHaveBeenCalled();
    await user.click(result);
    await screen.findByText("Comentario público 5");
    expect(screen.getAllByText(/Comentario público/)).toHaveLength(5);
    expect(listarExperienciasExplorador).toHaveBeenCalledWith(algebra.id);
    expect(screen.queryByRole("button", { name: /siguiente|ver más/i })).toBeNull();
    expect(loginReturnLinks(screen.getAllByRole("link"))).toContain(`/home/experiencias?materiaId=${algebra.id}`);
  });

  it("pide iniciar sesión para compartir y conserva el retorno al catálogo", async () => {
    const user = userEvent.setup();
    render(<Page />);
    await user.click(screen.getByRole("button", { name: "Compartir mi experiencia" }));
    expect(loginReturnLinks(screen.getAllByRole("link"))).toContain("/home/materias");
    await user.click(screen.getByRole("button", { name: "Volver a las opciones" }));
    expect(screen.getByRole("button", { name: "Leer experiencias" })).toBeTruthy();
  });
});
