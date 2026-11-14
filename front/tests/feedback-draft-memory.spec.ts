import { describe, expect, it } from "vitest";
import { FeedbackDraftMemory, FEEDBACK_DRAFT_TTL, FEEDBACK_DRAFT_LIMIT } from "@/components/feedback/feedback-draft-memory";
const value = { texto: "Private draft", puntuacion: 4, target: "p1", anonimo: true };
function setup() { const memory = new FeedbackDraftMemory("a"); const token = Symbol(); memory.activate("a", "k", token, value); return { memory, token }; }
describe("bounded volatile feedback memory", () => {
  it("retains all fields during a temporary check but rejects writes while suspended", () => {
    const { memory, token } = setup(); expect(memory.read("a", "k")).toBeNull(); memory.observe("checking", "a");
    memory.write("a", "k", token, { ...value, texto: "Stale event" }); expect(memory.read("a", "k")).toEqual(value);
    memory.observe("authenticated", "a"); expect(memory.read("a", "k")).toEqual(value);
  });
  it.each(["anonymous", "unknown", "changed"])("purges at %s identity boundaries", boundary => {
    const { memory } = setup(); memory.observe("temporary-error", "a");
    if (boundary === "anonymous") memory.observe("anonymous", null);
    else if (boundary === "unknown") memory.observe("checking", null);
    else memory.observe("authenticated", "b");
    memory.observe("authenticated", "a"); expect(memory.read("a", "k")).toBeNull(); expect(memory.read("b", "k")).toBeNull();
  });
  it("does not retain an ordinary navigation or an explicitly discarded draft", () => {
    const { memory, token } = setup(); memory.release("a", "k", token); memory.observe("checking", "a"); expect(memory.read("a", "k")).toBeNull();
    memory.observe("authenticated", "a"); memory.activate("a", "k", token, value); memory.discard("a", "k", token); memory.observe("temporary-error", "a"); expect(memory.read("a", "k")).toBeNull();
  });
  it("expires after five minutes and does not extend expiry on repeated failed checks", () => {
    let now = 0; const memory = new FeedbackDraftMemory("a", () => now); memory.activate("a", "k", Symbol(), value); memory.observe("checking", "a");
    now = FEEDBACK_DRAFT_TTL - 1; memory.observe("temporary-error", "a"); expect(memory.read("a", "k")).toEqual(value);
    now += 2; expect(memory.read("a", "k")).toBeNull(); memory.prune(); memory.observe("authenticated", "a"); expect(memory.read("a", "k")).toBeNull();
  });
  it("evicts the oldest entry beyond the small explicit limit and isolates keys", () => {
    const memory = new FeedbackDraftMemory("a"); for (let i = 0; i <= FEEDBACK_DRAFT_LIMIT; i++) memory.activate("a", String(i), Symbol(), { ...value, texto: String(i) });
    memory.observe("checking", "a"); expect(memory.read("a", "0")).toBeNull();
    for (let i = 1; i <= FEEDBACK_DRAFT_LIMIT; i++) expect(memory.read("a", String(i))?.texto).toBe(String(i)); expect(memory.read("b", "1")).toBeNull();
  });
  it("rejects oversized invalid values and copies only editable fields", () => {
    const memory = new FeedbackDraftMemory("a"); memory.activate("a", "large", Symbol(), { ...value, texto: "x".repeat(12001) });
    memory.activate("a", "safe", Symbol(), { ...value, token: "must not enter memory", versionNormas: "old" } as typeof value); memory.observe("checking", "a");
    expect(memory.read("a", "large")).toBeNull(); expect(memory.read("a", "safe")).toEqual(value);
    const copy = memory.read("a", "safe")!; copy.texto = "Changed outside"; expect(memory.read("a", "safe")).toEqual(value);
  });
  it("a confirmed old request can clear its interrupted lease but cannot clear a newer editor", () => {
    const { memory, token } = setup(); memory.observe("checking", "a"); memory.release("a", "k", token); memory.discard("a", "k", token); expect(memory.read("a", "k")).toBeNull();
    memory.observe("authenticated", "a"); const next = Symbol(); memory.activate("a", "k", next, value); memory.discard("a", "k", token); memory.release("a", "k", token); memory.observe("checking", "a"); expect(memory.read("a", "k")).toEqual(value);
    memory.clear(); expect(memory.read("a", "k")).toBeNull();
  });
});
