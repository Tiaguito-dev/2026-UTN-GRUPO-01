// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackInteracciones } from "@/components/feedback/FeedbackInteracciones";
import { activarLikeFeedback, retirarLikeFeedback } from "@/services/feedback-feed";
import { HttpError } from "@/services/http";
import type { FeedbackFeedItem, FeedbackLike } from "@/types/feedback-feed";
vi.mock("@/services/feedback-feed", () => ({ activarLikeFeedback: vi.fn(), retirarLikeFeedback: vi.fn(), listarRespuestasFeedback: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 }) }));
const item: FeedbackFeedItem = { id: "f1", texto: "Parent", puntuacion: 4, anonimo: true, autor: null, propio: false, profesor: null,
 contexto: { comisionId: "c1", nombre: "S-31", materiaId: "m1", materiaNombre: "Materia", cursadaId: "cu1", anio: 2026, cuatrimestre: null }, createdAt: "2026-11-01T15:00:00Z", updatedAt: "2026-11-01T15:00:00Z", cantidadLikes: 2, cantidadRespuestas: 0, meGusta: false };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(activarLikeFeedback).mockResolvedValue({ meGusta: true, cantidadLikes: 7 }); vi.mocked(retirarLikeFeedback).mockResolvedValue({ meGusta: false, cantidadLikes: 6 }); });
afterEach(cleanup);
describe("Feed interactions", () => {
 it("uses explicit activate/remove and applies the exact server state", async () => {
   render(<FeedbackInteracciones feedback={item} />);
   await userEvent.click(screen.getByRole("button", { name: "Dar Me gusta" })); await screen.findByText("7 Me gusta");
   expect(activarLikeFeedback).toHaveBeenCalledExactlyOnceWith("f1"); expect(screen.getByRole("button", { name: "Quitar Me gusta" }).getAttribute("aria-pressed")).toBe("true");
   await userEvent.click(screen.getByRole("button", { name: "Quitar Me gusta" })); await screen.findByText("6 Me gusta"); expect(retirarLikeFeedback).toHaveBeenCalledExactlyOnceWith("f1");
 });
 it.each([false, true])("retries the same explicit intent after a network error: active=%s", async active => {
   const api = active ? retirarLikeFeedback : activarLikeFeedback; vi.mocked(api).mockRejectedValueOnce(new HttpError(0, "Network error"));
   render(<FeedbackInteracciones feedback={{ ...item, meGusta: active }} />);
   await userEvent.click(screen.getByRole("button", { name: active ? "Quitar Me gusta" : "Dar Me gusta" })); await screen.findByRole("alert"); expect(screen.getByText("2 Me gusta")).toBeTruthy();
   await userEvent.click(screen.getByRole("button", { name: "Reintentar Me gusta" })); await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
 });
 it("blocks two rapid clicks while the operation is pending", async () => {
   let resolve!: (v: FeedbackLike) => void; vi.mocked(activarLikeFeedback).mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
   render(<FeedbackInteracciones feedback={item} />); const button = screen.getByRole("button", { name: "Dar Me gusta" }); fireEvent.click(button); fireEvent.click(button);
   expect(activarLikeFeedback).toHaveBeenCalledTimes(1); expect((button as HTMLButtonElement).disabled).toBe(true); await act(async () => resolve({ meGusta: true, cantidadLikes: 3 }));
 });
 it("never infers ownership from an anonymous author and prevents known self likes", () => {
   render(<FeedbackInteracciones feedback={{ ...item, propio: true }} />); expect(screen.queryByRole("button", { name: /Me gusta/ })).toBeNull(); expect(screen.getByText("2 Me gusta")).toBeTruthy();
 });
 it("hides cached parent content after a 404 without exposing identity", async () => {
   vi.mocked(activarLikeFeedback).mockRejectedValueOnce(new HttpError(404, "Parent removed"));
   render(<FeedbackInteracciones feedback={item}><p>Cached parent</p></FeedbackInteracciones>);
   await userEvent.click(screen.getByRole("button", { name: "Dar Me gusta" })); await screen.findByText("Este comentario ya no está disponible."); expect(screen.queryByText("Cached parent")).toBeNull();
 });
 it("keeps a response draft when the disclosure is closed and reopened", async () => {
   render(<FeedbackInteracciones feedback={item} />); await userEvent.click(screen.getByRole("button", { name: /Ver respuestas/ }));
   await userEvent.type(await screen.findByRole("textbox", { name: "Tu respuesta" }), "Draft kept"); await userEvent.click(screen.getByRole("button", { name: /Ocultar respuestas/ }));
   expect(screen.queryByRole("textbox")).toBeNull(); await userEvent.click(screen.getByRole("button", { name: /Ver respuestas/ })); expect((screen.getByRole("textbox", { name: "Tu respuesta" }) as HTMLTextAreaElement).value).toBe("Draft kept");
 });
 it("provides a keyboard-operable response disclosure", async () => {
   render(<FeedbackInteracciones feedback={item} />); const button = screen.getByRole("button", { name: /Ver respuestas/ });
   button.focus(); await userEvent.keyboard("{Enter}"); expect(button.getAttribute("aria-expanded")).toBe("true"); await screen.findByText("Todavía no hay respuestas.");
 });
});
