// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Notice } from "@/components/ui/Notice";

afterEach(cleanup);

describe("Notice", () => {
  it.each([["error", "alert"], ["success", "status"], ["warning", "status"]] as const)("renders a %s notice as a div with role %s", (tone, role) => {
    render(<Notice tone={tone}>Message</Notice>);
    const notice = screen.getByRole(role);
    expect(notice.tagName).toBe("DIV");
    expect(notice.className).toBe(`notice ${tone}`);
    expect(notice.hasAttribute("tabindex")).toBe(false);
    expect(document.activeElement).not.toBe(notice);
  });

  it("takes focus when it appears with focusOnShow", () => {
    render(<Notice tone="error" focusOnShow>Server error</Notice>);
    const notice = screen.getByRole("alert");
    expect(notice.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(notice);
  });
});
