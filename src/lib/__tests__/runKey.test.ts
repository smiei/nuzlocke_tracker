import { describe, it, expect } from "vitest";
import { isRunKeyShaped, pickActiveRun } from "@/lib/runKey";

describe("isRunKeyShaped", () => {
  it("accepts both key formats a run can have", () => {
    expect(isRunKeyShaped("V1StGXR8_Z5jdHi6B-myT")).toBe(true); // nanoid()
    expect(isRunKeyShaped("3f9a0c1d2e4b5a6978c0d1e2f3a4b5c6")).toBe(true); // migration backfill
  });

  it("rejects what cannot be a key before it reaches a query", () => {
    for (const value of [undefined, null, 42, {}, ["abc"], "", "7", "short", "x".repeat(65), "has space in it!!", "a/b/c/d/e/f/g/h/i"]) {
      expect(isRunKeyShaped(value)).toBe(false);
    }
  });
});

describe("pickActiveRun", () => {
  const runs = [
    { id: 1, accessKey: "aaaaaaaaaaaaaaaaaaaaa" },
    { id: 12, accessKey: "bbbbbbbbbbbbbbbbbbbbb" },
  ];

  it("finds a run by its key", () => {
    expect(pickActiveRun(runs, "bbbbbbbbbbbbbbbbbbbbb")?.id).toBe(12);
  });

  it("still understands a numeric id bookmarked before keys existed", () => {
    expect(pickActiveRun(runs, "12")?.id).toBe(12);
  });

  it("falls back to the oldest run for anything it does not know", () => {
    expect(pickActiveRun(runs, null)?.id).toBe(1);
    expect(pickActiveRun(runs, "zzzzzzzzzzzzzzzzzzzzz")?.id).toBe(1);
    expect(pickActiveRun(runs, "99")?.id).toBe(1);
    expect(pickActiveRun([], "12")).toBeUndefined();
  });
});
