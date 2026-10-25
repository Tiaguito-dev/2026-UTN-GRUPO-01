// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useFormSubmission } from "@/hooks/useFormSubmission";

afterEach(cleanup);

type Campo = "nombre" | "codigo";

function Harness({ validate = () => ({}), onSubmit }: {
  validate?: (values: Record<Campo, string>) => Partial<Record<Campo, string>>;
  onSubmit: (values: Record<Campo, string>) => Promise<void>;
}) {
  const { busy, errors, error, handleSubmit } = useFormSubmission({ fields: ["nombre", "codigo"], validate, onSubmit, fallbackError: "No pudimos guardar." });
  return <form onSubmit={handleSubmit} noValidate aria-busy={busy}>
    <input name="nombre" aria-label="Nombre" />
    <input name="codigo" aria-label="Código" />
    {errors.nombre ? <p>{errors.nombre}</p> : null}
    {errors.codigo ? <p>{errors.codigo}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    <button>Enviar</button>
  </form>;
}

describe("useFormSubmission", () => {
  it("ignora un segundo envío mientras el primero está en curso", async () => {
    const onSubmit = vi.fn(() => new Promise<void>(() => {}));
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Nombre"), "Álgebra");
    const form = screen.getByRole("button", { name: "Enviar" }).closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith({ nombre: "Álgebra", codigo: "" }, form);
  });

  it("con errores no envía, los expone y enfoca el primer campo inválido", async () => {
    const onSubmit = vi.fn(async () => {});
    render(<Harness onSubmit={onSubmit} validate={(values) => ({ ...(values.nombre ? {} : { nombre: "Falta el nombre." }), codigo: "Falta el código." })} />);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByText("Falta el nombre.")).toBeTruthy();
    expect(screen.getByText("Falta el código.")).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("si el envío falla sin un Error, muestra el mensaje de respaldo y libera el envío", async () => {
    const onSubmit = vi.fn(async () => { throw "sin mensaje"; });
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect((await screen.findByRole("alert")).textContent).toBe("No pudimos guardar.");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("si el envío falla con un Error, muestra su mensaje", async () => {
    render(<Harness onSubmit={async () => { throw new Error("Ya existe."); }} />);
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Ya existe.");
  });
});
