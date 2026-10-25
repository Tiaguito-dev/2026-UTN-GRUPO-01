// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Card } from "@/components/ui/Card";

afterEach(cleanup);

describe("Card", () => {
  it.each(["panel", "empty", "profile", "auth"] as const)("renders the %s variant as a div with its class", (variant) => {
    render(<Card variant={variant}>Content</Card>);
    const card = screen.getByText("Content");
    expect(card.tagName).toBe("DIV");
    expect(card.className).toBe(`card card-${variant}`);
  });

  it("renders another element with `as` and forwards attributes", () => {
    render(<Card variant="auth" as="section" aria-label="Session problem">Content</Card>);
    const card = screen.getByRole("region", { name: "Session problem" });
    expect(card.tagName).toBe("SECTION");
    expect(card.className).toBe("card card-auth");
  });
});
