// Adds/refreshes localized display names (de/en/fr/es/it) in data/pokemon.json,
// data/routes.json, and data/levelcaps.json, converting the old two-language
// fields (name_de/name_en, name/name_en, ...) into a `names` object keyed by
// language. Re-runnable: accepts both the old and the new format as input;
// de/en values are curated by hand and are never overwritten, only fr/es/it
// are (re)generated.
//
// Sources:
// - Pokémon names:  PokeAPI /pokemon-species/{id} (full coverage)
// - Location names: PokeAPI /location/{slug} (Kanto + Sevii)
// - Trainer, badge, and composite static-encounter names: hand-curated tables
//   below (not available in PokeAPI) - review these when spot-checking.
//
// Run manually: node scripts/generate-names.mjs
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");

const EXTRA_LANGS = ["fr", "es", "it"];

// ---------------------------------------------------------------------------
// Hand-curated tables (things PokeAPI doesn't know)
// ---------------------------------------------------------------------------

// Gym leaders / Elite Four / recurring fights, keyed by the English name.
// Languages without a confident official name are omitted (-> English).
const TRAINER_NAMES = {
  Rival: { fr: "Rival", es: "Rival", it: "Rivale" },
  // Kanto (FRLG)
  Brock: { fr: "Pierre", es: "Brock", it: "Brock" },
  Misty: { fr: "Ondine", es: "Misty", it: "Misty" },
  "Lt. Surge": { fr: "Major Bob", es: "Teniente Surge", it: "Lt. Surge" },
  Erika: { fr: "Erika", es: "Erika", it: "Erika" },
  Koga: { fr: "Koga", es: "Koga", it: "Koga" },
  Sabrina: { fr: "Morgane", es: "Sabrina", it: "Sabrina" },
  Blaine: { fr: "Auguste", es: "Blaine", it: "Blaine" },
  Giovanni: { fr: "Giovanni", es: "Giovanni", it: "Giovanni" },
  Lorelei: { fr: "Olga", es: "Lorelei", it: "Lorelei" },
  Bruno: { fr: "Aldo", es: "Bruno", it: "Bruno" },
  Agatha: { fr: "Agatha", es: "Agatha", it: "Agatha" },
  Lance: { fr: "Peter", es: "Lance", it: "Lance" },
  Champion: { fr: "Champion", es: "Campeón", it: "Campione" },
  // Hoenn (Emerald)
  Roxanne: { fr: "Roxanne", es: "Petra", it: "Roxanne" },
  Brawly: { fr: "Bastien", es: "Marcial", it: "Brawly" },
  Wattson: { fr: "Voltère", es: "Erico", it: "Wattson" },
  Flannery: { fr: "Adriane", es: "Candela", it: "Flannery" },
  Norman: { fr: "Norman", es: "Norman", it: "Norman" },
  Winona: { fr: "Alizée", es: "Alana", it: "Winona" },
  "Tate & Liza": { fr: "Lévy & Tatia", es: "Vito & Leti", it: "Tate & Liza" },
  Juan: { fr: "Juan", es: "Galano", it: "Juan" },
  Sidney: { fr: "Damien", es: "Sixto", it: "Sidney" },
  Phoebe: { fr: "Spectra", es: "Fátima", it: "Phoebe" },
  Glacia: { fr: "Glacia", es: "Nívea", it: "Glacia" },
  Drake: { fr: "Aragon", es: "Dracón", it: "Drake" },
  Wallace: { fr: "Marc", es: "Plubio", it: "Wallace" },
  Maxie: { fr: "Max", es: "Magno" },
  Archie: { fr: "Arthur", es: "Aquiles" },
  Wally: { fr: "Timmy", es: "Blasco" },
  // Johto (Gold/Silver) - Italian omitted where unsure (-> English).
  Falkner: { fr: "Albert", es: "Pegaso" },
  Bugsy: { fr: "Hector", es: "Antón" },
  Whitney: { fr: "Blanche", es: "Blanca" },
  Morty: { fr: "Mortimer", es: "Morti" },
  Chuck: { fr: "Chuck", es: "Aníbal" },
  Jasmine: { fr: "Jasmine", es: "Yasmina" },
  Pryce: { fr: "Frédo", es: "Fredo" },
  Clair: { fr: "Sandra", es: "Débora" },
  Will: { fr: "Clément", es: "Mento" },
  Karen: { fr: "Marion", es: "Karen" },
  Janine: { fr: "Jeannine" },
  Blue: { fr: "Blue", es: "Azul", it: "Blu" },
  Red: { fr: "Red", es: "Rojo", it: "Rosso" },
  // Sinnoh (Platinum)
  Roark: { fr: "Pierrick", es: "Roco" },
  Gardenia: { fr: "Flo", es: "Gardenia" },
  Fantina: { fr: "Kiméra", es: "Fantina" },
  Maylene: { fr: "Mélina", es: "Brega" },
  "Crasher Wake": { fr: "Lovis", es: "Mananti" },
  Byron: { fr: "Charles", es: "Acerón" },
  Candice: { fr: "Gladys", es: "Inverna" },
  Volkner: { fr: "Tanguy", es: "Lectro" },
  Cyrus: { fr: "Hélio", es: "Helio" },
  Aaron: { fr: "Aaron", es: "Alecrán" },
  Bertha: { fr: "Terry", es: "Gaia" },
  Flint: { fr: "Adrien", es: "Fausto" },
  Lucian: { fr: "Lucio", es: "Delos" },
  Cynthia: { fr: "Cynthia", es: "Cintia", it: "Camilla" },
};

