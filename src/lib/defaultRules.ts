// Built-in starter ruleset for the Rules tab. Used when a run has no rules
// yet: the very first run gets this, every later run copies from the most
// recent run instead (see createRun).
export const DEFAULT_RULES = `# Nuzlocke-Regelwerk

## Grundregeln

1. **Fangregel:** Pro Route/Gebiet darf nur das **erste** wilde Pokémon gefangen werden. Entkommt es oder wird es besiegt, gibt es auf dieser Route keinen weiteren Versuch.
2. **Tod ist endgültig:** Fällt ein Pokémon im Kampf (KP auf 0), gilt es als **tot**. Es wird dauerhaft in die Box gelegt oder freigelassen und darf nie wieder eingesetzt werden.
3. **Spitznamen-Pflicht:** Jedes gefangene Pokémon bekommt einen Spitznamen – für die emotionale Bindung.

## SoulLink-Zusatzregeln

4. **Seelenpartner:** Die Fänge beider Spieler auf derselben Route sind miteinander **verlinkt**.
5. **Gemeinsames Schicksal:** Stirbt ein Pokémon, stirbt auch sein Link-Partner. Beide werden aus dem Team entfernt.
6. **Species Clause:** Jede Evolutionsfamilie darf im gesamten Run nur **einmal** verwendet werden – über beide Spieler hinweg. Statische Geschenk-Pokémon sind davon ausgenommen.
7. **Team-Paarung:** Ein Pokémon darf nur im Team stehen, wenn auch sein Link-Partner im Team ist.

## Meilensteine / Level Caps

8. **Level-Limit:** Vor jedem Meilenstein (Arenaleiter, Top 4, Champ) gilt das dort angegebene **Maximal-Level**. Übertrainierte Pokémon dürfen bis zum Erreichen des Meilensteins nicht eingesetzt werden.

## Optionale Regeln

- **Keine Items im Kampf** (Heilung nur außerhalb von Kämpfen).
- **Duplicate Clause:** Ist der erste Encounter einer Route eine bereits gefangene Spezies (oder deren Familie), zählt stattdessen der nächste neue Encounter.
- **Shiny Clause:** Shinys dürfen immer gefangen werden, unabhängig von der Fangregel.
- **Kampfstil:** Auf "Kampf: Folge" (Set-Modus) stellen – kein kostenloser Wechsel nach gegnerischen K.O.s.
`;
