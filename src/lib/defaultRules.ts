// Built-in starter ruleset for the Rules tab, per UI language. Used when a run
// has no rules yet: the very first run gets the creator-language version, every
// later run copies from the most recent run instead (see createRun). The Rules
// tab also offers "load default" to drop the current language's version in.
import type { Lang } from "@/lib/i18n/dictionary";

const de = `# 🔗 SoulLink Nuzlocke Spickzettel (Feuerrot)

## 💀 1. Grundregeln
* **Permadeath:** Fällt ein Pokémon auf 0 KP, ist es tot. (Dauerhaft in die Box oder freilassen).
* **Set-Modus:** In den Optionen "Kampfstil: Folge" einstellen (kein kostenloser Wechsel nach einem K.O.).
* **Spitznamen-Pflicht:** Jedes Pokémon braucht einen Namen. **Wichtig:** Der *andere* Spieler sucht den Namen aus!

## 🤝 2. SoulLink Mechanik
* **Seelenpartner:** Fänge beider Spieler auf derselben Route sind fest miteinander verlinkt.
* **Gemeinsames Schicksal:** Stirbt ein Partner, stirbt auch der andere. Beide fliegen aus dem Team.
* **Team-Paarung:** Ein Pokémon darf *nur* im Team sein, wenn sein Link-Partner beim anderen Spieler ebenfalls im Team ist.

## 🎯 3. Begegnungen & Fangen
* **Ein Fang pro Route:** Nur das *erste* wilde Pokémon pro Gebiet darf gefangen werden (entwischt oder besiegt = keine zweite Chance).
* **Shared Species / Dupes Clause:** Jede Entwicklungsreihe darf im gesamten Run über *beide* Spieler hinweg nur **einmal** existieren.
  * *Ausnahme:* Static-Encounter.
  * *Reroll:* Kommt ein Pokémon, das schon gefangen oder verpasst wurde, wird weitergesucht (rerolled), bis ein neuer, gültiger Encounter auftaucht.
* **Shiny Clause:** Shinys dürfen *immer* gefangen werden.

## 📈 4. Level-Limit & Sonderbonbons
* **Level-Cap:** Das Level des stärksten Pokémon des nächsten Bosses (Arena/Top4/Champ) ist das absolute Limit.
* **Team-Abstufung:**
  * **Maximal 1 Pokémon** darf dieses Maximal-Level erreichen.
  * **Alle anderen** müssen mindestens **2 Level darunter** bleiben.
  * *Strafe:* Überlevelte Pokémon dürfen nicht mehr eingesetzt werden, bis das nächste Level-Cap freigeschalten wurde.
* **Sonderbonbons:**
  * Unterwegs: Dürfen nur bis zum *letzten erreichten Cap (dem niedrigeren -2)* benutzt werden.
  * Vor Bossen: Dürfen *direkt vor* dem Boss benutzt werden, um an das aktuelle Cap zu leveln.

## 🎒 5. Items
* **Im Kampf:** Du darfst Items im Kampf *nur* einsetzen, wenn der Gegner ebenfalls eines eingesetzt hat (Auge um Auge).
* **Außerhalb:** Heilung etc. ist unbegrenzt erlaubt.
* **Randomizer:** Herumliegende Items, bestimmte Händler und getragene Items wilder Pokémon sind zufällig.

## 💿 6. Attacken & Entwicklungen
* **VMs:** Können von *jedem* Pokémon erlernt werden.
* **TMs:** Lernbarkeit muss dem Original (Feuerrot) entsprechen. (Im Zweifel googeln, falls das Randomizer-Verhalten komisch wirkt!).
* **Tauschentwicklungen:** Sind gepatcht und funktionieren jetzt über Level-Up oder Items.

---
### ⚡ Quick-Check vor jedem Kampf
1. Set-Modus an?  2. Level-Cap eingehalten?  3. Alle Link-Partner im Team?
`;

