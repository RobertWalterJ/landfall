# Landfall

A geography game for the phone. Islands, countries, provinces, capitals and
flags, drilled until you own them — starting with the Caribbean and working out
to Canada, China, Africa, the United States and the rest of the world.

Personal project, same footing as Halyard, Wordhoard and Commonplace. Not GPA.

```
Launch Landfall.bat          →  http://localhost:8796
```

## What is in it

| | |
|---|---|
| 1,747 places | 197 countries · 53 territories · 65 named Caribbean islands · 971 sub-national units · 461 cities |
| 51 packs | the Caribbean, all the world's countries, regional country sets, 34 sub-national sets, 7 city sets |
| 44 groups | the Leeward Islands, the Windwards, the Grenadines, the ABCs, the SSS islands, the Maritimes, New England, the Maghreb, Melanesia… |
| 43 maps | pre-projected at build time; no projection or topology library ships |
| 18 question kinds | locate · name the shape · whose flag · pick the flag · capital of · capital of what · who holds it · **shares a country with** · **furthest north** · which group · in the group · odd one out · borders · sub-region · currency · language · demonym · largest |

## Build

```bash
node build/fetch-fonts.mjs                        # once — self-hosts Literata + Archivo
node --max-old-space-size=6144 build/build.mjs    # corpus + every map   (~40s)
python build/make-icons.py                        # icons, drawn from the real Hispaniola
node build/test-engine.mjs                        # 20k questions, every invariant
node build/test-round.mjs                         # eight simulated weeks of play
node build/make-deploy.mjs                        # docs/ for Pages + dist/web
node build/bundle-single.mjs                      # dist/landfall.html, one file
```

`build/report.txt` lists everything the build could not resolve. It is meant to
be read.

## Where the facts come from

| source | licence | what it gives |
|---|---|---|
| Natural Earth 10m admin-0, map subunits, admin-1, populated places | public domain | every shape, and which cities are capitals of what |
| mledoze/world-countries | ODbL | capitals, borders, currencies, languages, demonyms, area, region |
| flag-icons | MIT | country and territory flags |
| Wikidata + Wikimedia Commons | CC0 / free | island capitals, the flags individual islands fly, alternative names |
| curated, in `build/curated/` | — | island names, regional groupings, English display names, capital corrections |

### The discipline

The build **reports rather than guesses**, and three things follow from that.

**Island names claim real geometry.** Natural Earth draws Bequia and Saba but
does not name them — `ne_10m_minor_islands` carries no name field at all, and an
island inside a country is just another polygon in that country's MultiPolygon.
So `build/curated/islands.mjs` gives each island a name and a coordinate, and the
build claims the polygon that contains it. A point that lands on no coastline, or
on a polygon another island already claimed, is **printed and dropped**. Nothing
here invents a shoreline.

**Provincial capitals are checked, not trusted.** Natural Earth tags more than
one city per province as an "Admin-1 capital": Xining is filed under Gansu,
Fushun under Liaoning, Tomakomai under Hokkaido. Taking the first match put three
wrong capitals in the corpus. The rule is now: a national capital wins outright,
otherwise the largest of the tagged cities — which recovers Lanzhou, Shenyang,
Kunming and Sapporo. All 51 US, 13 Canadian, 31 Chinese and 47 Japanese capitals
were then checked by hand.

**Island detail is joined on geography, not on names.** The 65 curated islands
arrived with a name and a coordinate and nothing else, so
`build/harvest-islands.mjs` asks Wikidata for every island in the Caribbean box
and matches by distance *and* name — within 30 km of the coordinate that already
claimed a real coastline, or it is dropped. Two further guards earn their keep:
a capital must lie within 60 km of its own island (Wikidata gives Bequia's
capital as Port Elizabeth and resolves it to **Gqeberha, South Africa**), and a
flag must carry the island's own name (Saint Thomas's P41 points at the flag of
the whole US Virgin Islands). Both were caught, reported and dropped.

That layer is what makes the twin-island countries askable: Nevis, Barbuda,
Saba, Sint Eustatius, Bonaire, Bequia, Vieques and Culebra all fly their own
flag, and 23 islands now have a chief town. Tobago and Carriacou are absent on
purpose — both fly a flag, neither has one on Commons under a title that can be
verified automatically, and guessing a file is how you teach the wrong flag.

