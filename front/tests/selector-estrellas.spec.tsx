// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SelectorEstrellas } from "../src/components/feedback/SelectorEstrellas";

afterEach(cleanup);

function Selector({ initial = null, disabled = false, error = "", required = true }: { initial?: number | null; disabled?: boolean; error?: string; required?: boolean }) {
  const [value, setValue] = useState(initial);
  return <form><SelectorEstrellas value={value} onChange={setValue} disabled={disabled} error={error} required={required} /></form>;
}

describe("Selector local de estrellas", () => {
  it("ofrece cinco radios etiquetados, sin voto automático ni opción de quitar estrellas", () => {
    render(<Selector />);
    expect(screen.getByRole("group", { name: "Valoración de la materia" }).tagName).toBe("FIELDSET");
    const radios = screen.getAllByRole("radio") as HTMLInputElement[];
    expect(radios.map(radio => radio.value)).toEqual(["1", "2", "3", "4", "5"]);
    expect(radios.every(radio => !radio.checked && radio.name === "puntuacion")).toBe(true);
    expect(screen.getByRole("radio", { name: "1 estrella" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "5 estrellas" })).toBeTruthy();
  });
  it("permite Tab, Espacio y flechas con radios nativos y guarda solo el número elegido", async () => {
    const user = userEvent.setup();
    const { container } = render(<Selector />);
    const first = screen.getByRole("radio", { name: "1 estrella" });
    await user.tab();
    expect(document.activeElement).toBe(first);
    await user.keyboard(" ");
    expect((first as HTMLInputElement).checked).toBe(true);
    await user.keyboard("{ArrowRight}");
    const second = screen.getByRole("radio", { name: "2 estrellas" });
    expect(document.activeElement).toBe(second);
    expect((second as HTMLInputElement).checked).toBe(true);
    expect(new FormData(container.querySelector("form")!).get("puntuacion")).toBe("2");
  });
  it("mantiene la puntuación al reclicar la estrella actual", async () => {
    render(<Selector initial={4} />);
    const fourth = screen.getByRole("radio", { name: "4 estrellas" });
    expect((fourth as HTMLInputElement).checked).toBe(true);
    await userEvent.click(fourth);
    expect((fourth as HTMLInputElement).checked).toBe(true);
  });
  it("asocia ayuda y error a cada radio y oculta iconos decorativos al lector", () => {
    const { container } = render(<Selector error="Elegí una puntuación" />);
    expect(screen.getByRole("group", { name: "Valoración de la materia" }).getAttribute("aria-invalid")).toBe("true");
    for (const radio of screen.getAllByRole("radio")) {
      const ids = radio.getAttribute("aria-describedby")!.split(" ");
      expect(ids.every(id => document.getElementById(id))).toBe(true);
      expect(ids.some(id => document.getElementById(id)?.textContent === "Elegí una puntuación")).toBe(true);
    }
    const icons = container.querySelectorAll("svg");
    expect(icons).toHaveLength(5);
    for (const icon of icons) expect(icon.getAttribute("aria-hidden")).toBe("true");
  });
  it("deshabilita todos los radios durante el envío", async () => {
    const onChange = vi.fn();
    render(<SelectorEstrellas value={3} onChange={onChange} disabled />);
    for (const radio of screen.getAllByRole("radio")) expect((radio as HTMLInputElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole("radio", { name: "5 estrellas" }));
    expect(onChange).not.toHaveBeenCalled();
  });
  it("permite histórico vacío sin requerimiento nativo", () => {
    render(<Selector required={false} />);
    expect((screen.getAllByRole("radio") as HTMLInputElement[]).every(radio => !radio.required)).toBe(true);
  });
});
