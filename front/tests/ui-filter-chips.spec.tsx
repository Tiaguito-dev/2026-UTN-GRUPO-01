// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterChips } from "@/components/ui/FilterChips";

afterEach(cleanup);

const options = [
  { value: "all", label: "Todos los años" },
  { value: "1", label: "1.º año" },
  { value: "2", label: "2.º año" },
  { value: "ELECTIVA", label: "Electivas" },
];

describe("FilterChips", () => {
  it("el grupo tiene nombre accesible igual a label (visible y oculto)", () => {
    const { unmount } = render(
      <FilterChips
        label="Año de la carrera"
        options={options}
        value="all"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("group", { name: "Año de la carrera" })).toBeTruthy();
    expect(screen.getByText("Año de la carrera")).toBeTruthy();

    unmount();

    render(
      <FilterChips
        label="Filtrar por carrera"
        labelHidden
        options={options}
        value="all"
        onChange={vi.fn()}
      />
    );
    expect(screen.getByRole("group", { name: "Filtrar por carrera" })).toBeTruthy();
    expect(screen.queryByText("Filtrar por carrera")).toBeNull();
  });

  it("la opción de value tiene aria-pressed='true' y las demás 'false'", () => {
    render(
      <FilterChips
        label="Año de la carrera"
        options={options}
        value="2"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Todos los años" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "1.º año" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "2.º año" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Electivas" }).getAttribute("aria-pressed")).toBe("false");
  });

  it("clic en otra opción llama a onChange con su valor", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterChips
        label="Año de la carrera"
        options={options}
        value="all"
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "1.º año" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it("clic en la opción ya presionada no llama a onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterChips
        label="Año de la carrera"
        options={options}
        value="2"
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole("button", { name: "2.º año" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("se recorre con Tab y se activa con Enter y Espacio", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterChips
        label="Año de la carrera"
        options={options}
        value="all"
        onChange={onChange}
      />
    );

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Todos los años" }));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "1.º año" }));

    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("1");

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "2.º año" }));

    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith("2");
  });
});