// Badges, keyed by the English name.
const BADGE_NAMES = {
  // Kanto
  "Boulder Badge": { fr: "Badge Roche", es: "Medalla Roca", it: "Medaglia Sasso" },
  "Cascade Badge": { fr: "Badge Cascade", es: "Medalla Cascada", it: "Medaglia Cascata" },
  "Thunder Badge": { fr: "Badge Foudre", es: "Medalla Trueno", it: "Medaglia Tuono" },
  "Rainbow Badge": { fr: "Badge Prisme", es: "Medalla Arcoíris", it: "Medaglia Arcobaleno" },
  "Soul Badge": { fr: "Badge Âme", es: "Medalla Alma", it: "Medaglia Anima" },
  "Marsh Badge": { fr: "Badge Marais", es: "Medalla Pantano", it: "Medaglia Palude" },
  "Volcano Badge": { fr: "Badge Volcan", es: "Medalla Volcán", it: "Medaglia Vulcano" },
  "Earth Badge": { fr: "Badge Terre", es: "Medalla Tierra", it: "Medaglia Terra" },
  // Hoenn
  "Stone Badge": { fr: "Badge Roc", es: "Medalla Piedra", it: "Medaglia Roccia" },
  "Knuckle Badge": { fr: "Badge Poing", es: "Medalla Puño", it: "Medaglia Pugno" },
  "Dynamo Badge": { fr: "Badge Dynamo", es: "Medalla Dinamo", it: "Medaglia Dinamo" },
  "Heat Badge": { fr: "Badge Chaleur", es: "Medalla Calor", it: "Medaglia Calore" },
  "Balance Badge": { fr: "Badge Équilibre", es: "Medalla Equilibrio", it: "Medaglia Equilibrio" },
  "Feather Badge": { fr: "Badge Plume", es: "Medalla Pluma", it: "Medaglia Piuma" },
  "Mind Badge": { fr: "Badge Esprit", es: "Medalla Mente", it: "Medaglia Mente" },
  "Rain Badge": { fr: "Badge Pluie", es: "Medalla Lluvia", it: "Medaglia Pioggia" },
  // Johto
  "Zephyr Badge": { fr: "Badge Zéphyr", es: "Medalla Céfiro", it: "Medaglia Zefiro" },
  "Hive Badge": { fr: "Badge Essaim", es: "Medalla Colmena", it: "Medaglia Alveare" },
  "Plain Badge": { fr: "Badge Plaine", es: "Medalla Planicie", it: "Medaglia Pianura" },
  "Fog Badge": { fr: "Badge Brume", es: "Medalla Niebla", it: "Medaglia Nebbia" },
  "Storm Badge": { fr: "Badge Tempête", es: "Medalla Tormenta", it: "Medaglia Tempesta" },
  "Mineral Badge": { fr: "Badge Minéral", es: "Medalla Mineral", it: "Medaglia Minerale" },
  "Glacier Badge": { fr: "Badge Glacier", es: "Medalla Glaciar", it: "Medaglia Ghiacciaio" },
  "Rising Badge": { fr: "Badge Lever", es: "Medalla Alzada", it: "Medaglia Ascesa" },
  // Sinnoh
  "Coal Badge": { fr: "Badge Charbon", es: "Medalla Lignito", it: "Medaglia Carbone" },
  "Forest Badge": { fr: "Badge Forêt", es: "Medalla Bosque", it: "Medaglia Foresta" },
  "Relic Badge": { fr: "Badge Relique", es: "Medalla Reliquia", it: "Medaglia Reliquia" },
  "Cobble Badge": { fr: "Badge Galet", es: "Medalla Adoquín", it: "Medaglia Ciottolo" },
  "Fen Badge": { fr: "Badge Fange", es: "Medalla Ciénaga", it: "Medaglia Palude" },
  "Mine Badge": { fr: "Badge Mine", es: "Medalla Mina", it: "Medaglia Miniera" },
  "Icicle Badge": { fr: "Badge Glaçon", es: "Medalla Carámbano", it: "Medaglia Ghiacciolo" },
  "Beacon Badge": { fr: "Badge Phare", es: "Medalla Faro", it: "Medaglia Faro" },
};

