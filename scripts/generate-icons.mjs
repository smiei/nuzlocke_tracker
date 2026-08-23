// Renders branding/icon.* into every icon size the PWA install needs.
//
// The source lives in branding/ rather than src/app/ on purpose: as
// src/app/icon.svg it would be a Next file-convention route and Next would
// auto-inject its own <link rel="icon">, which we could then neither replace
// nor point at the overridable copy below.
//
// Output is a build artefact, never committed - .gitignore carries a global
// unanchored `*.png`, so a committed public/icons/*.png would be invisible to
// git while still present in a local Docker build context: working here,
// missing on a clean clone. npm's prebuild/predev hooks run this, so the
// Dockerfile's existing `npm run build` produces the icons in the builder
// stage and needs no change.
//
// PRIVATE BRANDING OVERRIDE
// The runner stage does NOT copy branding/, so at container start the path
// /app/branding only exists if something is mounted there. docker-entrypoint.sh
// re-runs this script with --force, which means a private icon dropped into
// that mount replaces the icons at runtime WITHOUT ever entering the repo or
// the public Docker image. That separation is the point: the published image
// must stay free of third-party artwork, exactly like the trainer sprites.
//
// Run manually: node scripts/generate-icons.mjs [--source <file>] [--force]
import { mkdir, stat, writeFile, readFile, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const outDir = path.join(rootDir, "public", "icons");

const args = process.argv.slice(2);
const force = args.includes("--force");
const sourceArg = args.indexOf("--source");

// A private override is usually a bitmap - most logos are, and tracing one to
// vector would lose its shading anyway. sharp reads both; the only thing that
// differs downstream is how the backdrop and the framing are chosen. First
// match wins; the repo default is the SVG.
const SOURCE_NAMES = ["icon.svg", "icon.png", "icon.jpg", "icon.jpeg", "icon.webp"];
const RASTER_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif"]);

function resolveSource(dir) {
  for (const name of SOURCE_NAMES) {
    const candidate = path.join(dir, name);
    if (existsSync(candidate)) return candidate;
  }
  return path.join(dir, "icon.svg"); // reported as missing further down
}

const sourceFile =
  sourceArg !== -1 && args[sourceArg + 1]
    ? path.resolve(args[sourceArg + 1])
    : resolveSource(path.join(rootDir, "branding"));
const sourceIsRaster = RASTER_EXTS.has(path.extname(sourceFile).toLowerCase());

// Opaque backdrop for the variants that must not be transparent. Matches the
// app's dark background (Tailwind zinc-950, i.e. what `dark:bg-zinc-950` on
// <body> actually paints) and the manifest's background_color.
const DARK = { r: 9, g: 9, b: 11, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// `scale` = how much of the canvas the motif fills.
// - "any" icons keep a small breathing margin.
// - maskable icons must survive Android cropping the canvas to an arbitrary
//   launcher shape: everything essential has to sit inside the 80% safe
//   circle, so the motif is inset harder AND the background must be opaque.
// - iOS renders transparency as black and applies its own squircle, so the
//   apple-touch icon is opaque too.
// `rasterScale` is the same slot for artwork that already carries its own
// background: there is no point insetting a finished tile, so it goes
// full-bleed except where the launcher will crop it.
const TARGETS = [
  { file: "icon-192.png", size: 192, scale: 0.92, rasterScale: 1, background: CLEAR },
  { file: "icon-512.png", size: 512, scale: 0.92, rasterScale: 1, background: CLEAR },
  { file: "icon-maskable-192.png", size: 192, scale: 0.8, rasterScale: 0.8, background: DARK },
  { file: "icon-maskable-512.png", size: 512, scale: 0.8, rasterScale: 0.8, background: DARK },
  { file: "apple-touch-icon.png", size: 180, scale: 0.84, rasterScale: 1, background: DARK },
  { file: "favicon-32.png", size: 32, scale: 1, rasterScale: 1, background: CLEAR },
];

// layout.tsx links /icons/icon.svg for the browser tab, so this file must
// always exist whatever the source format was.
const SVG_COPY = "icon.svg";

// Artwork with its own background (the common case for a bitmap logo) needs
// that same colour behind the maskable inset, or Android's crop reveals a hard
// edge between the tile and our zinc-950. Averaging an 8x8 corner patch is
// enough and costs nothing. A transparent corner means the artwork is a free
// -standing motif, so the normal rules apply instead.
async function sampleBackdrop(buffer) {
  const meta = await sharp(buffer).metadata();
  if (!meta.width || !meta.height || meta.width < 8 || meta.height < 8) return null;
  const { data } = await sharp(buffer)
    .extract({ left: 0, top: 0, width: 8, height: 8 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  const pixels = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    a += data[i + 3];
  }
  if (a / pixels < 128) return null; // effectively transparent
  return {
    r: Math.round(r / pixels),
    g: Math.round(g / pixels),
    b: Math.round(b / pixels),
    alpha: 1,
  };
}

async function isUpToDate() {
  const source = await stat(sourceFile);
  for (const name of [...TARGETS.map((t) => t.file), SVG_COPY]) {
    const file = path.join(outDir, name);
    if (!existsSync(file)) return false;
    if ((await stat(file)).mtimeMs < source.mtimeMs) return false;
  }
  return true;
}

async function render(input, target, backdrop) {
  const scale = sourceIsRaster ? target.rasterScale : target.scale;
  const inner = Math.round(target.size * scale);
  const background = backdrop ?? target.background;
  // `density` only means anything for SVG: a 512px drawing at the default
  // 96dpi renders at 2048px, so the curves stay clean after the downscale
  // instead of showing stair-stepping. `fit: contain` never crops or
  // stretches - a non-square source is padded, not distorted.
  const motif = await sharp(input, { density: 384 })
    .resize(inner, inner, { fit: "contain", background: backdrop ?? CLEAR })
    .png()
    .toBuffer();
  const offset = Math.round((target.size - inner) / 2);
  return sharp({
    create: { width: target.size, height: target.size, channels: 4, background },
  })
    .composite([{ input: motif, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

// For a bitmap source there is no SVG to copy, but layout.tsx links one. Wrap
// the 192px render in a minimal SVG so /icons/icon.svg always resolves - an
// external href would not load here, since a favicon is rendered in a
// restricted context that blocks outside references.
async function writeSvgCopy() {
  if (!sourceIsRaster) {
    await copyFile(sourceFile, path.join(outDir, SVG_COPY));
    return;
  }
  const png = await readFile(path.join(outDir, "icon-192.png"));
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" width="192" height="192">' +
    '<image width="192" height="192" href="data:image/png;base64,' +
    png.toString("base64") +
    '"/></svg>\n';
  await writeFile(path.join(outDir, SVG_COPY), svg, "utf-8");
}

async function main() {
  if (!existsSync(sourceFile)) {
    // No source is only fatal when there is nothing to fall back on. At
    // container start without a branding mount this is the normal case: the
    // icons baked into the image during the build already stand.
    if (existsSync(path.join(outDir, "icon-512.png"))) {
      console.log("icons: no source at " + sourceFile + " - keeping existing icons");
      return;
    }
    console.error("icons: source missing (" + sourceFile + ")");
    process.exitCode = 1;
    return;
  }
  if (!force && (await isUpToDate())) {
    console.log("icons: up to date");
    return;
  }
  await mkdir(outDir, { recursive: true });
  const input = await readFile(sourceFile);
  const backdrop = sourceIsRaster ? await sampleBackdrop(input) : null;
  for (const target of TARGETS) {
    const png = await render(input, target, backdrop);
    await writeFile(path.join(outDir, target.file), png);
  }
  await writeSvgCopy();
  const backdropNote = backdrop
    ? " (backdrop rgb(" + backdrop.r + "," + backdrop.g + "," + backdrop.b + ") sampled)"
    : "";
  console.log(
    "icons: " + (TARGETS.length + 1) + " files from " + sourceFile + backdropNote,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
