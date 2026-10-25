// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Badge } from "@/components/ui/Badge";

afterEach(cleanup);

describe("Badge", () => {
  it.each(["role", "upcoming", "solid", "soft", "outline"] as const)("renders the %s tone as a span with its class", (tone) => {
    render(<Badge tone={tone}>Label</Badge>);
    const badge = screen.getByText("Label");
    expect(badge.tagName).toBe("SPAN");
    expect(badge.className).toBe(`badge badge-${tone}`);
  });
});