**Some islands simply are not drawn.** Petite Martinique, Petit Saint Vincent,
Palm Island, the Tobago Cays, Ronde Island, Isle à Quatre and Young Island are
real Grenadines and appear in none of Natural Earth's layers at 10m — not in
their country's own geometry and not in the minor-islands layer. Their
coordinates are recorded as a comment in `build/curated/islands.mjs` so they can
move up the moment a finer coastline source is added, and the build stays quiet
about them instead of reporting the same seven failures every run. Mayreau is
the one that *is* there, and it is claimed from the minor-islands layer.

**Contested groupings are never the answer.** Dominica is Leeward in the old
British administrative sense and Windward in modern geographic usage. Barbados is
grouped with the Windwards politically but sits 150 km east of the arc. Finland
is Nordic but not Scandinavian. Those memberships are recorded as `contested` and
are excluded from grouping questions in **both** directions; they appear in the
Atlas with the argument attached, which is the part worth knowing.

## How the questions work

Two decisions carry most of the quality.

**Distractors are scored for nearness.** A wrong answer picked at random teaches
nothing: if the options against Saba are Mongolia, Peru and Chad, the question is
"which of these is in the Caribbean", which you already knew. Wrong answers are
ranked by shared island group, shared parent, shared sub-region, physical
distance — and heavily weighted towards places *you have actually confused with
this one before*. Cruel mode takes the three nearest, full stop.

**Nothing may hand you its own answer.** Eponymous capitals (Djibouti,
Luxembourg, Monaco), languages named after their country (Somali, Thai, Kazakh)
and neighbours sharing a name (Guinea-Bissau / Guinea) all produce questions that
look real and test nothing. That is enforced centrally in `buildQuestion`, so it
cannot be forgotten when a question kind is added.

## How the learning works

Progress is kept per **(place, facet)** pair, not per place. Knowing where Saba
is and knowing who governs it are different pieces of knowledge with different
decay rates; a single per-place score would call you master of the Caribbean on
the strength of recognising Cuba.

Scheduling is Leitner with a **frontier**: new places only arrive while the
number of places still unsettled is below a threshold. Spaced repetition on its
own will happily introduce two hundred islands in one sitting and bury you a week
later.

Two numbers in that design came from simulation rather than taste
(`build/test-round.mjs` plays a learner through eight simulated weeks):

- The frontier originally counted **cards**. A place has four or five facets, so
  a frontier of fourteen cards meant barely three new places in flight, and eight
  weeks of daily play met only 37 of the 88 Caribbean places. Counting **places**
  instead, and interleaving breadth with depth, took that to 60 of 88 and mastery
  from 29% to 54% over the same eight weeks.
- A place is introduced by **where it is** and nothing else. Its capital, flag and
  group only become askable once you can reliably find it. Asking for Basseterre
  before you know where Saint Kitts is is asking you to memorise a word pair.

## Picking a place on a map

Every candidate used to own an invisible hit circle, and SVG hands a tap to
whichever element is on top — so a small island's circle sitting over Jamaica's
landmass stole taps meant for Jamaica. Overlapping targets are the wrong model
and no amount of shrinking them fixes it.

One capture layer now covers the map and the candidate is worked out from the
point, in this order: **inside a coastline wins outright**; otherwise the
**nearest candidate within a thumb's reach**; otherwise **nothing at all**, so a
stray tap in open sea cannot cost a wrong answer.

And it resolves on pointer-UP. Press, see which island lights up, slide to
correct it, release to commit — which is what makes a one-millimetre island
selectable with a finger. Verified: the west tip of Jamaica, the point nearest
the Caymans, selects Jamaica.

## Reading the map

The figure/ground was wrong at first and it mattered more than anything else on
the screen: the well was near-white, the land was a pale cyan, and the islands
sank into the sea. On a chart **the water carries the colour and the land is the
paper**, so that is now the arrangement — mid-tone water, warm sand land, and a
hairline coastline, which is what makes a four-pixel island crisp rather than a
smudge.