// Journey locations that aren't plain PokeAPI locations, keyed by English.
const LEVELCAP_LOCATIONS = {
  "Elite Four": { fr: "Conseil 4", es: "Alto Mando", it: "Superquattro" },
  "S.S. Anne, Vermilion City": {
    fr: "S.S. Anne, Carmin sur Mer",
    es: "S.S. Anne, Ciudad Carmín",
    it: "M/N Anna, Aranciopoli",
  },
  "Rocket Hideout, Celadon City": {
    fr: "Repaire Rocket, Céladopole",
    es: "Guarida Rocket, Ciudad Azulona",
    it: "Covo Rocket, Azzurropoli",
  },
  "Pokémon Tower, Lavender Town": {
    fr: "Tour Pokémon, Lavanville",
    es: "Torre Pokémon, Pueblo Lavanda",
    it: "Torre Pokémon, Lavandonia",
  },
  "Silph Co., Saffron City": {
    fr: "Sylphe SARL, Safrania",
    es: "Silph S.A., Ciudad Azafrán",
    it: "Silph SpA, Zafferanopoli",
  },
  "Pokémon League": { fr: "Ligue Pokémon", es: "Liga Pokémon", it: "Lega Pokémon" },
  "Distortion World": { fr: "Monde Distorsion", es: "Mundo Distorsión", it: "Mondo Distorto" },
};

