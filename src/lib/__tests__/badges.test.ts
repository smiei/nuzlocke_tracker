import { describe, it, expect } from "vitest";
import { badgeSlug } from "@/lib/badges";

describe("badgeSlug", () => {
  it("lowercases and dashes multi-word names", () => {
    expect(badgeSlug("Boulder Badge")).toBe("boulder-badge");
    expect(badgeSlug("Rising Badge")).toBe("rising-badge");
  });

  it("strips characters outside a-z0-9 and collapses runs to a single dash", () => {
    expect(badgeSlug("Soul  Badge!")).toBe("soul-badge");
  });

  it("has no leading or trailing dash", () => {
    expect(badgeSlug(" Earth Badge ")).toBe("earth-badge");
  });
});