const en = `# 🔗 SoulLink Nuzlocke Cheat Sheet (FireRed)

## 💀 1. Core Rules
* **Permadeath:** If a Pokémon drops to 0 HP, it's dead. (Permanently boxed or released).
* **Set mode:** Set "Battle Style: Set" in the options (no free switch after a KO).
* **Mandatory nicknames:** Every Pokémon needs a name. **Important:** The *other* player picks the name!

## 🤝 2. SoulLink Mechanic
* **Soul partners:** Both players' catches on the same route are permanently linked.
* **Shared fate:** If one partner dies, so does the other. Both leave the team.
* **Team pairing:** A Pokémon may *only* be on the team if its link partner is on the other player's team too.

## 🎯 3. Encounters & Catching
* **One catch per route:** Only the *first* wild Pokémon per area may be caught (fled or defeated = no second chance).
* **Shared Species / Dupes Clause:** Each evolution line may exist only **once** across the entire run, over *both* players.
  * *Exception:* static encounters.
  * *Reroll:* If a Pokémon appears that was already caught or missed, keep searching (reroll) until a new, valid encounter shows up.
* **Shiny Clause:** Shinies may *always* be caught.

## 📈 4. Level Limit & Rare Candies
* **Level cap:** The level of the next boss's strongest Pokémon (Gym/Elite Four/Champion) is the hard limit.
* **Team tiering:**
  * **At most 1 Pokémon** may reach this maximum level.
  * **All others** must stay at least **2 levels below**.
  * *Penalty:* Over-levelled Pokémon may not be used until the next level cap is unlocked.
* **Rare Candies:**
  * On the road: may only be used up to the *last reached cap (the lower one, -2)*.
  * Before bosses: may be used *right before* the boss to level up to the current cap.

## 🎒 5. Items
* **In battle:** You may *only* use items in battle if the opponent used one too (eye for an eye).
* **Outside battle:** Healing etc. is unlimited.
* **Randomizer:** Items lying around, certain merchants, and wild Pokémon's held items are randomized.

## 💿 6. Moves & Evolutions
* **HMs:** Can be learned by *any* Pokémon.
* **TMs:** Learnability must match the original (FireRed). (When in doubt, google it if the randomizer behaves oddly!).
* **Trade evolutions:** Are patched and now work via level-up or items.

---
### ⚡ Quick check before every battle
1. Set mode on?  2. Level cap respected?  3. All link partners on the team?
`;

const fr = `# 🔗 Aide-mémoire SoulLink Nuzlocke (Rouge Feu)

## 💀 1. Règles de base
* **Permadeath :** Si un Pokémon tombe à 0 PV, il est mort. (Rangé définitivement dans la boîte ou relâché).
* **Mode Sélection :** Dans les options, régler « Style de combat : Sélection » (pas de changement gratuit après un K.O.).
* **Surnoms obligatoires :** Chaque Pokémon a besoin d'un nom. **Important :** c'est l'*autre* joueur qui choisit le nom !

## 🤝 2. Mécanique SoulLink
* **Partenaires d'âme :** Les captures des deux joueurs sur la même route sont liées de façon permanente.
* **Destin commun :** Si un partenaire meurt, l'autre meurt aussi. Les deux quittent l'équipe.
* **Appariement d'équipe :** Un Pokémon ne peut être dans l'équipe *que* si son partenaire lié est également dans l'équipe de l'autre joueur.

## 🎯 3. Rencontres & captures
* **Une capture par route :** Seul le *premier* Pokémon sauvage par zone peut être capturé (en fuite ou vaincu = pas de seconde chance).
* **Clause d'espèces partagées / doublons :** Chaque lignée d'évolution ne peut exister qu'**une seule fois** dans toute la partie, pour les *deux* joueurs.
  * *Exception :* rencontres statiques.
  * *Reroll :* Si un Pokémon déjà capturé ou manqué apparaît, on continue de chercher (reroll) jusqu'à une nouvelle rencontre valide.
* **Clause Chromatique :** Les Pokémon chromatiques peuvent *toujours* être capturés.

## 📈 4. Limite de niveau & Super Bonbons
* **Plafond de niveau :** Le niveau du Pokémon le plus fort du prochain boss (Arène/Conseil 4/Maître) est la limite absolue.
* **Hiérarchie d'équipe :**
  * **Au maximum 1 Pokémon** peut atteindre ce niveau maximum.
  * **Tous les autres** doivent rester au moins **2 niveaux en dessous**.
  * *Sanction :* Les Pokémon surclassés ne peuvent plus être utilisés jusqu'au déblocage du prochain plafond.
* **Super Bonbons :**
  * En chemin : utilisables uniquement jusqu'au *dernier plafond atteint (le plus bas, -2)*.
  * Avant les boss : utilisables *juste avant* le boss pour monter au plafond actuel.

## 🎒 5. Objets
* **En combat :** Tu ne peux utiliser des objets en combat *que* si l'adversaire en a utilisé un aussi (œil pour œil).
* **Hors combat :** Les soins etc. sont illimités.
* **Randomizer :** Les objets au sol, certains marchands et les objets tenus par les Pokémon sauvages sont aléatoires.

## 💿 6. Capacités & évolutions
* **CS :** Peuvent être apprises par *n'importe quel* Pokémon.
* **CT :** L'apprentissage doit correspondre à l'original (Rouge Feu). (En cas de doute, cherche sur Google si le comportement du randomizer semble bizarre !).
* **Évolutions par échange :** Sont patchées et fonctionnent désormais par montée de niveau ou objets.

---
### ⚡ Vérification rapide avant chaque combat
1. Mode Sélection activé ?  2. Plafond de niveau respecté ?  3. Tous les partenaires liés dans l'équipe ?
`;