// Composite static-encounter routes, keyed "<gameId>:<routeId>":
// "<subject> <base location>". The base location is resolved via PokeAPI like
// every plain route; the subject is either a Pokémon (speciesId -> localized
// species name) or a hand-written label. `full` short-circuits everything.
const ROUTE_COMPOSITES = {
  "firered:1": { full: { fr: "Starter", es: "Inicial", it: "Starter" } },
  "firered:53": { subject: { fr: "Vendeur", es: "Vendedor", it: "Venditore" }, baseEn: "Route 4" },
  "firered:54": { subject: { fr: "Fossile", es: "Fósil", it: "Fossile" }, baseEn: "Mt. Moon" },
  "firered:55": { speciesId: 143, baseEn: "Route 12" },
  "firered:56": { speciesId: 133, baseEn: "Celadon City" },
  "firered:57": { speciesId: 143, baseEn: "Route 16" },
  "firered:58": {
    subject: { fr: "Dojo Karaté", es: "Dojo Karate", it: "Dojo di Lotta" },
    baseEn: "Saffron City",
  },
  "firered:59": { full: { fr: "Sylphe SARL", es: "Silph S.A.", it: "Silph SpA" } },
  "firered:60": { speciesId: 145, baseEn: "Power Plant" },
  "firered:61": { speciesId: 144, baseEn: "Seafoam Islands" },
  "firered:62": {
    subject: { fr: "Vieil Ambre", es: "Ámbar Viejo", it: "Vecchia Ambra" },
    baseEn: "Pewter City",
  },
  "firered:65": { speciesId: 146, baseEn: "Mt. Ember" },
  "firered:69": { speciesId: 97, baseEn: "Berry Forest" },
  "firered:72": {
    subject: { fr: "Œuf de Togepi", es: "Huevo de Togepi", it: "Uovo di Togepi" },
    baseEn: "Water Labyrinth",
  },
  "firered:84": { speciesId: 150, baseEn: "Cerulean Cave" },
  "emerald:1": { full: { fr: "Starter", es: "Inicial", it: "Starter" } },
  "emerald:22": { subject: { fr: "Fossile", es: "Fósil", it: "Fossile" }, baseEn: "Mirage Tower" },
  "emerald:30": {
    subject: { fr: "Œuf d'Okéoké", es: "Huevo de Wynaut", it: "Uovo di Wynaut" },
    baseEn: "Lavaridge Town",
  },
  "emerald:33": { speciesId: 351, baseEn: "Weather Institute" },
  "emerald:35": { speciesId: 352, baseEn: "Route 120" },
  "emerald:42": { speciesId: 101, baseEn: "Aqua Hideout" },
  "emerald:60": { speciesId: 100, baseEn: "New Mauville" },
  "emerald:63": { speciesId: 384, baseEn: "Sky Pillar" },
  "emerald:65": { speciesId: 377, baseEn: "Desert Ruins" },
  "emerald:66": { speciesId: 378, baseEn: "Island Cave" },
  "emerald:67": { speciesId: 379, baseEn: "Ancient Tomb" },
  "emerald:68": { speciesId: 374, baseEn: "Mossdeep City" },
  "emerald:69": {
    full: {
      fr: "Latias/Latios (itinérant)",
      es: "Latias/Latios (errante)",
      it: "Latias/Latios (vagante)",
    },
  },
  "emerald:70": { speciesId: 382, baseEn: "Marine Cave" },
  "emerald:71": { speciesId: 383, baseEn: "Terra Cave" },
  "emerald:75": { speciesId: 185, baseEn: "Battle Frontier" },
  "red-blue:1": { full: { fr: "Starter", es: "Inicial", it: "Starter" } },
  "red-blue:10": { subject: { fr: "Vendeur", es: "Vendedor", it: "Venditore" }, baseEn: "Route 4" },
  "red-blue:12": { subject: { fr: "Fossile", es: "Fósil", it: "Fossile" }, baseEn: "Mt. Moon" },
  "red-blue:26": { speciesId: 143, baseEn: "Route 12" },
  "red-blue:30": { speciesId: 133, baseEn: "Celadon City" },
  "red-blue:32": { speciesId: 143, baseEn: "Route 16" },
  "red-blue:41": {
    subject: { fr: "Dojo Karaté", es: "Dojo Karate", it: "Dojo di Lotta" },
    baseEn: "Saffron City",
  },
  "red-blue:42": { full: { fr: "Sylphe SARL", es: "Silph S.A.", it: "Silph SpA" } },
  "red-blue:44": { speciesId: 145, baseEn: "Power Plant" },
  "red-blue:48": { speciesId: 144, baseEn: "Seafoam Islands" },
  "red-blue:50": {
    subject: { fr: "Vieil Ambre", es: "Ámbar Viejo", it: "Vecchia Ambra" },
    baseEn: "Pewter City",
  },
  "red-blue:55": { speciesId: 146, baseEn: "Victory Road" },
  "red-blue:57": { speciesId: 150, baseEn: "Cerulean Cave" },
  "gold-silver:1": { full: { fr: "Starter", es: "Inicial", it: "Starter" } },
  "gold-silver:9": {
    subject: { fr: "Œuf de Togepi", es: "Huevo de Togepi", it: "Uovo di Togepi" },
    baseEn: "Violet City",
  },
  "gold-silver:17": { speciesId: 133, baseEn: "Goldenrod City" },
  "gold-silver:21": { speciesId: 185, baseEn: "Route 36" },
  "gold-silver:32": { speciesId: 213, baseEn: "Cianwood City" },
  "gold-silver:35": { speciesId: 236, baseEn: "Mt. Mortar" },
  "gold-silver:38": { speciesId: 130, baseEn: "Lake of Rage" },
  "gold-silver:43": { speciesId: 147, baseEn: "Dragon's Den" },
  "gold-silver:49": { speciesId: 249, baseEn: "Whirl Islands" },
  "gold-silver:50": { speciesId: 250, baseEn: "Bell Tower" },
  "gold-silver:51": {
    full: {
      fr: "Raikou/Entei/Suicune (itinérant)",
      es: "Raikou/Entei/Suicune (errante)",
      it: "Raikou/Entei/Suicune (vagante)",
    },
  },
  "gold-silver:66": { speciesId: 143, baseEn: "Vermilion City" },
  "platinum:1": { full: { fr: "Starter", es: "Inicial", it: "Starter" } },
  "platinum:10": {
    subject: { fr: "Fossile", es: "Fósil", it: "Fossile" },
    baseEn: "Oreburgh City",
  },
  "platinum:13": { speciesId: 425, baseEn: "Valley Windworks" },
  "platinum:16": { speciesId: 479, baseEn: "Old Chateau" },
  "platinum:17": {
    subject: { fr: "Œuf de Togepi", es: "Huevo de Togepi", it: "Uovo di Togepi" },
    baseEn: "Eterna City",
  },
  "platinum:22": { speciesId: 133, baseEn: "Hearthome City" },
  "platinum:24": { speciesId: 442, baseEn: "Route 209" },
  "platinum:41": {
    subject: { fr: "Œuf de Riolu", es: "Huevo de Riolu", it: "Uovo di Riolu" },
    baseEn: "Iron Island",
  },
  "platinum:48": { speciesId: 480, baseEn: "Lake Acuity" },
  "platinum:49": { speciesId: 482, baseEn: "Lake Valor" },
  "platinum:50": {
    full: { fr: "Créfollet (itinérant)", es: "Mesprit (errante)", it: "Mesprit (vagante)" },
  },
  "platinum:51": { speciesId: 487, baseEn: "Distortion World" },
  "platinum:64": { speciesId: 485, baseEn: "Stark Mountain" },
  "platinum:65": { speciesId: 486, baseEn: "Snowpoint Temple" },
  "platinum:67": {
    full: { fr: "Cresselia (itinérante)", es: "Cresselia (errante)", it: "Cresselia (vagante)" },
  },
};

