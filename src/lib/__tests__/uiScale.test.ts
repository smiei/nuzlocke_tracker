import { describe, it, expect } from "vitest";
import { UI_SCALE_KEY, UI_SCALE_STEPS, uiScaleBootScript } from "@/lib/uiScale";

// The boot script is a string the browser parses, so TypeScript never sees
// it. It shipped with a stray ")" once, and because the hook only applies the
// size when it is changed, every reload quietly fell back to 100%.
function runBootScript(stored: string | null | (() => never)) {
  const html = { style: { fontSize: "" } };
  const localStorage = {
    getItem: (key: string) => {
      if (typeof stored === "function") return stored();
      return key === UI_SCALE_KEY ? stored : null;
    },
  };
  new Function("localStorage", "document", uiScaleBootScript())(localStorage, { documentElement: html });
  return html.style.fontSize;
}

describe("uiScaleBootScript", () => {
  it("parses and applies the stored step before first paint", () => {
    expect(runBootScript("4")).toBe(UI_SCALE_STEPS[4]);
    expect(runBootScript("0")).toBe(UI_SCALE_STEPS[0]);
  });

  it("leaves the page alone without a valid stored step", () => {
    expect(runBootScript(null)).toBe("");
    expect(runBootScript("7")).toBe("");
    expect(runBootScript('"big"')).toBe("");
    expect(runBootScript("{not json")).toBe("");
  });

  it("swallows blocked storage", () => {
    expect(
      runBootScript(() => {
        throw new Error("SecurityError");
      }),
    ).toBe("");
  });
});
