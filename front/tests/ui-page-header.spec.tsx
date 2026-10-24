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
});
