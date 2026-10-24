// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { EmptyState } from "@/components/ui/EmptyState";

afterEach(cleanup);

describe("EmptyState", () => {
  it("renders a list empty state as one paragraph inside a panel", () => {
    const { container } = render(<EmptyState>No items yet.</EmptyState>);
    expect(container.innerHTML).toBe('<div class="card card-panel"><p>No items yet.</p></div>');
  });

  it("puts the action inline after the message", () => {
    const { container } = render(<EmptyState action={<a href="/back">Go back</a>}>No items yet.</EmptyState>);
    expect(container.querySelector(".card-panel > p")?.innerHTML).toBe('No items yet. <a href="/back">Go back</a>');
  });

  it("renders the full block with symbol, badge, title, paragraphs and action", () => {
    const { container } = render(<EmptyState symbol="PB" badge="Soon" title="Coming" action={<a href="/home">Home</a>}><p>Detail.</p></EmptyState>);
    const card = container.querySelector(".card.card-empty");
    expect(Array.from(card?.children ?? []).map((child) => child.outerHTML)).toEqual([
      '<span class="empty-symbol" aria-hidden="true">PB</span>',
      '<span class="badge badge-upcoming">Soon</span>',
      "<h2>Coming</h2>",
      "<p>Detail.</p>",
      '<a href="/home">Home</a>',
    ]);
  });

  it("renders the full block without an action", () => {
    const { container } = render(<EmptyState title="Coming"><p>Detail.</p></EmptyState>);
    expect(container.innerHTML).toBe('<div class="card card-empty"><h2>Coming</h2><p>Detail.</p></div>');
  });
});
