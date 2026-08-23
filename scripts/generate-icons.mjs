// Rasterises src/app/icon.svg into the PNG sizes a PWA install needs.
//
// Unlike the sprite/badge downloaders this needs no network and the output is
// OUR artwork, so it may legitimately live in the image. It is still a build
// artefact rather than a committed file, for one specific reason: .gitignore
// carries a global unanchored `*.png`, so a committed public/icons/*.png would
// be silently absent from git while still present in a local Docker build
// context - i.e. it would work on this machine and be missing from a clean
// clone. Generating instead sidesteps that entirely.
//
// Wired in via npm's `prebuild`/`predev` lifecycle, so `npm run build` (which
// the Dockerfile's builder stage already runs) produces the icons before
// `COPY --from=builder /app/public` picks them up. No Dockerfile change needed.
// Run manually: node scripts/generate-icons.mjs  (or npm run generate:icons)
import { mkdir, stat, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceSvg = path.join(__dirname, "..", "src", "app", "icon.svg");
const outDir = path.join(__dirname, "..", "public", "icons");

// Opaque backdrop for the variants that must not be transparent. Matches the
// app's dark background (Tailwind zinc-950, i.e. what `dark:bg-zinc-950` on
// <body> actually paints) and the manifest's background_color.
const DARK = { r: 9, g: 9, b: 11, alpha: 1 };
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

// `scale` = how much of the canvas the motif fills.
// - "any" icons keep a small breathing margin (0.92).
// - maskable icons must survive Android cropping the canvas to an arbitrary
//   launcher shape: everything essential has to sit inside the 80% safe
//   circle, so the motif is inset harder AND the background must be opaque.
// - iOS renders transparency as black and applies its own squircle, so the
//   apple-touch icon is opaque too.
const TARGETS = [
  { file: "icon-192.png", size: 192, scale: 0.92, background: CLEAR },
  { file: "icon-512.png", size: 512, scale: 0.92, background: CLEAR },
  { file: "icon-maskable-192.png", size: 192, scale: 0.8, background: DARK },
  { file: "icon-maskable-512.png", size: 512, scale: 0.8, background: DARK },
  { file: "apple-touch-icon.png", size: 180, scale: 0.84, background: DARK },
  { file: "favicon-32.png", size: 32, scale: 1, background: CLEAR },
];

async function isUpToDate() {
  if (!existsSync(sourceSvg)) return false;
  const source = await stat(sourceSvg);
  for (const target of TARGETS) {
    const file = path.join(outDir, target.file);
    if (!existsSync(file)) return false;
    const out = await stat(file);
    if (out.mtimeMs < source.mtimeMs) return false;
  }
  return true;
}

async function render(svg, { size, scale, background }) {
  const inner = Math.round(size * scale);
  // density scales librsvg's rasterisation: the SVG declares 512px at the
  // default 96dpi, so 384dpi renders it at 2048px before the downscale - the
  // curves stay clean at 512 instead of showing stair-stepping.
  const motif = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: "contain", background: CLEAR })
    .png()
    .toBuffer();
  const offset = Math.round((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: motif, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  if (!existsSync(sourceSvg)) {
    console.error(`icons: source missing (${sourceSvg})`);
    process.exitCode = 1;
    return;
  }
  if (await isUpToDate()) {
    console.log("icons: up to date");
    return;
  }
  await mkdir(outDir, { recursive: true });
  const svg = await readFile(sourceSvg);
  for (const target of TARGETS) {
    const png = await render(svg, target);
    await writeFile(path.join(outDir, target.file), png);
    console.log(`icons: ${target.file} (${png.length} B)`);
  }
  console.log(`icons: ${TARGETS.length} written to public/icons/`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