// English location name -> PokeAPI location slug, where the generic
// slugification doesn't hit. Everything else tries `<slug>` and `kanto-<slug>`.
const LOCATION_SLUG_OVERRIDES = {
  "Safari Zone": "kanto-safari-zone",
  "Victory Road": "kanto-victory-road-2",
};

// Hand-curated location names that WIN over PokeAPI. PokeAPI has no Spanish/
// Italian location names at all (the games were localized, the API data just
// lacks them), and the odd French entry has Gen-1 ALL-CAPS styling. Obscure
// Sevii areas without a confident official translation are deliberately left
// out - they fall back to English and can be edited live in data/ anytime.
const LOCAL_LOCATION_NAMES = {
  "Diglett's Cave": { fr: "Cave Taupiqueur", es: "Cueva Diglett", it: "Grotta di Diglett" },
  "Pallet Town": { es: "Pueblo Paleta", it: "Biancavilla" },
  "Viridian City": { es: "Ciudad Verde", it: "Smeraldopoli" },
  "Viridian Forest": { es: "Bosque Verde", it: "Bosco Smeraldo" },
  "Pewter City": { es: "Ciudad Plateada", it: "Plumbeopoli" },
  "Mt. Moon": { es: "Monte Luna", it: "Monte Luna" },
  "Cerulean City": { es: "Ciudad Celeste", it: "Celestopoli" },
  "Vermilion City": { es: "Ciudad Carmín", it: "Aranciopoli" },
  "Rock Tunnel": { es: "Túnel Roca", it: "Tunnel Roccioso" },
  "Lavender Town": { es: "Pueblo Lavanda", it: "Lavandonia" },
  "Pokémon Tower": { es: "Torre Pokémon", it: "Torre Pokémon" },
  "Celadon City": { es: "Ciudad Azulona", it: "Azzurropoli" },
  "Fuchsia City": { es: "Ciudad Fucsia", it: "Fucsiapoli" },
  "Safari Zone": { es: "Zona Safari", it: "Zona Safari" },
  "Saffron City": { es: "Ciudad Azafrán", it: "Zafferanopoli" },
  "Power Plant": { es: "Central Energía", it: "Centrale Elettrica" },
  "Seafoam Islands": { es: "Islas Espuma", it: "Isole Schiuma" },
  "Cinnabar Island": { es: "Isla Canela", it: "Cinabropoli" },
  "Pokémon Mansion": { es: "Mansión Pokémon", it: "Villa Pokémon" },
  "Victory Road": { es: "Calle Victoria", it: "Via Vittoria" },
  "Cerulean Cave": { es: "Cueva Celeste", it: "Grotta Celeste" },
  "One Island": { es: "Isla Prima", it: "Primisola" },
  "Two Island": { es: "Isla Segunda", it: "Secondisola" },
  "Three Island": { es: "Isla Tercera", it: "Terzisola" },
  "Four Island": { es: "Isla Cuarta", it: "Quartisola" },
  "Five Island": { es: "Isla Quinta", it: "Quintisola" },
  "Six Island": { es: "Isla Sexta", it: "Sestisola" },
  "Seven Island": { es: "Isla Séptima", it: "Settimisola" },
  "Mt. Ember": { es: "Monte Ascuas", it: "Monte Brace" },
  "Berry Forest": { es: "Bosque Baya" },
  "Lost Cave": { es: "Cueva Perdida", it: "Grotta Smarrita" },
  "Tanoby Ruins": { es: "Ruinas Tanoby", it: "Rovine Tanoby" },
  // Hoenn (Emerald) - Italian city names deliberately omitted where unsure.
  "Petalburg City": { es: "Ciudad Petalia" },
  "Rustboro City": { es: "Ciudad Férrica" },
  "Dewford Town": { es: "Pueblo Azuliza" },
  "Slateport City": { es: "Ciudad Portual" },
  "Mauville City": { es: "Ciudad Malvalona" },
  "Lavaridge Town": { es: "Pueblo Lavacalda" },
  "Fortree City": { es: "Ciudad Arborada" },
  "Lilycove City": { es: "Ciudad Calagua" },
  "Mossdeep City": { es: "Ciudad Algaria" },
  "Sootopolis City": { es: "Ciudad Arrecípolis" },
  "Pacifidlog Town": { es: "Pueblo Oromar" },
  "Petalburg Woods": { es: "Bosque Petalia" },
  "Granite Cave": { es: "Cueva Granito" },
  "Meteor Falls": { es: "Cascada Meteoro" },
  "Mt. Pyre": { es: "Monte Pírico" },
  "Mt. Chimney": { es: "Monte Cenizo" },
  "Shoal Cave": { es: "Cueva Cardumen" },
  "Seafloor Cavern": { es: "Caverna Abisal" },
  "Abandoned Ship": { es: "Barco Abandonado" },
  "Sky Pillar": { fr: "Pilier Céleste", es: "Pilar Celeste" },
  "Weather Institute": { fr: "Institut Météo", es: "Instituto Meteorológico" },
  "Aqua Hideout": { fr: "Repaire Aqua", es: "Guarida Aqua", it: "Covo Aqua" },
  "Magma Hideout": { fr: "Repaire Magma", es: "Guarida Magma", it: "Covo Magma" },
  "New Mauville": { fr: "Nouveau Lavandia", es: "Nueva Malvalona" },
  "Battle Frontier": { fr: "Zone de Combat", es: "Frente de Batalla", it: "Parco Lotta" },
};