const es = `# 🔗 Chuleta SoulLink Nuzlocke (Rojo Fuego)

## 💀 1. Reglas básicas
* **Muerte permanente:** Si un Pokémon baja a 0 PS, está muerto. (Guardado en la caja para siempre o liberado).
* **Modo Fijo:** En las opciones, ajusta "Estilo de combate: Fijo" (sin cambio gratis tras un K.O.).
* **Apodos obligatorios:** Cada Pokémon necesita un nombre. **Importante:** ¡el *otro* jugador elige el nombre!

## 🤝 2. Mecánica SoulLink
* **Compañeros de alma:** Las capturas de ambos jugadores en la misma ruta están enlazadas de forma permanente.
* **Destino compartido:** Si un compañero muere, el otro también. Ambos salen del equipo.
* **Emparejamiento de equipo:** Un Pokémon *solo* puede estar en el equipo si su compañero enlazado también está en el equipo del otro jugador.

## 🎯 3. Encuentros y captura
* **Una captura por ruta:** Solo se puede capturar el *primer* Pokémon salvaje de cada zona (huye o es derrotado = sin segunda oportunidad).
* **Cláusula de especies compartidas / duplicados:** Cada línea evolutiva solo puede existir **una vez** en toda la partida, entre *ambos* jugadores.
  * *Excepción:* encuentros estáticos.
  * *Reroll:* Si aparece un Pokémon ya capturado o perdido, se sigue buscando (reroll) hasta que aparezca un nuevo encuentro válido.
* **Cláusula Shiny:** Los shinies *siempre* pueden capturarse.

## 📈 4. Límite de nivel y Caramelos Raros
* **Tope de nivel:** El nivel del Pokémon más fuerte del próximo jefe (Gimnasio/Alto Mando/Campeón) es el límite absoluto.
* **Escalonado del equipo:**
  * **Como máximo 1 Pokémon** puede alcanzar este nivel máximo.
  * **Todos los demás** deben quedarse al menos **2 niveles por debajo**.
  * *Penalización:* Los Pokémon sobrenivelados no pueden usarse hasta desbloquear el siguiente tope.
* **Caramelos Raros:**
  * Por el camino: solo pueden usarse hasta el *último tope alcanzado (el más bajo, -2)*.
  * Antes de los jefes: pueden usarse *justo antes* del jefe para subir hasta el tope actual.

## 🎒 5. Objetos
* **En combate:** *Solo* puedes usar objetos en combate si el rival también usó uno (ojo por ojo).
* **Fuera del combate:** La curación, etc., es ilimitada.
* **Randomizer:** Los objetos en el suelo, ciertos comerciantes y los objetos que llevan los Pokémon salvajes son aleatorios.

## 💿 6. Movimientos y evoluciones
* **MO:** Pueden ser aprendidas por *cualquier* Pokémon.
* **MT:** La compatibilidad debe coincidir con el original (Rojo Fuego). (En caso de duda, ¡búscalo en Google si el comportamiento del randomizer parece raro!).
* **Evoluciones por intercambio:** Están parcheadas y ahora funcionan por subida de nivel u objetos.

---
### ⚡ Comprobación rápida antes de cada combate
1. ¿Modo Fijo activado?  2. ¿Tope de nivel respetado?  3. ¿Todos los compañeros enlazados en el equipo?
`;

