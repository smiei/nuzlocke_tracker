import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// Reads the source tree and checks the conventions the UI overhaul introduced,
// the same way pwa.test.ts guards the manifest workaround. A convention nobody
// can check drifts back within a few features - this app had 69 distinct button
// class signatures and 24 card paddings before, all of which arrived one
// reasonable-looking line at a time.

const root = process.cwd();

function sourceFiles(dir: string): string[] {
  return readdirSync(path.join(root, dir)).flatMap((entry) => {
    const rel = path.join(dir, entry);
    if (statSync(path.join(root, rel)).isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry) && !entry.endsWith(".test.ts") ? [rel] : [];
  });
}

const files = sourceFiles("src").map((file) => ({
  file,
  text: readFileSync(path.join(root, file), "utf-8"),
}));

/** Lines matching `pattern`, with the comment lines dropped. */
function hits(pattern: RegExp, skip: (file: string) => boolean = () => false) {
  const found: string[] = [];
  for (const { file, text } of files) {
    if (skip(file)) continue;
    text.split("\n").forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (pattern.test(line)) found.push(`${file}:${i + 1} ${line.trim()}`);
    });
  }
  return found;
}

describe("UI conventions", () => {
  it("keeps raw palette colours out of the app", () => {
    // Every colour goes through a token in globals.css, so light and dark stay
    // in step. Before the overhaul there were 435 hand-paired `x dark:x`
    // declarations that had drifted - ten different zinc shades for "border".
    //
    // The exceptions are all data visualisation, where a fill has to be a
    // saturated mid-tone that carries on either theme background. A semantic
    // token cannot do that job: those are text colours, and a cell filled with
    // one washes out (which is exactly what happened to the type matrix).
    // Kept short on purpose: an allowlist entry that is not actually needed is
    // a hole. (lib/pokemonTypes.ts is not here - its per-type colours are hex
    // values, not Tailwind classes, so the rule never touches them.)
    const allowed = [
      "src/components/PokemonDetailModal.tsx", // base-stat ramp
      "src/components/MoveDetailPanel.tsx", // physical / special categories
    ];
    expect(
      hits(
        /(?:bg|text|border|divide|ring|accent|from|to|via)-(?:zinc|slate|gray|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
        (file) => allowed.includes(file.replace(/\\/g, "/")),
      ),
    ).toEqual([]);
  });

  it("keeps the type scale to Tailwind's steps", () => {
    // 58% of all text was 12px or smaller, and `text-[10px]` / `text-[11px]`
    // were a third and fourth size below that.
    expect(hits(/text-\[\d+px\]/)).toEqual([]);
  });

  it("has exactly one modal implementation", () => {
    // Six hand-rolled overlays carried this identical string, and between them
    // none trapped focus, two closed on Escape, none locked scroll.
    expect(
      hits(/fixed inset-0 z-50/, (file) => file.replace(/\\/g, "/") === "src/components/ui/Modal.tsx"),
    ).toEqual([]);
  });

  it("has exactly one click-outside implementation", () => {
    // Nine dropdowns carried their own copy; only two closed on Escape.
    expect(
      hits(/addEventListener\(\s*"mousedown"/, (file) =>
        file.replace(/\\/g, "/") === "src/lib/useDropdown.ts",
      ),
    ).toEqual([]);
  });

  it("never removes a focus ring without putting one back", () => {
    // globals.css gives every interactive element a focus-visible ring. An
    // `outline-none` is only legitimate where the ring is drawn on a wrapper
    // instead, which is a focus-within rule on the same file.
    for (const { file, text } of files) {
      if (!text.includes("outline-none")) continue;
      expect(text, `${file} removes the focus ring`).toMatch(/focus-within:outline|focus-visible:/);
    }
  });

  it("never uses a number input", () => {
    // Mobile browsers run their own min/max/step validation on type="number" at
    // the UA level, independent of the React-controlled value - a field can get
    // stuck unable to go below `min` or be cleared. useClampedIntInput plus
    // inputMode="numeric" is the replacement.
    expect(hits(/type="number"/)).toEqual([]);
  });

  it("lets every page title be the page's own h1", () => {
    // The only <h1> used to be the app name in the header, and every page title
    // was an <h2> in one of five different treatments. PageHeader renders the
    // <h1> now; a page-title-sized <h2> is that mistake coming back.
    expect(hits(/<h2[^>]*className="[^"]*text-xl font-semibold/)).toEqual([]);
  });
});
