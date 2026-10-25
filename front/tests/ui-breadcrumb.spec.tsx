// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";

afterEach(cleanup);

describe("Breadcrumb", () => {
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