// ---------------------------------------------------------------------------

function slugify(nameEn) {
  return nameEn
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/'/g, "") // "Diglett's Cave" -> digletts-cave
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

// PokeAPI `names` array -> { fr, es, it } (missing languages are dropped).
function pickLangs(apiNames) {
  const out = {};
  for (const lang of EXTRA_LANGS) {
    const hit = apiNames?.find((n) => n.language?.name === lang);
    if (hit?.name) out[lang] = hit.name;
  }
  return out;
}

const locationCache = new Map();
async function locationNames(nameEn) {
  if (locationCache.has(nameEn)) return locationCache.get(nameEn);
  const base = slugify(nameEn);
  // Numbered routes are region-prefixed in PokeAPI; Kanto sea routes (19-21)
  // are "kanto-sea-route-N". The regions' route numbers don't overlap
  // (Kanto 1-28, Johto 29-48, Hoenn 101-134, Sinnoh 201-230), so trying all
  // prefixes is unambiguous.
  const candidates = LOCATION_SLUG_OVERRIDES[nameEn]
    ? [LOCATION_SLUG_OVERRIDES[nameEn]]
    : /^route \d+$/i.test(nameEn)
      ? [`kanto-${base}`, `kanto-sea-${base}`, `johto-${base}`, `hoenn-${base}`, `sinnoh-${base}`]
      : [base, `kanto-${base}`, `johto-${base}`, `hoenn-${base}`, `sinnoh-${base}`];
  let result = {};
  for (const slug of candidates) {
    const data = await fetchJson(`https://pokeapi.co/api/v2/location/${slug}`);
    if (data) {
      result = pickLangs(data.names);
      // Old Gen-1-era entries carry ALL-CAPS species tokens ("Cave
      // TAUPIQUEUR") - normalize them to title case.
      for (const [lang, value] of Object.entries(result)) {
        result[lang] = value.replace(/\b[A-ZÀ-Þ]{3,}\b/g, (w) => w[0] + w.slice(1).toLowerCase());
      }
      break;
    }
  }
  // Numbered routes: es/it keep the English "Route N" in PokeAPI, but the
  // localized games call them "Ruta N" / "Percorso N".
  const routeNo = nameEn.match(/^Route (\d+)$/);
  if (routeNo) {
    result.es ??= `Ruta ${routeNo[1]}`;
    result.it ??= `Percorso ${routeNo[1]}`;
  }
  // PokeAPI (official localization) wins; the curated table only fills gaps.
  result = { ...LOCAL_LOCATION_NAMES[nameEn], ...result };
  if (Object.keys(result).length === 0) {
    console.warn(`[warn] no location names for "${nameEn}" - falling back to English`);
  }
  locationCache.set(nameEn, result);
  return result;
}

// Old format -> { de, en } regardless of which shape the file is in.
function baseNames(entry, deKey, enKey) {
  return {
    de: entry.names?.de ?? entry[deKey],
    en: entry.names?.en ?? entry[enKey],
  };
}

function buildNames(base, extra) {
  // Fill gaps with English so the data always shows what's rendered.
  const names = { de: base.de, en: base.en };
  for (const lang of EXTRA_LANGS) names[lang] = extra[lang] ?? base.en;
  return names;
}

async function main() {
  const readData = async (file) => JSON.parse(await readFile(path.join(dataDir, file), "utf-8"));
  const writeData = (file, data) =>
    writeFile(path.join(dataDir, file), JSON.stringify(data, null, 2) + "\n", "utf-8");

  // --- Pokémon ------------------------------------------------------------
  const pokemon = await readData("pokemon.json");
  const speciesNames = new Map(); // id -> {fr,es,it}
  const batchSize = 10;
  for (let i = 0; i < pokemon.length; i += batchSize) {
    const batch = pokemon.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (p) => {
        const data = await fetchJson(`https://pokeapi.co/api/v2/pokemon-species/${p.id}`);
        if (!data) throw new Error(`species ${p.id} not found`);
        speciesNames.set(p.id, pickLangs(data.names));
      }),
    );
    console.log(`species ${Math.min(i + batchSize, pokemon.length)}/${pokemon.length}`);
    await new Promise((r) => setTimeout(r, 100));
  }

  const newPokemon = pokemon.map((p) => {
    const base = baseNames(p, "name_de", "name_en");
    return {
      id: p.id,
      names: buildNames(base, speciesNames.get(p.id)),
      types: p.types,
      family_id: p.family_id,
      stats: p.stats,
    };
  });
  await writeData("pokemon.json", newPokemon);
  console.log(`pokemon.json: ${newPokemon.length} entries`);

  // --- Game packs (routes + levelcaps per game) -----------------------------
  const gamesDir = path.join(dataDir, "games");
  const gameIds = (await readdir(gamesDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const gameId of gameIds) {
    const routes = await readData(path.join("games", gameId, "routes.json")).catch(() => null);
    if (routes) {
      const newRoutes = [];
      for (const r of routes) {
        const base = baseNames(r, "name", "name_en");
        const composite = ROUTE_COMPOSITES[`${gameId}:${r.id}`];
        let extra;
        if (composite?.full) {
          extra = composite.full;
        } else if (composite) {
          const subject = composite.speciesId
            ? speciesNames.get(composite.speciesId)
            : composite.subject;
          const loc = await locationNames(composite.baseEn);
          extra = {};
          for (const lang of EXTRA_LANGS) {
            const s = subject?.[lang];
            const l = loc[lang];
            if (s && l) extra[lang] = `${s} ${l}`;
          }
        } else {
          extra = await locationNames(base.en);
        }
        const entry = { id: r.id, names: buildNames(base, extra), type: r.type };
        if (r.postgame) entry.postgame = true;
        newRoutes.push(entry);
      }
      await writeData(path.join("games", gameId, "routes.json"), newRoutes);
      console.log(`games/${gameId}/routes.json: ${newRoutes.length} entries`);
    }

    const levelcaps = await readData(path.join("games", gameId, "levelcaps.json")).catch(
      () => null,
    );
    if (levelcaps) {
      const newCaps = [];
      for (const c of levelcaps) {
        const nameBase = baseNames(c, "name", "name_en");
        const locBase = {
          de: c.location?.de ?? c.location,
          en: c.location?.en ?? c.location_en,
        };
        const badgeBase = (c.badge?.de ?? c.badge)
          ? { de: c.badge?.de ?? c.badge, en: c.badge?.en ?? c.badge_en }
          : null;

        const trainerExtra = TRAINER_NAMES[nameBase.en];
        if (!trainerExtra) console.warn(`[warn] no trainer translation for "${nameBase.en}"`);

        const locExtra =
          LEVELCAP_LOCATIONS[locBase.en] ?? (await locationNames(locBase.en));

        const entry = {
          id: c.id,
          names: buildNames(nameBase, trainerExtra ?? {}),
          location: buildNames(locBase, locExtra),
          badge: badgeBase ? buildNames(badgeBase, BADGE_NAMES[badgeBase.en] ?? {}) : null,
          max_level: c.max_level,
        };
        if (c.sprite) entry.sprite = c.sprite;
        newCaps.push(entry);
      }
      await writeData(path.join("games", gameId, "levelcaps.json"), newCaps);
      console.log(`games/${gameId}/levelcaps.json: ${newCaps.length} entries`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
