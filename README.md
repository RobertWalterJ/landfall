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
| 1,742 places | 197 countries · 53 territories · 60 named Caribbean islands · 971 sub-national units · 461 cities |
| 51 packs | the Caribbean, all the world's countries, regional country sets, 34 sub-national sets, 7 city sets |
| 44 groups | the Leeward Islands, the Windwards, the Grenadines, the ABCs, the SSS islands, the Maritimes, New England, the Maghreb, Melanesia… |
| 43 maps | pre-projected at build time; no projection or topology library ships |
| 16 question kinds | locate · name the shape · whose flag · pick the flag · capital of · capital of what · who holds it · which group · in the group · odd one out · borders · sub-region · currency · language · demonym · largest |

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
| flag-icons | MIT | the flags |
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

## Design constraints

- **No timers or countdowns by default.** A clock measures reading speed, not
  knowledge. Opt-in only.
- **Read-aloud is an accessibility feature.** Built into the prompt and the
  options, not bolted on. Speech is primed on the first real gesture, because
  mobile browsers silently refuse `speechSynthesis` until then.
- Auto-advance is generous, scaled to how much there is to read, and always
  interruptible by a tap.

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
