// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import userEvent from "@testing-library/user-event";

afterEach(cleanup);

describe("Breadcrumb", () => {
  it("ofrece un regreso interno independiente, conserva filtros y permite recorrer los enlaces con teclado", async () => {
    render(<Breadcrumb items={[{ label: "Materias", href: "/home/materias?carrera=S&page=2" }, { label: "Materia de nombre muy largo ".repeat(12) }]} />);
    const back = screen.getByRole("link", { name: "Volver a Materias" });
    expect(back.getAttribute("href")).toBe("/home/materias?carrera=S&page=2");
    expect(screen.getByRole("navigation").contains(back)).toBe(false);
    await userEvent.tab();
    expect(document.activeElement).toBe(back);
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Materias" }));
    expect(screen.getByText("Materia de nombre muy largo ".repeat(12).trim()).textContent).toBe("Materia de nombre muy largo ".repeat(12));
  });
  it("descarta un origen externo y marca solo el último elemento como página actual", () => {
    render(<Breadcrumb back={{ href: "//example.com", label: "Origen" }} items={[{ label: "Materias", href: "/home/materias" }, { label: "Contexto pendiente" }, { label: "Comentario" }]} />);
    expect(screen.getByRole("link", { name: "Volver a Materias" }).getAttribute("href")).toBe("/home/materias");
    expect(document.querySelectorAll('[aria-current="page"]').length).toBe(1);
    expect(screen.getByText("Contexto pendiente").hasAttribute("aria-current")).toBe(false);
    expect(screen.getByRole("navigation").querySelector(".lucide-chevron-right")).toBeTruthy();
  });
  it("el último ítem es aria-current='page' y no es enlace; los demás son enlaces; separadores con aria-hidden", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Materias", href: "/home/materias" },
          { label: "Paradigmas de Programación", href: "/home/materias/1" },
          { label: "2026 - 1C" },
        ]}
      />
    );

    const nav = screen.getByRole("navigation", { name: "Ubicación actual" });
    expect(nav).toBeTruthy();

    const materiasLink = screen.getByRole("link", { name: "Materias" });
    expect(materiasLink.getAttribute("href")).toBe("/home/materias");

    const paradigmasLink = screen.getByRole("link", { name: "Paradigmas de Programación" });
    expect(paradigmasLink.getAttribute("href")).toBe("/home/materias/1");

    expect(screen.queryByRole("link", { name: "2026 - 1C" })).toBeNull();
    const current = screen.getByText("2026 - 1C");
    expect(current.getAttribute("aria-current")).toBe("page");

    // Los separadores SVG deben tener aria-hidden="true"
    const svgs = nav.querySelectorAll("svg");
    expect(svgs.length).toBe(2);
    for (const svg of svgs) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });
});