**The candidates are found by dimming the field, not by brightening the
figure.** When eight or fewer features are in play, everything else drops to 45%
and the context coastlines to 25%; the four candidates keep their paper fill, a
2px outline and a small halo. Nothing has to change colour, so all four are
still drawn identically to each other — which is the rule that keeps a locate
question honest. In Label the Map the whole region is in play, so nothing is
dimmed.

The hierarchy, and no colour means two things: **sand** is land at rest,
**paper + outline** is in play, **ink** is named, **brass** is given, and
verdigris and vermilion are only ever right and wrong.

## What the numbers claim

Three measures, because one was not enough and the strict one alone was
actively misleading:

| | means | earned by |
|---|---|---|
| **met** | seen at least once | one answer |
| **down pat** | three right in a row on every facet it has asked you | an afternoon |
| **known** | still there after three weeks · **secure** after three months | time, and nothing else |

The summary used to lead with *"You can name 0 of 93"* after a round played
perfectly. That number was true — naming a place for good means holding it for
three weeks, so it is structurally zero for the first three weeks — but as a
headline it read as "you got nothing right". **Down pat** is the answer: it
moves the day you play, it cannot be confused with the stronger claim, and the
headline now promotes itself from *met* to *down pat* to *can name* as each
becomes available.

`known` keeps the strict rule (every facet the place supports, unopened ones
counting against it). `down pat` is measured only over the facets that have
actually come up, because measuring it the strict way made it structurally zero
as well — which was the original complaint.

## Design constraints

- **No timers or countdowns by default.** A clock measures reading speed, not
  knowledge. Opt-in only.
- **Read-aloud is an accessibility feature.** A speaker button sits beside the
  question, every option, every fact in the Atlas and the answer in the verdict.
  It defaults to **manual**: the buttons are always there and nothing speaks
  until asked. Speech is primed on the first real gesture, because mobile
  browsers silently refuse `speechSynthesis` until then.
- **Sound is off by default**, and is only ever feedback — never information.
- Auto-advance is generous, scaled to how much there is to read, and always
  interruptible by a tap.

## Label the Map

The mode the rest of the app points at. Removing the four options converts the
engine from recognition to **production** — you get good at the format you
practise (Slamecka & Graf's generation effect, 1978) — and free recall over a
whole region is the thing worth being able to do.

- **Fill** names a place and you find it; **Name** lights one up and you name
  it, typed or spoken. Spelling is never marked: accents, Saint/St/Sint, a
  trailing "Island", every alternative name in the corpus and ordinary typos are
  all correct, and a near miss is counted with the spelling shown underneath.
- **The best match in the set wins, and a tie is a refusal.** Generosity without
  that rule accepts "South Caicos" for North Caicos and "Cuba" for Aruba — both
  were happening, both are in `build/test-sweep.mjs` now.
- **A set only opens once you have met 70% of it.** A sweep of sixty unmet
  islands is sixty blank stares. Label the Map never introduces new places.
- First sweep of a set runs north to south; every later one is shuffled, because
  a list learned only in order makes the list the retrieval cue.
- A miss inks in anyway and goes to the back of the queue; missed twice, it is
  given. The goal state is a finished chart, not a punished one.
- **A clean sweep is every feature first time.** A region is **held** after three
  clean sweeps at expanding gaps — any first, a second a week later, a third a
  month after that. Five weeks minimum, unfakeable in an afternoon, and
  revocable: a later sweep that is not clean drops it and names what failed.

See `DESIGN.md` for the visual and interaction specification and `GAMEPLAY.md`
for the progression model.

## Notes to self

- **CacheStorage is per origin.** All of these apps share
  `robertwalterj.github.io`, so `sw.js` must never call global `caches.match()`
  and must never delete a cache just because it is not its own — the naive
  activate handler would wipe Halyard's offline cache.
- `make-deploy.mjs` **fails the build on any absolute path**. A project site
  lives at `/landfall/`, and one `href="/styles.css"` works on localhost and
  breaks the moment it is deployed.
- Local server is on **8796** (Halyard 8790, Wordhoard 8793, Commonplace 8794).
- The United States map has no Alaska/Hawaii inset. The states are drawn where
  they are; locate questions zoom to the candidates, so nothing is too small to
  tap and the honest map is the one worth learning.
