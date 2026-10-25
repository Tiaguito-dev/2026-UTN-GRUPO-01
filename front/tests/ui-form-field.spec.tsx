// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FormField } from "@/components/ui/FormField";

afterEach(cleanup);

describe("FormField", () => {
  it("has no aria-describedby and aria-invalid false without hint or error", () => {
    render(<FormField name="email" label="Email" input={{ type: "email", autoComplete: "email" }} />);
    const input = screen.getByLabelText("Email");
    expect(input.getAttribute("type")).toBe("email");
    expect(input.getAttribute("autocomplete")).toBe("email");
    expect(input.hasAttribute("required")).toBe(true);
    expect(input.hasAttribute("aria-describedby")).toBe(false);
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("points aria-describedby to the hint", () => {
    render(<FormField name="nombre" label="Nombre" hint="Hasta 100 caracteres." />);
    expect(screen.getByLabelText("Nombre").getAttribute("aria-describedby")).toBe("nombre-hint");
    expect(document.getElementById("nombre-hint")?.textContent).toBe("Hasta 100 caracteres.");
  });

  it("marks the control invalid and describes it with hint and error", () => {
    render(<FormField name="nombre" label="Nombre" hint="Hasta 100 caracteres." error="Ingresá el nombre." />);
    const input = screen.getByLabelText("Nombre");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("nombre-hint nombre-error");
    expect(document.getElementById("nombre-error")?.textContent).toBe("Error: Ingresá el nombre.");
  });

  it("renders a numeric input with its range", () => {
    render(<FormField name="anio" label="Año" input={{ numeric: { min: 2000, max: 2030 } }} />);
    const input = screen.getByLabelText("Año");
    expect([input.getAttribute("type"), input.getAttribute("min"), input.getAttribute("max"), input.getAttribute("step")]).toEqual(["number", "2000", "2030", "1"]);
  });

  it("renders a select with a placeholder option and reports changes", () => {
    const onChange = vi.fn();
    render(<FormField name="materia" label="Materia" options={[{ value: "m1", label: "Álgebra" }]} value="" onChange={onChange} required={false} />);
    const select = screen.getByLabelText("Materia") as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["Elegí una opción", "Álgebra"]);
    expect(select.hasAttribute("required")).toBe(false);
    fireEvent.change(select, { target: { value: "m1" } });
    expect(onChange).toHaveBeenCalledWith("m1");
  });
});
