// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SessionIdleMonitor } from "@/components/auth/SessionIdleMonitor";
import { HttpError } from "@/services/http";

const { service } = vi.hoisted(() => ({ service: {
  getStatus: vi.fn(), activity: vi.fn(), renew: vi.fn(), expire: vi.fn(), close: vi.fn(), subscribe: vi.fn(),
} }));
vi.mock("@/services/session", () => ({ getSessionService: () => service }));
const baseline = Date.parse("2026-11-03T12:00:00Z");
const status = (warningSeconds = 1680, expirySeconds = 1800) => ({
  serverNow: new Date(baseline).toISOString(),
  warningAt: new Date(baseline + warningSeconds * 1000).toISOString(),
  idleExpiresAt: new Date(baseline + expirySeconds * 1000).toISOString(),
  absoluteExpiresAt: new Date(baseline + 604800_000).toISOString(),
});
const currentStatus = (warningSeconds = 1680, expirySeconds = 1800) => ({ ...status(warningSeconds, expirySeconds), serverNow: new Date(Date.now()).toISOString() });
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers(); vi.setSystemTime(baseline);
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  service.getStatus.mockImplementation(async () => currentStatus()); service.activity.mockResolvedValue(status());
  service.renew.mockResolvedValue(status()); service.expire.mockResolvedValue(null); service.close.mockResolvedValue(undefined);
  service.subscribe.mockReturnValue(() => {});
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function mount() {
  const onExpire = vi.fn();
  const view = render(<SessionIdleMonitor accountId="user-1" onExpire={onExpire} />);
  await act(async () => {});
  return { ...view, onExpire };
}
describe("aviso de sesión por inactividad", () => {
  it("muestra el aviso a los 28 minutos sin renovar por las comprobaciones periódicas", async () => {
    await mount();
    expect(screen.queryByRole("dialog")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1680_000); });
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Renovar sesión" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeTruthy();
    expect(service.activity).not.toHaveBeenCalled(); expect(service.renew).not.toHaveBeenCalled();
  });
  it("no descarta el aviso con Escape ni lo renueva mediante eventos sintéticos", async () => {
    service.getStatus.mockImplementation(async () => currentStatus(0, 120));
    await mount();
    const dialog = screen.getByRole("dialog");
    const cancelled = new Event("cancel", { cancelable: true });
    fireEvent(dialog, cancelled);
    expect(cancelled.defaultPrevented).toBe(true);
    fireEvent.pointerMove(document); fireEvent.keyDown(document, { key: "a" });
    expect(service.activity).not.toHaveBeenCalled(); expect(service.renew).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
  it("renueva únicamente al confirmar y bloquea el doble envío", async () => {
    service.getStatus.mockImplementation(async () => currentStatus(0, 120));
    await mount();
    let finish!: (value: ReturnType<typeof status>) => void;
    service.renew.mockReturnValueOnce(new Promise<ReturnType<typeof status>>((resolve) => { finish = resolve; }));
    fireEvent.click(screen.getByRole("button", { name: "Renovar sesión" }));
    fireEvent.click(screen.getByRole("button", { name: /Renovando|Renovar sesión/ }));
    expect(service.renew).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("dialog")).toBeTruthy();
    await act(async () => { finish(status()); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("muestra confirmación visible cuando el servidor renueva la sesión", async () => {
    service.getStatus.mockImplementation(async () => currentStatus(0, 120));
    await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Renovar sesión" })); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("La sesión se renovó correctamente.").getAttribute("role")).toBe("status");
  });
  it("si nadie confirma, verifica el plazo y cierra a los treinta minutos", async () => {
    const { onExpire } = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1800_000); });
    expect(service.expire).toHaveBeenCalledWith("user-1");
    expect(onExpire).toHaveBeenCalledWith("idle");
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
  it("una renovación publicada por otra pestaña retira el aviso", async () => {
    service.getStatus.mockImplementation(async () => currentStatus(0, 120));
    await mount();
    expect(screen.getByRole("dialog")).toBeTruthy();
    const notify = service.subscribe.mock.calls[0]![0] as (value: ReturnType<typeof status>) => void;
    await act(async () => { notify(status()); });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(service.renew).not.toHaveBeenCalled();
  });
  it("el error de renovación conserva el límite y permite reintentar", async () => {
    service.getStatus.mockImplementation(async () => currentStatus(0, 120));
    service.renew.mockRejectedValueOnce(new Error("Lo sentimos. No pudimos renovar la sesión. Intentá nuevamente."));
    const { onExpire } = await mount();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Renovar sesión" })); });
    expect(screen.getByRole("alert").textContent).toContain("No pudimos renovar");
    expect(screen.getByRole("button", { name: "Renovar sesión" }).matches(":disabled")).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(onExpire).toHaveBeenCalledWith("idle");
  });
  it("elimina timers y suscripciones al desmontar", async () => {
    const unsubscribe = vi.fn(); service.subscribe.mockReturnValue(unsubscribe);
    const view = await mount(); const calls = service.getStatus.mock.calls.length;
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1800_000); window.dispatchEvent(new Event("focus")); });
    expect(service.getStatus).toHaveBeenCalledTimes(calls); expect(unsubscribe).toHaveBeenCalled();
    expect(view.onExpire).not.toHaveBeenCalled();
  });
  it("bloquea al llegar al límite aunque comprobar el servidor siga pendiente", async () => {
    let finish!: (value: null) => void;
    service.expire.mockReturnValueOnce(new Promise<null>((resolve) => { finish = resolve; }));
    const { onExpire } = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1800_000); });
    expect(screen.getByRole("dialog").textContent).toContain("Comprobando tu sesión");
    expect(screen.queryByRole("button", { name: "Renovar sesión" })).toBeNull();
    expect(onExpire).not.toHaveBeenCalled();
    await act(async () => { finish(null); });
    expect(onExpire).toHaveBeenCalledWith("idle");
  });
  it("una red caída no impide cerrar localmente una sesión vencida", async () => {
    service.expire.mockRejectedValueOnce(new HttpError(0, "Sin conexión"));
    const { onExpire } = await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1800_000); });
    expect(onExpire).toHaveBeenCalledWith("idle");
  });
  it("un fallo inicial bloquea con reintento en vez de inventar un plazo", async () => {
    service.getStatus.mockRejectedValueOnce(new HttpError(0, "Sin conexión. Intentá nuevamente."));
    await mount();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Sin conexión");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reintentar comprobación" })); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("no ofrece renovar más allá del límite absoluto", async () => {
    service.getStatus.mockImplementation(async () => ({ ...currentStatus(0, 1800), absoluteExpiresAt: new Date(baseline + 120_000).toISOString() }));
    const { onExpire } = await mount();
    expect(screen.queryByRole("button", { name: "Renovar sesión" })).toBeNull();
    expect(screen.getByRole("button", { name: "Volver a iniciar sesión" })).toBeTruthy();
    await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
    expect(onExpire).toHaveBeenCalledWith("absolute");
  });
  it("un resultado pendiente después del desmontaje no cierra una nueva sesión", async () => {
    let finish!: (value: ReturnType<typeof status>) => void;
    service.getStatus.mockReturnValueOnce(new Promise<ReturnType<typeof status>>((resolve) => { finish = resolve; }));
    const view = await mount(); view.unmount();
    await act(async () => { finish(status(0, 0)); });
    expect(view.onExpire).not.toHaveBeenCalled(); expect(service.expire).not.toHaveBeenCalled();
  });
  it("re-sincroniza el reloj adelantado con la respuesta autoritativa sin repetir expiraciones", async () => {
    service.expire.mockResolvedValue(status());
    const { onExpire } = await mount();
    // Cambiar la hora del equipo no significa que haya transcurrido ese tiempo en el servidor.
    vi.setSystemTime(baseline + 3600_000);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(service.expire).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onExpire).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(service.expire).toHaveBeenCalledTimes(1);
    expect(onExpire).not.toHaveBeenCalled();
  });
  it("una estimación compartida futura no invalida la respuesta vigente del servidor", async () => {
    service.expire.mockResolvedValue(status());
    const { onExpire } = await mount();
    const notify = service.subscribe.mock.calls[0]![0] as (value: ReturnType<typeof status>) => void;
    await act(async () => { notify({ ...status(), serverNow: new Date(baseline + 3600_000).toISOString() }); });
    expect(service.expire).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onExpire).not.toHaveBeenCalled();
  });
  it("una respuesta de actividad agrupada no reinicia hacia atrás el reloj del aviso", async () => {
    const listeners = vi.spyOn(document, "addEventListener");
    const deadlines = status(20, 30);
    service.getStatus.mockResolvedValue(deadlines);
    service.activity.mockResolvedValue(deadlines);
    await mount();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    const pointer = listeners.mock.calls.find(([event]) => event === "pointermove")?.[1] as EventListener;
    expect(pointer).toBeTruthy();
    // Invocar el listener registrado permite simular actividad confiable en jsdom;
    // el recorrido Chromium comprueba además eventos nativos reales.
    await act(async () => { pointer({ isTrusted: true } as Event); });
    expect(service.activity).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
