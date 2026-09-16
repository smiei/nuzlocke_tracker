import { describe, it, expect } from "vitest";
import { MAX_VISITED_RUNS, parseVisitedRuns, withVisitedRun, withoutVisitedRun } from "@/lib/visitedRuns";

const K1 = "aaaaaaaaaaaaaaaaaaaaa";
const K2 = "bbbbbbbbbbbbbbbbbbbbb";
const K3 = "ccccccccccccccccccccc";

describe("parseVisitedRuns", () => {
  it("reads a dot-separated list of keys", () => {
    expect(parseVisitedRuns(`${K1}.${K2}`)).toEqual([K1, K2]);
  });

  it("drops anything that isn't shaped like a run key", () => {
    expect(parseVisitedRuns(`${K1}.not-a-key!.7.${K2}`)).toEqual([K1, K2]);
  });

  it("deduplicates, keeping the first occurrence", () => {
    expect(parseVisitedRuns(`${K1}.${K2}.${K1}`)).toEqual([K1, K2]);
  });

  it("returns nothing for empty or missing input", () => {
    expect(parseVisitedRuns(undefined)).toEqual([]);
    expect(parseVisitedRuns(null)).toEqual([]);
    expect(parseVisitedRuns("")).toEqual([]);
  });

  it("caps at MAX_VISITED_RUNS even if the cookie somehow held more", () => {
    const many = Array.from({ length: MAX_VISITED_RUNS + 10 }, (_, i) => `key${i}`.padEnd(21, "x")).join(".");
    expect(parseVisitedRuns(many)).toHaveLength(MAX_VISITED_RUNS);
  });
});

describe("withVisitedRun", () => {
  it("puts a new key at the front", () => {
    expect(withVisitedRun([K1, K2], K3)).toEqual([K3, K1, K2]);
  });

  it("moves an existing key to the front instead of duplicating it", () => {
    expect(withVisitedRun([K1, K2], K2)).toEqual([K2, K1]);
  });

  it("caps the list at MAX_VISITED_RUNS", () => {
    const full = Array.from({ length: MAX_VISITED_RUNS }, (_, i) => `key${i}`.padEnd(21, "x"));
    const result = withVisitedRun(full, K1);
    expect(result).toHaveLength(MAX_VISITED_RUNS);
    expect(result[0]).toBe(K1);
    expect(result).not.toContain(full[MAX_VISITED_RUNS - 1]);
  });
});

describe("withoutVisitedRun", () => {
  it("removes a key, leaving the rest in order", () => {
    expect(withoutVisitedRun([K1, K2, K3], K2)).toEqual([K1, K3]);
  });

  it("is a no-op for a key that isn't there", () => {
    expect(withoutVisitedRun([K1, K2], K3)).toEqual([K1, K2]);
  });
});
