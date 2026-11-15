// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackRespuestas } from "@/components/feedback/FeedbackRespuestas";
import { FeedbackRespuestaForm } from "@/components/feedback/FeedbackRespuestaForm";
import { listarRespuestasFeedback, crearRespuestaFeedback, editarRespuestaFeedback, eliminarRespuestaFeedback } from "@/services/feedback-feed";
import { HttpError } from "@/services/http";
import type { FeedbackRespuesta } from "@/types/feedback-feed";
vi.mock("@/services/feedback-feed", () => ({ listarRespuestasFeedback: vi.fn(), crearRespuestaFeedback: vi.fn(), editarRespuestaFeedback: vi.fn(), eliminarRespuestaFeedback: vi.fn() }));
const reply: FeedbackRespuesta = { id: "r1", feedbackId: "f1", texto: "Reply", anonimo: true, autor: null, propio: true, createdAt: "2026-11-01T15:00:00Z", updatedAt: "2026-11-01T15:00:00Z" };
const page = (items: FeedbackRespuesta[], total = items.length, number = 1) => ({ items, total, page: number, pageSize: 20 });
const onCount = vi.fn(); const onUnavailable = vi.fn();
beforeEach(() => { vi.resetAllMocks(); vi.mocked(listarRespuestasFeedback).mockResolvedValue(page([])); vi.mocked(crearRespuestaFeedback).mockResolvedValue(reply); vi.mocked(editarRespuestaFeedback).mockResolvedValue({ ...reply, texto: "Changed" }); vi.mocked(eliminarRespuestaFeedback).mockResolvedValue(undefined); HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); }; HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); }; });
afterEach(cleanup);
describe("Replies", () => {
 it("loads bounded pages, preserves anonymous identity and reconciles the total", async () => {
   vi.mocked(listarRespuestasFeedback).mockResolvedValueOnce(page([{ ...reply, propio: false, autor: { displayName: "PRIVATE" } }], 21)).mockResolvedValueOnce(page([{ ...reply, id: "r2", texto: "Page two", anonimo: false, autor: { displayName: "Ada" }, propio: false }], 21, 2));
   render(<FeedbackRespuestas feedbackId="f1" onCount={onCount} onUnavailable={onUnavailable} />);
   await screen.findByText("Reply"); expect(screen.getByText("Anónimo")).toBeTruthy(); expect(screen.queryByText("PRIVATE")).toBeNull(); expect(screen.queryByRole("button", { name: /Editar respuesta|Eliminar respuesta/ })).toBeNull();
   expect(listarRespuestasFeedback).toHaveBeenCalledWith("f1", { page: 1, pageSize: 20 }); await waitFor(() => expect(onCount).toHaveBeenCalledWith(21));
   await userEvent.click(screen.getByRole("button", { name: "Página siguiente" })); await screen.findByText("Page two"); expect(listarRespuestasFeedback).toHaveBeenLastCalledWith("f1", { page: 2, pageSize: 20 }); expect(screen.getByText("Ada")).toBeTruthy();
   expect(document.querySelector("time")!.getAttribute("datetime")).toBe(reply.createdAt);
 });
 it("retries read errors and handles empty replies", async () => {
   vi.mocked(listarRespuestasFeedback).mockRejectedValueOnce(new Error("Read failed")); render(<FeedbackRespuestas feedbackId="f1" onCount={onCount} onUnavailable={onUnavailable} />);
   await screen.findByText("Read failed"); await userEvent.click(screen.getByRole("button", { name: "Reintentar respuestas" })); await screen.findByText("Todavía no hay respuestas."); await waitFor(() => expect(onCount).toHaveBeenCalledWith(0));
 });
 it("creates, revalidates the list and uses the server total rather than adding blindly", async () => {
   vi.mocked(listarRespuestasFeedback).mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([reply], 1));
   render(<FeedbackRespuestas feedbackId="f1" onCount={onCount} onUnavailable={onUnavailable} />); await screen.findByText("Todavía no hay respuestas.");
   await userEvent.type(screen.getByRole("textbox", { name: "Tu respuesta" }), " Reply "); await userEvent.click(screen.getByRole("checkbox", { name: "Publicar de forma anónima" }));
   await userEvent.click(screen.getByRole("button", { name: "Publicar respuesta" })); await screen.findByText("Reply"); await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1));
   expect(crearRespuestaFeedback).toHaveBeenCalledWith("f1", { texto: "Reply", anonimo: true, solicitudId: expect.any(String) });
 });
 it("does not retry a confirmed POST when subsequent list revalidation fails", async () => {
   vi.mocked(listarRespuestasFeedback).mockResolvedValueOnce(page([])).mockRejectedValueOnce(new Error("Revalidation failed")).mockResolvedValueOnce(page([reply]));
   render(<FeedbackRespuestas feedbackId="f1" onCount={onCount} onUnavailable={onUnavailable} />); await screen.findByText("Todavía no hay respuestas.");
   const text = screen.getByRole("textbox", { name: "Tu respuesta" }); await userEvent.type(text, "Saved reply"); await userEvent.click(screen.getByRole("button", { name: "Publicar respuesta" })); await screen.findByText("Revalidation failed");
   expect((text as HTMLTextAreaElement).value).toBe(""); expect(crearRespuestaFeedback).toHaveBeenCalledTimes(1);
   await userEvent.click(screen.getByRole("button", { name: "Reintentar respuestas" })); await screen.findByText("Reply"); await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(1)); expect(crearRespuestaFeedback).toHaveBeenCalledTimes(1);
 });
 it("keeps the draft and UUID on an idempotent retry, then uses a new key for a new publication", async () => {
   const saved = vi.fn(); vi.mocked(crearRespuestaFeedback).mockRejectedValueOnce(new HttpError(0, "Network error"));
   render(<FeedbackRespuestaForm feedbackId="f1" onSaved={saved} onUnavailable={onUnavailable} />); const text = screen.getByRole("textbox", { name: "Tu respuesta" }); await userEvent.type(text, "Draft");
   await userEvent.click(screen.getByRole("button", { name: "Publicar respuesta" })); await screen.findByText("Network error"); expect((text as HTMLTextAreaElement).value).toBe("Draft");
   await userEvent.click(screen.getByRole("button", { name: "Publicar respuesta" })); await waitFor(() => expect(saved).toHaveBeenCalledOnce());
   const first = vi.mocked(crearRespuestaFeedback).mock.calls[0][1]; expect(vi.mocked(crearRespuestaFeedback).mock.calls[1][1]).toEqual(first);
   await userEvent.type(text, "Second"); await userEvent.click(screen.getByRole("button", { name: "Publicar respuesta" })); await waitFor(() => expect(saved).toHaveBeenCalledTimes(2)); expect(vi.mocked(crearRespuestaFeedback).mock.calls[2][1].solicitudId).not.toBe(first.solicitudId);
 });
 it("does not reuse a key with changed content without an explicit new-publication action", async () => {
   vi.mocked(crearRespuestaFeedback).mockRejectedValueOnce(new Error("Failed")); render(<FeedbackRespuestaForm feedbackId="f1" onSaved={vi.fn()} onUnavailable={onUnavailable} />);
   const text = screen.getByRole("textbox", { name: "Tu respuesta" }); await userEvent.type(text, "First"); await userEvent.click(screen.getByRole("button", { name: "Publicar respuesta" })); await screen.findByText("Failed");
   await userEvent.type(text, " changed"); await userEvent.click(screen.getByRole("button", { name: "Publicar respuesta" })); expect(crearRespuestaFeedback).toHaveBeenCalledTimes(1);
   await userEvent.click(screen.getByRole("button", { name: "Nueva respuesta" })); await userEvent.click(screen.getByRole("button", { name: "Publicar respuesta" })); await waitFor(() => expect(crearRespuestaFeedback).toHaveBeenCalledTimes(2));
   expect(vi.mocked(crearRespuestaFeedback).mock.calls[0][1].solicitudId).not.toBe(vi.mocked(crearRespuestaFeedback).mock.calls[1][1].solicitudId);
 });
 it("prevents double submissions and validates text without stars", async () => {
   let resolve!: (v: FeedbackRespuesta) => void; vi.mocked(crearRespuestaFeedback).mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
   render(<FeedbackRespuestaForm feedbackId="f1" onSaved={vi.fn()} onUnavailable={onUnavailable} />); const text = screen.getByRole("textbox", { name: "Tu respuesta" });
   fireEvent.submit(text.closest("form")!); expect(crearRespuestaFeedback).not.toHaveBeenCalled(); await userEvent.type(text, "Valid");
   fireEvent.submit(text.closest("form")!); fireEvent.submit(text.closest("form")!); expect(crearRespuestaFeedback).toHaveBeenCalledTimes(1); await act(async () => resolve(reply));
 });
 it("edits only owned replies and preserves a failed edit draft", async () => {
   vi.mocked(listarRespuestasFeedback).mockResolvedValue(page([reply])); vi.mocked(editarRespuestaFeedback).mockRejectedValueOnce(new HttpError(409, "Inactive commission"));
   render(<FeedbackRespuestas feedbackId="f1" onCount={onCount} onUnavailable={onUnavailable} />); await userEvent.click(await screen.findByRole("button", { name: "Editar respuesta" }));
   const text = screen.getByRole("textbox", { name: "Editar tu respuesta" }); await userEvent.clear(text); await userEvent.type(text, "Changed"); await userEvent.click(screen.getByRole("button", { name: "Guardar respuesta" })); await screen.findByText("Inactive commission"); expect((text as HTMLTextAreaElement).value).toBe("Changed");
   await userEvent.click(screen.getByRole("button", { name: "Guardar respuesta" })); await waitFor(() => expect(editarRespuestaFeedback).toHaveBeenCalledTimes(2)); expect(editarRespuestaFeedback).toHaveBeenLastCalledWith("r1", { texto: "Changed" });
 });
 it.each([false, true])("does not close a newer editor when an earlier edit finishes (same reply=%s)", async same => {
   const second = { ...reply, id: "r2", texto: "Second" }; vi.mocked(listarRespuestasFeedback).mockResolvedValue(page([reply, second])); let resolve!: (v: FeedbackRespuesta) => void;
   vi.mocked(editarRespuestaFeedback).mockReturnValueOnce(new Promise(yes => { resolve = yes; }));
   render(<FeedbackRespuestas feedbackId="f1" onCount={onCount} onUnavailable={onUnavailable} />); await screen.findByText("Reply");
   await userEvent.click(screen.getAllByRole("button", { name: "Editar respuesta" })[0]); const first = screen.getByRole("textbox", { name: "Editar tu respuesta" }); await userEvent.type(first, " changed"); await userEvent.click(screen.getByRole("button", { name: "Guardar respuesta" }));
   await userEvent.click(screen.getAllByRole("button", { name: "Editar respuesta" })[same ? 0 : 1]); await userEvent.type(screen.getByRole("textbox", { name: "Editar tu respuesta" }), " draft");
   await act(async () => resolve({ ...reply, texto: "Reply changed" })); await waitFor(() => expect((screen.getByRole("textbox", { name: "Editar tu respuesta" }) as HTMLTextAreaElement).value).toBe(same ? "Reply draft" : "Second draft"));
 });
 it("revalidates a reply mutation 404 without assuming the parent is gone", async () => {
   vi.mocked(listarRespuestasFeedback).mockResolvedValueOnce(page([reply])).mockResolvedValueOnce(page([])); vi.mocked(editarRespuestaFeedback).mockRejectedValueOnce(new HttpError(404, "Reply removed"));
   render(<FeedbackRespuestas feedbackId="f1" onCount={onCount} onUnavailable={onUnavailable} />); await userEvent.click(await screen.findByRole("button", { name: "Editar respuesta" }));
   const text = screen.getByRole("textbox", { name: "Editar tu respuesta" }); await userEvent.type(text, " draft"); await userEvent.click(screen.getByRole("button", { name: "Guardar respuesta" })); await screen.findByText("Reply removed");
   await waitFor(() => expect(listarRespuestasFeedback).toHaveBeenCalledTimes(2)); expect(onUnavailable).not.toHaveBeenCalled(); expect((screen.getByRole("textbox", { name: "Editar tu respuesta" }) as HTMLTextAreaElement).value).toBe("Reply draft");
 });
 it("requires confirmation for deletion, avoids duplicates and reconciles the total", async () => {
   vi.mocked(listarRespuestasFeedback).mockResolvedValueOnce(page([reply])).mockResolvedValueOnce(page([])); let resolve!: () => void; vi.mocked(eliminarRespuestaFeedback).mockReturnValueOnce(new Promise<void>(yes => { resolve = yes; }));
   render(<FeedbackRespuestas feedbackId="f1" onCount={onCount} onUnavailable={onUnavailable} />); await userEvent.click(await screen.findByRole("button", { name: "Eliminar respuesta" }));
   const dialog = screen.getByRole("dialog", { name: "Eliminar respuesta" }); expect(eliminarRespuestaFeedback).not.toHaveBeenCalled(); const button = within(dialog).getByRole("button", { name: "Confirmar eliminación" }); fireEvent.click(button); fireEvent.click(button); expect(eliminarRespuestaFeedback).toHaveBeenCalledExactlyOnceWith("r1");
   await act(async () => resolve()); await screen.findByText("Todavía no hay respuestas."); await waitFor(() => expect(onCount).toHaveBeenLastCalledWith(0));
 });
 it("rejects an unowned edit form without guessing identity", () => {
   render(<FeedbackRespuestaForm feedbackId="f1" original={{ ...reply, propio: false }} onSaved={vi.fn()} onUnavailable={onUnavailable} />); expect(screen.queryByRole("textbox")).toBeNull();
 });
 it.each([404, 409])("preserves create drafts on parent/inactive errors: %s", async status => {
   vi.mocked(crearRespuestaFeedback).mockRejectedValueOnce(new HttpError(status, status === 404 ? "Parent removed" : "Inactive commission"));
   render(<FeedbackRespuestaForm feedbackId="f1" onSaved={vi.fn()} onUnavailable={onUnavailable} />); const text = screen.getByRole("textbox", { name: "Tu respuesta" }); await userEvent.type(text, "Keep me"); await userEvent.click(screen.getByRole("button", { name: "Publicar respuesta" })); await screen.findByRole("alert"); expect((text as HTMLTextAreaElement).value).toBe("Keep me"); expect(onUnavailable).toHaveBeenCalledTimes(status === 404 ? 1 : 0);
 });
});