const it = `# 🔗 Promemoria SoulLink Nuzlocke (Rosso Fuoco)

## 💀 1. Regole di base
* **Permadeath:** Se un Pokémon scende a 0 PS, è morto. (Messo definitivamente nel box o rilasciato).
* **Modalità Fissa:** Nelle opzioni imposta "Stile di lotta: Fisso" (nessun cambio gratuito dopo un K.O.).
* **Soprannomi obbligatori:** Ogni Pokémon ha bisogno di un nome. **Importante:** è l'*altro* giocatore a scegliere il nome!

## 🤝 2. Meccanica SoulLink
* **Partner d'anima:** Le catture di entrambi i giocatori nella stessa zona sono collegate in modo permanente.
* **Destino condiviso:** Se un partner muore, muore anche l'altro. Entrambi lasciano la squadra.
* **Abbinamento di squadra:** Un Pokémon può stare in squadra *solo* se il suo partner collegato è anch'esso nella squadra dell'altro giocatore.

## 🎯 3. Incontri e cattura
* **Una cattura per zona:** Si può catturare solo il *primo* Pokémon selvatico di ogni zona (fuggito o sconfitto = nessuna seconda possibilità).
* **Clausola specie condivise / doppioni:** Ogni linea evolutiva può esistere solo **una volta** nell'intera partita, tra *entrambi* i giocatori.
  * *Eccezione:* incontri statici.
  * *Reroll:* Se compare un Pokémon già catturato o mancato, si continua a cercare (reroll) finché non appare un nuovo incontro valido.
* **Clausola Shiny:** Gli shiny possono *sempre* essere catturati.

## 📈 4. Limite di livello e Caramelle Rare
* **Tetto di livello:** Il livello del Pokémon più forte del prossimo boss (Palestra/Superquattro/Campione) è il limite assoluto.
* **Scaglionamento della squadra:**
  * **Al massimo 1 Pokémon** può raggiungere questo livello massimo.
  * **Tutti gli altri** devono restare almeno **2 livelli sotto**.
  * *Penalità:* I Pokémon sovralivellati non possono più essere usati finché non si sblocca il tetto successivo.
* **Caramelle Rare:**
  * Lungo il cammino: utilizzabili solo fino all'*ultimo tetto raggiunto (quello più basso, -2)*.
  * Prima dei boss: utilizzabili *subito prima* del boss per salire fino al tetto attuale.

## 🎒 5. Strumenti
* **In lotta:** Puoi usare strumenti in lotta *solo* se anche l'avversario ne ha usato uno (occhio per occhio).
* **Fuori dalla lotta:** Le cure ecc. sono illimitate.
* **Randomizer:** Gli strumenti a terra, certi mercanti e gli strumenti tenuti dai Pokémon selvatici sono casuali.

## 💿 6. Mosse ed evoluzioni
* **MN:** Possono essere apprese da *qualsiasi* Pokémon.
* **MT:** L'apprendibilità deve corrispondere all'originale (Rosso Fuoco). (Nel dubbio, cerca su Google se il comportamento del randomizer sembra strano!).
* **Evoluzioni per scambio:** Sono state patchate e ora funzionano tramite aumento di livello o strumenti.

---
### ⚡ Controllo rapido prima di ogni lotta
1. Modalità Fissa attiva?  2. Tetto di livello rispettato?  3. Tutti i partner collegati in squadra?
`;

export const DEFAULT_RULES: Record<Lang, string> = { de, en, fr, es, it };
