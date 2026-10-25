// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dialog } from "@/components/ui/Dialog";

// jsdom does not implement showModal()/close(). Minimal stub: toggle `open`, move focus to the first
// control like the native focusing steps, and fire `close`. Escape is `cancel` and, unless prevented, close().
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
    this.querySelector<HTMLElement>("button, input, select, textarea, a[href]")?.focus();
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(cleanup);

function pressEscape(dialog: HTMLElement) {
  if (fireEvent(dialog, new Event("cancel", { cancelable: true }))) (dialog as HTMLDialogElement).close();
}

function renderDialog(props: { busy?: boolean; onClose?: () => void } = {}) {
  const onClose = props.onClose ?? vi.fn();
  render(<Dialog open onClose={onClose} title="Nueva materia" description="Completá los datos." busy={props.busy}>
    <input aria-label="Nombre" />
  </Dialog>);
  return { onClose, dialog: screen.getByRole("dialog", { name: "Nueva materia", description: "Completá los datos." }) };
}

describe("Dialog", () => {
  it("opens with the title as accessible name and the description", () => {
    const { dialog } = renderDialog();
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("puts the initial focus inside the dialog, on the first control of the body", () => {
    const { dialog } = renderDialog();
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText("Nombre"));
  });

  it("moves the initial focus to the control marked with data-autofocus", () => {
    render(<Dialog open onClose={vi.fn()} title="Nueva materia">
      <input aria-label="Nombre" /><input aria-label="Código" data-autofocus />
    </Dialog>);
    expect(document.activeElement).toBe(screen.getByLabelText("Código"));
  });

  it("calls onClose on Escape", () => {
    const { dialog, onClose } = renderDialog();
    pressEscape(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose from Cerrar", async () => {
    const { onClose } = renderDialog();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close while busy: Escape is ignored and Cerrar is disabled", () => {
    const { dialog, onClose } = renderDialog({ busy: true });
    pressEscape(dialog);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(screen.getByRole("button", { name: "Cerrar" })).toHaveProperty("disabled", true);
  });

  it("reopens when the browser closes it anyway while busy (repeated Escape in Chrome)", () => {
    const { dialog, onClose } = renderDialog({ busy: true });
    (dialog as HTMLDialogElement).close();
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("returns focus to the opener when open becomes false", async () => {
    function Host() {
      const [open, setOpen] = useState(false);
      return <>
        <button type="button" className="button" onClick={() => setOpen(true)}>Nueva materia</button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Nueva materia"><input aria-label="Nombre" /></Dialog>
      </>;
    }
    render(<Host />);
    const opener = screen.getByRole("button", { name: "Nueva materia" });
    await userEvent.click(opener);
    expect(screen.getByRole("dialog", { name: "Nueva materia" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
