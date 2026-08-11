// Re-syncs Encounter.familyId with data/pokemon.json.
//
// familyId is denormalized onto every Encounter at write time so the Species
// Clause check is one indexed query. That means a correction to a species'
// family in pokemon.json does NOT reach rows that were already saved - and
// the shipped data had 384 species carrying an evolution-CHAIN id instead of
// the chain's root species id. Twelve of those collided across unrelated
// families (Seedot's line shared an id with Porygon-Z, so catching one
// warned about the other), which is exactly what a live run hit.
//
// Runs on every container start (docker-entrypoint.sh) right after
// `migrate deploy`: it only touches rows whose stored value disagrees with
// the current data, so it is idempotent and a no-op once healthy.
//
// The generated Prisma client is TypeScript and can't be imported from a
// plain .mjs script, so the update goes through `prisma db execute`.
// Run manually: node scripts/backfill-encounter-families.mjs
import { readFile, writeFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

async function main() {
  const pokemon = JSON.parse(
    await readFile(path.join(rootDir, "data", "pokemon.json"), "utf-8"),
  );

  // pokemonId -> family, for species AND formes (a forme shares its species').
  const pairs = pokemon
    .filter((p) => Number.isInteger(p.id) && Number.isInteger(p.family_id))
    .map((p) => [p.id, p.family_id]);
  if (pairs.length === 0) {
    console.log("backfill: pokemon.json has no usable entries - skipping");
    return;
  }

  const cases = pairs.map(([id, fam]) => `WHEN ${id} THEN ${fam}`).join(" ");
  const ids = pairs.map(([id]) => id).join(",");
  const sql =
    `UPDATE "Encounter" SET "familyId" = CASE "pokemonId" ${cases} END ` +
    `WHERE "pokemonId" IN (${ids}) ` +
    `AND "familyId" <> CASE "pokemonId" ${cases} END;`;

  const file = path.join(os.tmpdir(), `nuzlocke-familyid-${process.pid}.sql`);
  await writeFile(file, sql, "utf-8");
  try {
    await run("npx", ["prisma", "db", "execute", "--file", file, "--schema", "prisma/schema.prisma"], {
      cwd: rootDir,
      shell: process.platform === "win32",
    });
    console.log(`backfill: Encounter.familyId re-synced against ${pairs.length} species`);
  } finally {
    await unlink(file).catch(() => {});
  }
}

main().catch((err) => {
  // Never block startup: a stale familyId only affects the informational
  // Species Clause warning, it can't corrupt anything.
  console.error("WARNING: familyId backfill failed:", err.message);
});
