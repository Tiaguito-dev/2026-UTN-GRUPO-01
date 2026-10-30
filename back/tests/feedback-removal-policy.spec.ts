import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { assertFeedbackOwner, assertFeedbackRemoval } from "../src/reviews/application/feedback-policy.js";
import { FeedbackService } from "../src/reviews/application/feedback.service.js";
import type { FeedbackRepository } from "../src/reviews/application/ports/feedback.repository.js";

describe("permisos de eliminación de experiencias", () => {
  it("permite al autor USER y ADMIN eliminar, pero rechaza a otro USER", () => {
    expect(() => assertFeedbackRemoval("author", "author", "USER")).not.toThrow();
    expect(() => assertFeedbackRemoval("author", "moderator", "ADMIN")).not.toThrow();
    expect(() => assertFeedbackRemoval("moderator", "moderator", "ADMIN")).not.toThrow();
    expect(() => assertFeedbackRemoval("author", "stranger", "USER")).toThrow();
  });
  it("la moderación no cambia la política privada de autoría", () => {
    expect(() => assertFeedbackOwner("author", "moderator")).toThrow();
    expect(() => assertFeedbackOwner("author", "author")).not.toThrow();
  });
  it("el servicio valida UUID antes de delegar y conserva la identidad y rol", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const repository = { remove } as unknown as FeedbackRepository;
    const service = new FeedbackService(repository);
    const id = randomUUID();
    await service.remove(id, "moderator", "ADMIN");
    expect(remove).toHaveBeenCalledExactlyOnceWith(id, "moderator", "ADMIN");
    expect(() => service.remove("invalid", "moderator", "ADMIN")).toThrow();
    expect(remove).toHaveBeenCalledTimes(1);
  });
  it("el servicio usa rol USER por defecto para no otorgar moderación implícita", async () => {
    const remove = vi.fn().mockResolvedValue(undefined);
    const service = new FeedbackService({ remove } as unknown as FeedbackRepository);
    const id = randomUUID();
    await service.remove(id, "author");
    expect(remove).toHaveBeenCalledExactlyOnceWith(id, "author", "USER");
  });
});
