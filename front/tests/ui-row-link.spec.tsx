// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RowLink } from "@/components/ui/RowLink";

afterEach(cleanup);

describe("RowLink", () => {
  it("renderiza un solo enlace con el href dado y nombre accesible que incluye título y detalle", () => {
    render(
      <RowLink href="/home/materias/m1" detail="2.º año">
        Álgebra y Geometría Analítica
      </RowLink>
    );

    const link = screen.getByRole("link", {
      name: "Álgebra y Geometría Analítica 2.º año",
    });
    expect(link.getAttribute("href")).toBe("/home/materias/m1");
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });

  it("el chevron no aparece en el árbol accesible", () => {
    const { container } = render(
      <RowLink href="/home/materias/m1">
        Paradigmas de Programación
      </RowLink>
    );

    const svg = container.querySelector("svg");
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.parentElement?.getAttribute("aria-hidden")).toBe("true");
  });

  it("trailing se muestra cuando llega", () => {
    render(
      <RowLink
        href="/home/materias/m1/cursadas/c1"
        detail="2 comisiones · 3 profesores"
        trailing="Ver comisiones"
      >
        1er cuatrimestre 2026
      </RowLink>
    );

    expect(screen.getByText("Ver comisiones")).toBeTruthy();
    const link = screen.getByRole("link", {
      name: "1er cuatrimestre 2026 2 comisiones · 3 profesores",
    });
    expect(link).toBeTruthy();
  });

  it("con current renderiza con aria-current='page' y no es un enlace", () => {
    render(
      <RowLink href="/home/comisiones/co1" current trailing="Actual">
        Comisión 1
      </RowLink>
    );

    expect(screen.queryByRole("link")).toBeNull();
    const currentItem = screen.getByText("Comisión 1").closest(".row-link");
    expect(currentItem).toBeTruthy();
    expect(currentItem?.getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Actual")).toBeTruthy();
  });
});
