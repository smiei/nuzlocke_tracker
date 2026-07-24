// Downloads and crops individual gym badge icons for the Journey/Overview
// tabs. Source: SteGriff/pokemon-badges (CC-BY 3.0), a single sheet
// (badges.png) with one row per region (Kanto/Johto/Hoenn/Sinnoh/Unova) and
// 8 badges per row - there are no individual per-badge files or metadata in
// that repo, and the rows/columns are hand-arranged (not an even grid: row
// heights and gaps vary), so this detects each badge's actual bounding box
// by scanning for near-blank rows/columns rather than assuming fixed cells.
//
// Column order within a row has no labels either, so data/badges.json
// hand-curates each region's badge order (verified once against the
// rendered sheet). We only need the first 4 rows since every game pack in
// this app is gen 1-4. Output files are named by slug(badge.en) - the same
// strings already used in data/games/<id>/levelcaps.json's `badge.en`, so
// the app needs no separate id-to-region mapping at render time, just the
// slug.
//
// Not committed (see .gitignore/.dockerignore) - same "no copyrighted
// artwork in the repo/image" policy as the Pokémon sprites; downloaded fresh
// on every container start, skipping files that already exist.
// Run manually: node scripts/download-badges.mjs
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
const outDir = path.join(__dirname, "..", "public", "badges");

const SHEET_URL = "https://raw.githubusercontent.com/SteGriff/pokemon-badges/master/badges.png";
const REGION_ROW_ORDER = ["Kanto", "Johto", "Hoenn", "Sinnoh", "Unova"]; // top-to-bottom in the sheet
const PADDING = 3; // px kept around each detected badge so anti-aliased edges aren't clipped

function slug(nameEn) {
  return nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Bands of "content" (non-blank) indices along one axis, separated by runs
// of (near-)blank lines at least `minGap` long. `ink(i)` returns how many
// non-background pixels line `i` has.
function findBands(length, minGap, ink) {
  const bands = [];
  let bandStart = null;
  let blankRun = 0;
  for (let i = 0; i < length; i++) {
    if (ink(i) > 2) {
      if (bandStart === null) bandStart = i;
      blankRun = 0;
    } else if (bandStart !== null) {
      blankRun++;
      if (blankRun >= minGap) {
        bands.push([bandStart, i - blankRun]);
        bandStart = null;
        blankRun = 0;
      }
    }
  }
  if (bandStart !== null) bands.push([bandStart, length - 1 - blankRun]);
  return bands;
}

async function main() {
  const regions = JSON.parse(await readFile(path.join(dataDir, "badges.json"), "utf-8"));
  await mkdir(outDir, { recursive: true });

  const wantedRegions = Object.keys(regions);
  const allSlugs = Object.values(regions)
    .flat()
    .map((name) => slug(name));
  if (allSlugs.every((s) => existsSync(path.join(outDir, `${s}.png`)))) {
    console.log(`badges: complete (${allSlugs.length})`);
    return;
  }

  const res = await fetch(SHEET_URL);
  if (!res.ok) throw new Error(`${SHEET_URL} -> HTTP ${res.status}`);
  const sheet = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(sheet).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  function isInk(x, y) {
    const idx = (y * width + x) * channels;
    const a = data[idx + 3];
    if (a <= 10) return false;
    const [r, g, b] = [data[idx], data[idx + 1], data[idx + 2]];
    return !(r > 250 && g > 250 && b > 250); // treat near-white as background too
  }

  const rowInk = (y) => {
    let n = 0;
    for (let x = 0; x < width; x++) if (isInk(x, y)) n++;
    return n;
  };
  const rowBands = findBands(height, 20, rowInk);
  if (rowBands.length < REGION_ROW_ORDER.length) {
    throw new Error(`expected >=${REGION_ROW_ORDER.length} region rows in badges.png, found ${rowBands.length}`);
  }

  let saved = 0;
  for (let r = 0; r < wantedRegions.length; r++) {
    const region = wantedRegions[r];
    const rowIdx = REGION_ROW_ORDER.indexOf(region);
    if (rowIdx === -1 || rowIdx >= rowBands.length) {
      console.warn(`[warn] region "${region}" not found in the sheet - skipping`);
      continue;
    }
    const [yStart, yEnd] = rowBands[rowIdx];
    const colInk = (x) => {
      let n = 0;
      for (let y = yStart; y <= yEnd; y++) if (isInk(x, y)) n++;
      return n;
    };
    const colBands = findBands(width, 14, colInk);
    const names = regions[region];
    if (colBands.length < names.length) {
      throw new Error(
        `expected >=${names.length} badges in row "${region}", found ${colBands.length} column bands`,
      );
    }
    for (let c = 0; c < names.length; c++) {
      const target = path.join(outDir, `${slug(names[c])}.png`);
      if (existsSync(target)) continue;
      const [xStart, xEnd] = colBands[c];
      const left = Math.max(0, xStart - PADDING);
      const top = Math.max(0, yStart - PADDING);
      const cropWidth = Math.min(width - left, xEnd - xStart + 1 + PADDING * 2);
      const cropHeight = Math.min(height - top, yEnd - yStart + 1 + PADDING * 2);
      // Two separate pipelines: chaining .extract().trim() in one sharp()
      // call errors with "bad extract area" on some cells for reasons
      // unclear, but re-wrapping the extracted buffer in a fresh sharp()
      // before trimming works reliably.
      const cropped = await sharp(sheet)
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .toBuffer();
      await sharp(cropped).trim().toFile(target);
      saved++;
    }
  }
  console.log(`badges: ${saved}/${allSlugs.length} downloaded`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
