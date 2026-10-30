// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PageHeader } from "@/components/ui/PageHeader";

afterEach(cleanup);

describe("PageHeader", () => {
  it("focuses the h1 on mount and gives it the id the section uses", () => {
    render(<section aria-labelledby="h"><PageHeader id="h" title="Materias" /></section>);
    const heading = screen.getByRole("heading", { level: 1, name: "Materias" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole("region", { name: "Materias" })).toBeTruthy();
  });

  it("refocuses the h1 when focusKey changes, and only then", () => {
    const { rerender } = render(<><PageHeader id="h" title="Cursada" focusKey="a" /><button>Otro</button></>);
    const heading = screen.getByRole("heading", { level: 1 });
    const other = screen.getByRole("button");
    other.focus();
    rerender(<><PageHeader id="h" title="Cursada" focusKey="a" /><button>Otro</button></>);
    expect(document.activeElement).toBe(other);
    rerender(<><PageHeader id="h" title="Cursada" focusKey="b" /><button>Otro</button></>);
    expect(document.activeElement).toBe(heading);
  });

  it("con back renderiza el enlace antes del breadcrumb y del h1 en un div.page-nav", () => {
    const { container } = render(
      <PageHeader
        id="h"
        title="Paradigmas de Programación"
        back={{ href: "/home/materias", label: "Materias" }}
        breadcrumb={[{ label: "Materias", href: "/home/materias" }, { label: "Paradigmas de Programación" }]}
      />
    );

    const pageNav = container.querySelector("div.page-nav");
    expect(pageNav).toBeTruthy();

    const backLink = screen.getByRole("link", { name: "Volver a Materias" });
    const breadcrumb = screen.getByRole("navigation", { name: "Ubicación actual" });
    const heading = screen.getByRole("heading", { level: 1, name: "Paradigmas de Programación" });

    // Orden en el DOM: backLink y breadcrumb dentro de pageNav, y antes del heading
    expect(pageNav).not.toBeNull();
    expect(pageNav!.contains(backLink)).toBe(true);
    expect(pageNav!.contains(breadcrumb)).toBe(true);
    expect(pageNav!.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(backLink.compareDocumentPosition(breadcrumb) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sin back explícito utiliza el último ancestro del breadcrumb como regreso", () => {
    const { container } = render(
      <PageHeader
        id="h"
        title="Materias"
        breadcrumb={[{ label: "Inicio", href: "/home" }, { label: "Materias" }]}
      />
    );

    expect(container.querySelector("div.page-nav")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Volver a Inicio" }).getAttribute("href")).toBe("/home");
    expect(screen.getByRole("navigation", { name: "Ubicación actual" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Materias" })).toBeTruthy();
  });
});

