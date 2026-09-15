import { describe, it, expect } from "vitest";
import { parseBackup, BACKUP_FORMAT, BACKUP_VERSION } from "@/lib/backupParse";

const envelope = (runs: unknown[], version = BACKUP_VERSION) =>
  JSON.stringify({ format: BACKUP_FORMAT, version, exportedAt: "2026-01-01T00:00:00.000Z", runs });

describe("parseBackup v3 fields", () => {
  it("defaults deathLevelCapId/diedAt/fusedInto to null for an old (v2) file", () => {
    const json = envelope(
      [
        {
          name: "Old Run",
          mode: "SOULLINK",
          gameId: "firered",
          rulesMarkdown: "",
          settingsJson: "{}",
          createdAt: "2026-01-01T00:00:00.000Z",
          soulLinks: [{ routeId: 3, status: "DEAD", teamPosition: null }],
          encounters: [
            {
              routeId: 3, player: "PLAYER1", pokemonId: 1, currentPokemonId: 1,
              familyId: 1, status: "CAUGHT", isStatic: false, shiny: false,
            },
          ],
        },
      ],
      2,
    );
    const parsed = parseBackup(json)!;
    expect(parsed.version).toBe(2);
    expect(parsed.runs[0].soulLinks[0].deathLevelCapId).toBeNull();
    expect(parsed.runs[0].soulLinks[0].diedAt).toBeNull();
    expect(parsed.runs[0].encounters[0].fusedInto).toBeNull();
  });

  it("reads deathLevelCapId/diedAt/fusedInto when present", () => {
    const json = envelope([
      {
        name: "Fusion Run",
        mode: "SOULLINK",
        gameId: "infinite-fusion-classic",
        rulesMarkdown: "",
        settingsJson: "{}",
        createdAt: "2026-01-01T00:00:00.000Z",
        soulLinks: [
          {
            routeId: 3, status: "DEAD", teamPosition: null,
            deathLevelCapId: 5, diedAt: "2026-02-01T00:00:00.000Z",
          },
        ],
        encounters: [
          {
            routeId: 3, player: "PLAYER1", pokemonId: 1, currentPokemonId: 1,
            familyId: 1, status: "CAUGHT", isStatic: false, shiny: false,
            fusedInto: { routeId: 6, player: "PLAYER1" },
          },
        ],
      },
    ]);
    const parsed = parseBackup(json)!;
    expect(parsed.runs[0].soulLinks[0].deathLevelCapId).toBe(5);
    expect(parsed.runs[0].soulLinks[0].diedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(parsed.runs[0].encounters[0].fusedInto).toEqual({ routeId: 6, player: "PLAYER1" });
  });

  it("rejects a malformed fusedInto instead of throwing", () => {
    const json = envelope([
      {
        name: "Run",
        mode: "SOULLINK",
        gameId: "firered",
        rulesMarkdown: "",
        settingsJson: "{}",
        createdAt: "2026-01-01T00:00:00.000Z",
        soulLinks: [],
        encounters: [
          {
            routeId: 3, player: "PLAYER1", pokemonId: 1, currentPokemonId: 1,
            familyId: 1, status: "CAUGHT", isStatic: false, shiny: false,
            fusedInto: { routeId: "not-a-number", player: "PLAYER1" },
          },
        ],
      },
    ]);
    const parsed = parseBackup(json)!;
    expect(parsed.runs[0].encounters[0].fusedInto).toBeNull();
  });
});
