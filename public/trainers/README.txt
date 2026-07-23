TRAINER AVATARS  (Reise / Journey page)
=======================================

User-provided PNGs shown next to each trainer. A missing file just shows an
initial-letter placeholder - never an error. These are NOT in the repo or the
Docker image (copyrighted art): mount THIS folder as /app/public/trainers and
drop your files in. Recommended size >=80x80px, square (shown as a circle).

LOOKUP ORDER for each trainer:
  1. /trainers/<trainerSet>/<slug>.png    game-specific (checked FIRST)
  2. /trainers/<slug>.png                 shared fallback (this root)
  3. initial-letter placeholder

So: put a file in the flat ROOT to use it for ALL games; put one in a
<trainerSet> subfolder to override it for that game only.

<slug> = German name, lowercased, accents stripped, spaces & "&" -> "-".
  Examples: Rocko->rocko, "Ben & Svenja"->ben-svenja,
  "Vorstand Athena & Rüpel"->vorstand-athena-rupel, "Kimono-Mädels"->kimono-madels.
  The slug always uses the GERMAN name, whatever UI language is set.

trainerSet SUBFOLDERS (one per game; HeartGold + SoulSilver share one, since
their trainers are identical):
  red-blue/   gold-silver/   firered/   emerald/   platinum/   heartgold-soulsilver/

NOTE ON THE RIVAL: every game calls its rival "Rivale" -> slug "rivale", but
it is a DIFFERENT character/look per game. Give each its own file:
  red-blue/rivale.png  gold-silver/rivale.png  emerald/rivale.png
  platinum/rivale.png  heartgold-soulsilver/rivale.png
(FireRed/LeafGreen reuse the champion art for the rival -> firered uses champ.png.)
Recurring gym leaders/Elite Four (Rocko, Misty, ...) are the same person across
games: one file in the root is enough, unless you want generation-accurate art
- then drop a per-game copy in that game folder.

FULL NAME REFERENCE (74 slugs) - [folders where the name appears]:

  adam.png                    Adam                    [platinum]
  agathe.png                  Agathe                  [red-blue, firered]
  antonia.png                 Antonia                 [emerald]
  archie.png                  Archie                  [emerald]
  ben-svenja.png              Ben & Svenja            [emerald]
  bianka.png                  Bianka                  [gold-silver, heartgold-soulsilver]
  blau.png                    Blau                    [gold-silver, heartgold-soulsilver]
  bruno.png                   Bruno                   [red-blue, gold-silver, firered, heartgold-soulsilver]
  champ.png                   Champ / Rivale          [red-blue, firered]
  cynthia.png                 Cynthia                 [platinum]
  dragan.png                  Dragan                  [emerald]
  erika.png                   Erika                   [red-blue, gold-silver, firered, heartgold-soulsilver]
  eusin.png                   Eusin                   [heartgold-soulsilver]
  falk.png                    Falk                    [gold-silver, heartgold-soulsilver]
  felizia.png                 Felizia                 [emerald]
  flavia.png                  Flavia                  [emerald]
  frida.png                   Frida                   [platinum]
  frosina.png                 Frosina                 [emerald]
  giovanni.png                Giovanni                [red-blue, firered]
  hartwig.png                 Hartwig                 [gold-silver, heartgold-soulsilver]
  heiko.png                   Heiko                   [emerald]
  herbaro.png                 Herbaro                 [platinum]
  hilda.png                   Hilda                   [platinum]
  ignaz.png                   Ignaz                   [platinum]
  janina.png                  Janina                  [gold-silver, heartgold-soulsilver]
  jasmin.png                  Jasmin                  [gold-silver, heartgold-soulsilver]
  jens.png                    Jens                    [gold-silver, heartgold-soulsilver]
  juan.png                    Juan                    [emerald]
  jupiter.png                 Jupiter                 [platinum]
  kai.png                     Kai                     [gold-silver, heartgold-soulsilver]
  kalle.png                   Kalle                   [emerald]
  kamillo.png                 Kamillo                 [emerald]
  kimono-madels.png           Kimono-Mädels           [heartgold-soulsilver]
  koga.png                    Koga                    [red-blue, gold-silver, firered, heartgold-soulsilver]
  kordula.png                 Kordula                 [emerald]
  lamina.png                  Lamina                  [platinum]
  lorelei.png                 Lorelei                 [red-blue, firered]
  lucian.png                  Lucian                  [platinum]
  major-bob.png               Major Bob               [red-blue, gold-silver, firered, heartgold-soulsilver]
  marinus.png                 Marinus                 [platinum]
  mars.png                    Mars                    [platinum]
  mars-jupiter.png            Mars & Jupiter          [platinum]
  maxie.png                   Maxie                   [emerald]
  maxie-kalle.png             Maxie & Kalle           [emerald]
  melanie.png                 Melanie                 [gold-silver, heartgold-soulsilver]
  misty.png                   Misty                   [red-blue, gold-silver, firered, heartgold-soulsilver]
  norbert.png                 Norbert                 [gold-silver, heartgold-soulsilver]
  norman.png                  Norman                  [emerald]
  pyro.png                    Pyro                    [red-blue, gold-silver, firered, heartgold-soulsilver]
  rivale.png                  Rivale                  [red-blue, gold-silver, emerald, platinum, heartgold-soulsilver]
  rocko.png                   Rocko                   [red-blue, gold-silver, firered, heartgold-soulsilver]
  rot.png                     Rot                     [gold-silver, heartgold-soulsilver]
  sabrina.png                 Sabrina                 [red-blue, gold-silver, firered, heartgold-soulsilver]
  sandra.png                  Sandra                  [gold-silver, heartgold-soulsilver]
  saturn.png                  Saturn                  [platinum]
  siegfried.png               Siegfried               [red-blue, gold-silver, firered, heartgold-soulsilver]
  silvana.png                 Silvana                 [platinum]
  teresa.png                  Teresa                  [platinum]
  troy-trumm.png              Troy Trumm              [emerald]
  ulrich.png                  Ulrich                  [emerald]
  veit.png                    Veit                    [platinum]
  volkner.png                 Volkner                 [platinum]
  vorstand-athena.png         Vorstand Athena         [heartgold-soulsilver]
  vorstand-athena-rupel.png   Vorstand Athena & Rüpel [heartgold-soulsilver]
  vorstand-atlas.png          Vorstand Atlas          [heartgold-soulsilver]
  vorstand-lamda.png          Vorstand Lamda          [heartgold-soulsilver]
  vorstand-lanzo.png          Vorstand Lanzo          [heartgold-soulsilver]
  walter.png                  Walter                  [emerald]
  wassili.png                 Wassili                 [emerald]
  weise-li.png                Weise Li                [heartgold-soulsilver]
  wibke.png                   Wibke                   [emerald]
  willi.png                   Willi                   [gold-silver, heartgold-soulsilver]
  wolfgang.png                Wolfgang                [emerald]
  zyrus.png                   Zyrus                   [platinum]
