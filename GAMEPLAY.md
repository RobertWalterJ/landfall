# Landfall — gameplay and progression

What the game asks, in what order, and what it is honest enough to claim you know.

This document owns mechanics, scheduling and progression. It does not own colour, type or
layout — that is `DESIGN.md`. Where the two touch (the mastery map, the filled-in region) this
file specifies *what it must say*; that file specifies *how it looks*.

The goal, stated plainly so every decision below can be checked against it: **to be able to name
every island in the Leeward Islands, unprompted, in a year's time, and then to do the same for
Canada, China, Africa, the US states and the world.** Not to recognise them among four options.
Not to have a high score. To name them.

Two standing constraints, from the user, that override anything convenient:

- **No timers, no countdowns, no speed bonuses, ever.** A clock measures reading speed, not
  knowledge. Nothing in this document may be implemented with a time limit. Anything that
  auto-advances waits at least 4 seconds after feedback and never advances while a finger is on
  the screen. Auto-advance is off by default.
- **Spelling is never graded.** Where free text is accepted, a near-miss is marked correct and
  the correct spelling is shown. This is a rule, not a tolerance setting.

---

## 0. What is actually in the corpus

The numbers below drive every threshold in this document, so they are stated up front.

| | |
|---|---|
| Items | 1,742 — 197 countries, 53 territories, 60 named islands, 971 sub-national units, 461 cities |
| Packs | 51 |
| Curated groups | 44, with **20 contested memberships** |
| Maps | 43, pre-projected |
| **(item, facet) cards** | **≈ 5,059** |

Cards per pack, which is the number that matters for pacing:

| Pack | Items | Cards | Facets available |
|---|---|---|---|
| The Caribbean | 88 | **299** | place 88, parent 75, group 52, flag 28, capital 28, facts 28 |
| Countries of the world | 197 | 917 | place/flag/capital/facts 197 each, group 129 |
| African countries | 54 | 247 | place/flag/capital/facts 54 each, group 31 |
| US states | 51 | 174 | place 51, capital 51, parent 51, group 21 |
| Chinese provinces | 33 | 102 | place 33, capital 32, parent 33 |
| Canada | 13 | 49 | place 13, capital 13, parent 13, group 10 |
| Caribbean towns | 103 | **206** | parent 103, facts 103 — **no place facet at all** |

Three things fall out of this table that the design has to answer to.

**The Caribbean is a place-and-relationship pack, not a flag-and-capital pack.** Only 28 of its 88
items carry a flag or a capital, because 60 of them are islands inside other jurisdictions. The
pack's real content is *where it is* (88), *who holds it* (75) and *which group it is in* (52).
That is 215 of its 299 cards. Any progression that leans on flags and capitals is leaning on a
third of this pack.

**Cities cannot currently be located.** All 461 city items have an empty `m`, so `locate` and
`shape` can never fire for them (`engine.js` `mapFor` returns null). "Great cities of the world"
is at present a quiz about which country a city is in, not where it is. This is a data bug in
`build/build.mjs`, not a design choice — see the appendix. Until it is fixed, city packs are
two-facet packs and should be described as such rather than sold as geography.

**Difficulty tier is a size proxy and is wrong inside the Caribbean.** `build.mjs` line 162 gives
every curated island a flat `t: 2`, while country tier comes from population and area
(`build.mjs` line 83). The result, in the pack the user cares most about:

- Cuba, Jamaica, Haiti, the Dominican Republic, the Bahamas, Barbados, Trinidad → tier 1
- **All 60 islands — Saba, Bequia, Anegada, Acklins, Rum Cay — → tier 2**
- **Antigua and Barbuda, Dominica, Grenada, St Lucia, St Vincent, St Kitts and Nevis, Aruba,
  Curaçao, Martinique, Guadeloupe, the Caymans, the Turks and Caicos → tier 4**

`schedule.js` sorts new material by `(a.tier - b.tier) || random`. So the app as written will
introduce the seven big countries, then sixty tiny islands in *random order*, and will reach
Dominica and Grenada last. That is precisely backwards, and it is the single most damaging
defect in the current build. Section 3 replaces the sort.

---

## 1. The mastery model

### 1.1 What is wrong with the model in `schedule.js`

The per-(item, facet) card model is right and is the best decision in the file. Keep it. Five
things around it are wrong.

**The word "mastered" is attached to eight days.** `MASTERED = 4` means box 4, an eight-day
interval — a card that has been answered correctly four times and survived one eight-day gap.
Cepeda et al.'s meta-analysis of 254 spacing studies (2006), and the follow-up experiment
(Cepeda et al., *Psychological Science*, 2008), found that the gap which optimises retention
scales with the retention interval at roughly 10–20%: to still know something in a year, the gap
you need to have survived is about three weeks. Eight days is not mastery of anything. It is the
midpoint of learning. Calling it mastery makes every number in the app a small lie, and this app's
whole value proposition is that its numbers are true.

**There is no per-card difficulty.** Every card walks the same ladder whether it is Cuba or
Saba. Both SM-2 (Woźniak, 1987) and FSRS (Ye et al., 2022–present) carry a per-card parameter —
SM-2's ease factor, FSRS's Difficulty — because between-item difficulty variance is the largest
single predictable source of scheduling error. FSRS's published benchmarks over Anki's
20,000-collection dataset show roughly 20–30% fewer reviews for the same retention against SM-2,
and most of that gain is per-card adaptation. A fixed ladder is the one thing Leitner is known
for getting wrong.

**The terminal interval of 60 days makes the corpus unmaintainable.** At steady state, a fully
learned corpus generates cards/day = total cards ÷ terminal interval. 5,059 ÷ 60 = **84 reviews
a day, forever**, just to stand still. That is six rounds a day of pure maintenance with no new
material. The Caribbean alone is 299 ÷ 60 = 5/day, which is fine; the world is not. The ceiling
has to move.

**A miss drops two boxes, which is too gentle at the top and arbitrary everywhere.** From box 6
(60 days) a lapse lands at box 4 (8 days). A card you have just failed after two months is not an
eight-day card. The comment in the file is right that resetting to zero is too harsh — Anki's
default 0% new-interval is widely regarded as over-punishing, and FSRS models post-lapse stability
as a substantial fraction of prior stability rather than zero — but "minus two boxes" is a rule
with no model behind it. It should be a multiplier.

**`itemMastery` averages, and averages over an inconsistent denominator.** Two problems in four
lines. First, the mean hides the worst facet: an item at flag box 6 and place box 0 reads 50%,
when the honest statement is "you know its flag and you have no idea where it is." Second, the
default argument is the full `FACETS` list, so Cuba is scored out of six facets and Saba out of
three — meaning the island-heavy packs score higher for less knowledge. The mean is also why
`packMastery` can drift upward while the hard items stay untouched.

**A sixth, smaller point:** answers taken in the "practice" branch (`next()` step 4) write to the
same card state and advance the box. Reviewing a card ahead of its due date and letting that count
is a known SM-2 failure — Anki explicitly does not reschedule filtered-deck reviews for this
reason. Practising a card the day after you learned it and having it jump to a 21-day interval is
how a schedule silently decays.

### 1.2 The replacement

**Keep** the (item, facet) card and the frontier concept. **Replace** the fixed ladder with an
SM-2-lite that carries a per-card ease, and define the vocabulary honestly.

**Card state.** `{ interval (days), ease, reps, lapses, due, last, state }` where `state ∈ {new,
learning, review, relearning}`. Drop the box integer; it is the thing that forces a fixed ladder.
Where the UI wants a box-like number for display, derive it from the interval.

**Learning steps (before graduation).** Two in-session repeats, then graduate:

| Step | When it comes back |
|---|---|
| First sight | — |
| 1 | +3 questions later in the same round |
| 2 | +9 questions later, or the next session if the round ends first |
| Graduate | 1 day |

Three successful retrievals with increasing gaps, at least one of them across a sleep, before a
card is called learned. Karpicke & Roediger (*Science*, 2008) showed that dropping an item from
practice after one successful recall devastates retention a week later; repeated retrieval is what
does the work, not repeated study. The current ladder's 2-minute and 20-minute steps are the right
instinct, but a 12-question round lasts three minutes, so the 20-minute step never fires inside a
round — the card just disappears until tomorrow. Counting in *questions* rather than minutes fixes
this and removes another clock from the app.

**Review intervals.** `interval := interval × ease`, capped at 270 days. Ease starts at **2.2**
and is clamped to **[1.35, 3.0]**.

Ease moves on the *difficulty of the question that was answered*, not on a self-rating and not on
response latency. This is the central adaptation of SM-2 for this app: SuperMemo and Anki need the
user to grade themselves because they cannot see the question; Landfall builds the question, so it
knows exactly how hard it was. And self-grading is unreliable anyway — Kornell & Bjork (2008) found
learners' metacognitive judgements about their own study to be systematically inverted. Latency is
out of the question for a dyslexic user.

| Event | Ease |
|---|---|
| Correct, standard 4-option question | no change |
| Correct with cruel distractors, or 6 options | +0.15 |
| Correct in Label the Map, Fill mode (no options at all) | +0.15 |
| Correct in Label the Map, Name mode (free recall) | +0.25 |
| Miss | −0.25 |

**Lapse.** A miss sends the card to `relearning`: back at +3 questions in this round, and again at
+9. On the next correct answer, `interval := max(1, 0.35 × interval_before_lapse)`, ease −0.25. So
a 60-day card that fails comes back at 21 days, not 8; a 5-day card that fails comes back at 1 day.
The multiplier is a model, not a step count, and it degrades gracefully across the whole range.

**The resulting ladder**, for an average card at ease 2.2, against the current fixed one:

| Successful retrieval | Landfall (proposed) | Current `INTERVALS` |
|---|---|---|
| 1 | 1 day | 2 min |
| 2 | 2 days | 20 min |
| 3 | 5 days | 1 day |
| 4 | 10 days | 3 days |
| 5 | **23 days** | 8 days |
| 6 | 50 days | 21 days |
| 7 | 111 days | 60 days (terminal) |
| 8 | 244 days | — |
| 9 | 270 days (cap) | — |

Steady-state maintenance load at the cap: 5,059 ÷ 270 = **19 cards a day** for the entire corpus.
That is one and a half rounds. This is the number that decides whether the whole-world ambition is
possible at all, and it is why the ceiling has to be nine months rather than two.

A hard card at ease 1.35 walks 1 → 1 → 2 → 3 → 4 → 5 → 7 → 9 days and keeps coming back, which is
the correct behaviour and is what a fixed ladder cannot do.

**Leeches.** Four lapses on a card that has ever reached a 10-day interval means the card is
broken, not hard. Do not grind it. Suspend the *question kind* that keeps failing and force a
different one for that facet (see §8.3), and if there is a confusion pair attached, offer the drill
(§5). If it lapses four more times, park it: mark it `stuck`, stop scheduling it, and list it on
the pack ledger under "these five are not sticking." Naming the problem is more useful than
grinding it. Anki's leech threshold of 8 is the comparable figure; 4-then-4 splits it into a
diagnosis and a surrender.

### 1.3 The vocabulary, and what a number is allowed to claim

Four words, defined on the interval, in ascending order. These are the only words the app uses.

| Word | Definition | Why this line |
|---|---|---|
| **unseen** | no card exists | — |
| **met** | seen at least once, interval < 21 days | it is in the machine, that is all |
| **known** | interval ≥ 21 days and the last answer was correct | Cepeda: ~3 weeks is the gap that supports a year's retention |
| **secure** | interval ≥ 90 days, no lapse in the last two reviews | survived a season |

**An item is known when every facet it supports is known.** The minimum, not the mean. The badge
shows the minimum; the breakdown underneath shows each facet, so "Saba: known where it is, known
who holds it, met the group" is legible at a glance and no average papers over the gap. Score
against `facetsFor(item)` — the facets that item actually supports — never the full six.

**A pack reports three counts, always together, over both cards and items,** and one sentence:

> **The Caribbean** — 299 cards: 180 met, 96 known, 30 secure.
> 88 islands: **21 known on every facet.**
> *You can name 21 of 88.*

That last line is the headline. It is a count, it can go down, and it is the sentence he actually
wants to be able to say.

**Mastery must decay on screen, not only in the scheduler.** A card whose due date has passed by
more than half its own interval is displayed as **lapsing**, before it has been re-tested. If he
stops for three months, the mastery map fades and the counts fall, because that is what has
actually happened to his memory. Almost no spaced-repetition app does this, and it is the single
most honest thing in this design. It is also a better motivator than any streak: a map that is
going grey in the eastern Caribbean is a specific, true, actionable statement.

**Forbidden displays.** A single percentage that averages boxes. Lifetime accuracy across all
questions ever — it is dominated by easy mature reviews, converges on about 90%, and then never
moves again, so it carries no information. Any number that can only go up.

---

## 2. Session design

### 2.1 The round

**Fixed at 14 questions.** Not adaptive.

The argument for adaptive length — run until the due queue is empty — produces sessions of three
questions on one day and ninety on another, which is hostile to a professional fitting this into
gaps, and worse for a dyslexic user for whom an unbounded reading task has no shape. A fixed round
is a promise the app keeps: fourteen questions, roughly three minutes, and you can stop. The
*content* of the round is fully adaptive; its length is not. Frequent short sessions are also what
the spacing effect wants (Cepeda et al., 2006): three rounds across a day beat one round of 42.

After 14, offer three things and nothing else: **another 14**, **Label the Map**, **done**. If a
large queue has built up, say so in plain numbers rather than extending: *"48 cards due. About
four rounds."* Never auto-extend. Never a daily goal ring.

The one adaptive exception, downward: if fewer than 6 cards are due and the frontier is closed,
the round is short and the app says why — *"Only four due. Nothing new until these settle. Sweep a
map instead?"* Padding a thin round with practice churn is how a schedule gets corrupted (§1.1)
and how an app starts feeling like busywork.

### 2.2 The mix inside a round

Target composition of 14, adjusted by what is actually available:

| Slot | Count | Source |
|---|---|---|
| Warm-up | 1 | a due card at interval ≥ 10 days, barely overdue |
| Reviews | 7 | due cards, most overdue first |
| New | 2 | first-exposure blocks (§4.3); up to **4** while a pack is opening |
| Relearning | 2 | cards missed earlier this round or in the last session |
| Sharpening | 2 | confusion-pair members, and `stuck` cards on a different kind |

**Placement rules**, which matter more than the counts:

- New items never appear in the first 3 questions (not warmed up) or the last 2 (nothing left to
  space them against). So new material sits at positions 4–9 and its in-round repeat at +3 always
  lands inside the round.
- The warm-up is a real due review, not a ritual — it costs nothing and opening on a failure is a
  reliable way to end a session early.
- Never the same item twice in a row, never the same facet twice in a row, never the same question
  kind three times in a row (§4).

**Target accuracy is 80–90%.** Wilson et al. (*Nature Communications*, 2019) derive an optimal
training error rate of about 15.87% for a broad class of learners, which is the quantitative form
of Bjork's desirable difficulties (Bjork & Bjork, 1992; 2011): retrieval that is effortful but
successful builds more storage strength than retrieval that is easy. If a pack runs above 92% over
30 due answers, the material is too easy and difficulty escalates (§8). Below 70%, the frontier
closes and new material stops.

**Feedback is immediate, always, and always shows the correct answer** — including when the answer
was right. This is not politeness. Roediger & Marsh (2005) showed multiple-choice testing can
*increase* later intrusions of the plausible lures; Butler & Roediger (2008) showed that corrective
feedback eliminates that effect. Landfall deliberately builds the nearest look-alikes as
distractors, so without feedback it would be an efficient machine for installing wrong answers.
Cruel mode without feedback would be actively harmful.

### 2.3 Opening and closing

**Opening** is one screen with one line of state and one button: what is due, and *Start*. Not a
dashboard. If nothing is due, the line says so — *"Nothing due. The Caribbean is holding."* — and
the button becomes *Sweep a map*.

**Closing** is a report, not a celebration. Four things, in this order:

1. **What moved.** *"Marie-Galante and La Désirade are now known. Three cards reached a month."*
2. **What slipped.** *"Sint Eustatius lapsed — back tomorrow."* Never omit this.
3. **What the app noticed.** At most one line: a new confusion pair, or a difficulty escalation
   (§8.4), or a drill offer.
4. **What is next.** *"Six due tomorrow."*

No score. No stars. No "great job". A round summary that reads like a survey note is exactly right
for this user.

### 2.4 What a good session is

A good session is one where **everything due was cleared or 14 questions were answered, accuracy
landed between 75% and 92%, and at least one card crossed into a longer interval.** That definition
is worth stating in the app once, on the first run, because it inoculates against the assumption
that 14/14 is the target. 14/14 means the questions were too easy and nothing was learned. The
close screen can say so, once, gently, the first time it happens: *"Fourteen out of fourteen —
these are too easy now. Turning the distractors up."*

---

## 3. The introduction ladder

1,742 items cannot be met at random, and the current `fresh.sort((a,b) => a.tier - b.tier)` does
meet them at random inside a tier. Replace it with a scaffold.

### 3.1 The principle

Spatial memory is hierarchical. Stevens & Coupe (1978) demonstrated that people infer the relative
position of places from the superordinate regions containing them (and make systematic errors when
the regions mislead — the famous San Diego / Reno case); Hirtle & Jonides (1985) and McNamara
(1986) showed cognitive maps are stored as clustered, nested structures rather than flat coordinate
sets. People *already* encode geography as frames with detail hung inside them. So teach the frame
first and hang the detail on it, because that is the representation being built either way.

Operationally: **nothing is introduced until the thing that contains it is known, and until at
least part of its group frame is up.**

```
readyToIntroduce(item) =
     (no parent)  OR  (parent's `place` card is at interval ≥ 5 days)
  AND (no curated group)  OR  (≥ 2 members of that group are `met`)
  AND (the item's own `place` card is met, for any facet other than place)
```

That is a data-driven rule that needs no new curation and it generates the right order by itself.
`tier` becomes a tiebreaker within a rung, not the sort key.

### 3.2 The Caribbean, concretely

What the rule produces, which is also the order a geography teacher would use:

**Rung 1 — the frame (7 items).** Cuba, Hispaniola as Haiti and the Dominican Republic, Jamaica,
Puerto Rico, the Bahamas, Trinidad and Tobago. The Greater Antilles plus the two ends of the
frame. Everything else in the pack is positioned relative to these.

**Rung 2 — the arc's jurisdictions, north to south (13).** Cayman Islands, Turks and Caicos,
Antigua and Barbuda, St Kitts and Nevis, Guadeloupe, Dominica, Martinique, St Lucia, St Vincent
and the Grenadines, Barbados, Grenada, Aruba, Curaçao. These are currently **tier 4** and would
otherwise be introduced *last*.

**Rung 3 — the small jurisdictions (8).** Anguilla, British Virgin Islands, US Virgin Islands,
Saint Martin, Sint Maarten, Saint Barthélemy, Montserrat, Caribbean Netherlands. The northern
Leewards cluster, which is where the whole pack gets hard and where the drills will live.

**Rung 4 — the named islands, by parent (60).** Only once their parent is known, and introduced
**group by group, not country by country** where a curated group exists — because the group is the
thing being learned. Order within rung 4: the Virgin Islands (9), the Grenadines (5), the Leewards'
constituent islands (Saba, Sint Eustatius, St Kitts, Nevis, Basse-Terre, Grande-Terre,
Marie-Galante, La Désirade), the SSS and ABC islands, then the Bahamian chain (14, north to
south — Grand Bahama, Abaco, New Providence, Andros, Eleuthera, Cat, Exuma, Long Island, San
Salvador, Crooked, Acklins, Mayaguana, Great Inagua, Rum Cay), then the Turks and Caicos, then the
unaffiliated singles (Cozumel, Roatán, San Andrés, Providencia, Isla de la Juventud, Mona, La
Gonâve, La Tortue, Saona, Margarita).

Note what this does: it reaches Saba at roughly item 45 rather than item 8, and it reaches Saba
*immediately after* Sint Eustatius and Sint Maarten, which is what makes the SSS group a group
rather than three unrelated dots.

**Implementation note:** the cleanest way to encode rung 4's within-group order is a north-to-south
sort on latitude within each group, which the data already supports (`ll`). The Bahamian chain, the
Grenadines and the Lesser Antilles arc are all monotonic in latitude, so this is free.

### 3.3 The facet ladder

Facets are gated per item, not globally. A facet unlocks when the previous one reaches **interval
≥ 5 days** for that item.

| Order | Facet | Why here |
|---|---|---|
| 1 | **place** — where it is | The spatial anchor everything else hangs on, and the lowest reading load on the page, which matters for a dyslexic user |
| 2 | **parent** — who holds it | Relational; reinforces the map rather than competing with it, and for the 60 islands it is the second-most-populated facet |
| 3 | **group** — the group it is in | Also relational, and the group frame is what turns dots into an archipelago |
| 4 | **flag** | A pure paired associate with no logical support; it wants the location to be secure first, or you are learning two unconnected things at once |
| 5 | **capital** | A second paired associate |
| 6 | **facts** | Borders, sub-region, currency, language, demonym, population |

Yes: **where it is, before its capital.** Flatly. The location is the retrieval cue for everything
else, and a capital learned before a location is a free-floating word pair.

**The `facts` facet should be off by default for the Caribbean, Canada, China, the US and every
sub-national pack, and on by default only for country packs.** Currency, language and demonym are
the weakest content in the engine relative to the stated goal, and in a 14-question round three
currency questions crowd out three islands. Make it an opt-in layer called *the detail*, available
per pack, and say what it contains. `border` is the exception — it is genuinely spatial and belongs
with place; consider moving it into the `place` facet for countries.

### 3.4 When a pack expands

A pack stops taking new material when **either** brake engages:

- **10 items in `learning`** in that pack (an item is in learning until every facet it has opened
  has reached a 21-day interval and it has had ≥ 3 successful retrievals). Ten items, not the
  current 14 *cards* — a new island brings two or three cards with it, so counting cards conflates
  "ten new places" with "three new places". This is the fix to `FRONTIER`.
- **Projected load over the next 7 days > 25 cards/day.** This is the brake that matters later,
  when the reviews of everything already learned start to dominate.

Both must be clear to introduce anything new. Either alone is insufficient: the item cap paces the
opening of a pack, the load brake paces its middle.

**What this means in real time, and the app should say so.** The Caribbean is 299 cards, each
needing about five successful retrievals to reach `known`, plus lapses: roughly 1,900 answers.
At one 14-question round a day, **about four months to know the Caribbean**; at two rounds a day,
about two. The whole corpus is roughly 30,000 answers — **a two-to-three year project at two rounds
a day.** State this plainly on the pack screen. It is a serious number and it will read as
respect, not discouragement, to someone who wants mastery rather than a diversion.

---

## 4. Interleaving and blocking

### 4.1 The evidence, and why it is unusually on point here

Interleaving beats blocking for discrimination learning, and the mechanism is specifically
discriminative contrast. Kornell & Bjork (2008) had participants learn painters' styles blocked or
interleaved: interleaved won on a transfer test, and 78% of participants believed blocking had
worked better — the metacognition is inverted. Birnbaum, Kornell, Bjork & Bjork (2013) established
the discriminative-contrast hypothesis: interleaving helps because it juxtaposes members of
*different* categories close enough in time to compare them. Rohrer, Dedrick & Stershic (2015)
found 80% versus 38% on a delayed test for interleaved versus blocked maths practice.

Telling Saba from Sint Eustatius, or St Lucia from St Vincent, is a discrimination task with
near-identical exemplars. This is the case interleaving was made for.

The counterweight is Carvalho & Goldstone (2014, 2015): blocking wins when the *within*-category
commonality is what needs discovering, because consecutive same-category items let you find what
they share. And contextual interference (Shea & Morgan, 1979) predicts interleaving will make
in-session performance *feel worse* while improving retention and transfer.

That last point is a design requirement, not a footnote. The app should say it once, in the first
round summary: *"These are deliberately mixed up. It will feel harder than drilling one group at a
time, and it works better. You will get more wrong here and remember more later."* Otherwise he
will experience the correct design as the app being badly organised.

### 4.2 The interleaving rules

Hard constraints on question selection, applied after the scheduler picks candidates:

- **Across packs:** never more than **3 consecutive** questions from the same pack when multiple
  packs are active. Due-first ordering scrambles this naturally; make it a constraint anyway.
- **Across facets:** never the same facet twice in a row. Never the same *item* twice in a round,
  except its scheduled relearning repeat.
- **Across kinds:** never the same question kind **3 times in a row**. Transfer-appropriate
  processing (Morris, Bransford & Franks, 1977): practise only `locate` and you become good at
  recognising shapes on one map at one zoom.
- **Within a group:** when a question's answer is a member of a curated group, at least one
  distractor must be another member of that same group. The engine's `nearness` scoring already
  gives same-group +8 and gets this right most of the time; make it a guarantee, not a tendency.
  This is the discriminative contrast, delivered inside every question.
- **Relearning repeats change the route.** A card missed at +3 comes back as a *different kind of
  the same facet* where one exists — `locate` becomes `shape`, `flag-name` becomes `name-flag`,
  `capital-of` becomes `capital-is`. Re-asking the identical question three items later tests the
  echo, not the memory.

### 4.3 Where blocking is right: first exposure only

A new item is introduced as a **three-beat block**, not as a cold question:

1. **Meet it.** Not scored. The map at the group's extent, the new island filled and labelled,
   its group-mates labelled around it, one line of context from the curated `note` or `blurb`
   where one exists (*"Saba is a single volcanic cone, 13 km², Dutch — the smallest special
   municipality of the Netherlands"*). One tap to continue. This is the category-commonality
   moment Carvalho & Goldstone's work argues for, and the group frame is exactly a category whose
   shared structure has to be seen before its members can be told apart.
2. **Locate it immediately**, with its group-mates as the distractors. Deliberately narrow.
   Getting this one right is not the point; Kornell, Hays & Bjork (2009) showed that an
   unsuccessful retrieval attempt followed by feedback beats being shown the answer, so a miss here
   is a productive event and should be framed as normal.
3. **Locate it again at +4 or later**, with the full pack as the distractor pool.

After beat 3 the item joins the interleaved stream permanently and is never blocked again.

Blocking is also correct in **Label the Map**, where a whole region is swept at once — but that
mode is a test of an existing structure, not acquisition, so the interleaving argument does not
apply to it.

---

## 5. Discrimination drills

This is the highest-value mechanic in the app for the stated goal, and it deserves to be more than
"ask the two questions again."

### 5.1 Fixing the confusion state first

Three defects in `schedule.js` have to be fixed before a drill can work.

**Confusions are directional.** `conf['i:saba>i:sint-eustatius']` and the reverse are separate
keys, so confusing the pair in both directions counts as one each and never reaches the threshold
of 2. **Key the pair symmetrically** (sorted id pair) while still recording direction as a
sub-count, because which way round he errs is diagnostic.

**Clearing a confusion deletes it.** `clearConfusion` removes the key, which removes the `conf * 7`
bonus in `engine.js` `nearness` — so the moment a distinction is fixed, the app stops preferentially
testing it. That is exactly backwards. **Resolved pairs keep a residual weight of 0.5** so the two
remain each other's preferred distractor indefinitely. A distinction you had to drill is a
distinction worth re-testing forever.

**Confusions never decay.** A pair confused twice in March should not still be driving drills in
September. **Halve the weight after any 30-day period with no recurrence**; drop below 0.5 and it
is gone.

**And seed the pairs.** Do not wait for him to fail. The corpus already knows where the traps are:
the **20 contested memberships** in `groups.mjs` are guaranteed confusions and should be pre-loaded
at weight 1 — Dominica (Leeward or Windward), Barbados and Trinidad (Windward or not), Finland
(Nordic but not Scandinavian), Mexico (Central America or not), Slovenia and Romania (Balkans),
British Columbia (Cascadia), Alaska (Pacific Northwest). Add name-similar pairs by string distance
within a pack (St Kitts / St Vincent / St Lucia; Antigua / Anguilla; Saba / Sint Eustatius / Sint
Maarten; Grenada / Grenadines; Dominica / Dominican Republic; North and South Caicos). These are
the pairs any geography teacher would pre-empt, and the data supports generating them
automatically.

### 5.2 The drill

**Offered when** a pair reaches weight 2, **at the end of a round**, opt-in, **at most one per
session**, never forced, never mid-round:

> *Saba and Sint Eustatius keep swapping. Eight questions to sort them out?*

**Eight questions, two items, four movements.**

**Movement 1 — side by side (2 questions).** Both shapes shown together, at the same scale, on the
same screen. *"Which one is Saba?"* Two options only. Then the reverse, for the other item. A
simultaneous forced-choice is the purest form of discriminative contrast, and it is the one thing
the existing four-option engine cannot do.

**Movement 2 — the diagnostic feature (1 screen, not scored).** State what actually distinguishes
them, once, in one or two sentences:

> *Saba is a single volcanic cone, 13 km², no beach, no airport runway worth the name. Sint
> Eustatius is 30 km north-west, flatter, with Oranjestad on its west coast. Both are Dutch; both
> are in the SSS islands with Sint Maarten.*

This is the movement that makes a drill a drill rather than a grind. Butterfield & Metcalfe (2001)
demonstrated the hypercorrection effect — errors made with high confidence are the *most* likely to
be corrected once feedback is given — and category-learning work is consistent that what is needed
is the diagnostic feature, not more exposures. Repeatedly re-testing a confusion without ever
supplying the distinguishing cue is how a coin flip gets installed as a habit. Where the pair is a
contested group membership, this screen carries the curated `note` verbatim, because in those cases
the diagnostic feature *is* the argument.

**Movement 3 — separate them (2 questions).** One at a time, four options, the other member of the
pair always present plus two far distractors. The pair member is the only near miss, so a correct
answer means something.

**Movement 4 — interleaved across kinds (3 questions).** Alternating, mixed kinds, other member
always among the options. For Saba and Sint Eustatius that is `locate`, `parent`, `group-member`;
for a flag pair it is `flag-name`, `name-flag`, and — the one novelty worth keeping — a **detail
crop**, where the diagnostic corner of the flag is shown magnified (Chad and Romania, Indonesia
and Monaco, Australia and New Zealand). That mechanic is fun but useless as a general question
kind; inside a drill, where the crop *is* the diagnostic feature, it earns its place.

### 5.3 Clearing, failing, and what it does to the schedule

**Cleared: six consecutive correct, across at least two question kinds, in both directions.** Not
"six of eight". Movement 1 is a two-option question, where 6 of 8 happens by chance about 14% of
the time and 6 straight happens 1.6% of the time. A discrimination drill that a coin flip can pass
is not a drill. If six straight arrive before question 8, it ends early and says so.

**Failed: two misses inside the drill ends it.** Do not push on to eight. Show the two side by
side with the diagnostic feature again, mark the pair **unresolved**, and **re-offer the drill in
2 days**. Grinding a confusion in a single session produces within-session accuracy that does not
survive it — that is the whole contextual-interference result — and the intervention that works is
the gap, not the repetition.

**Effect on the cards:**

- **Cleared** → both items' relevant cards go to `max(current interval, 5 days)` and ease −0.15
  (this pair is demonstrably hard and should return sooner than average). Clearing a drill proves
  discrimination; it does not prove durability, so it must not jump a card to `known`.
- **Failed** → both cards to `relearning`, due tomorrow, ease −0.25.
- **Either way** → the pair keeps a residual distractor weight forever (§5.1).

**A cleared drill is one of the few things worth recording on the progress screen**, because it is
a specific, true, hard-won statement: *"Saba / Sint Eustatius — sorted out, 12 August."*

---

## 6. Label the Map

This is the mode he is actually here for. It is also nearly free: `map.js` already draws any map,
zooms to a bounding box, and gives every feature a tappable 22-unit target, and all 88 Caribbean
items have real shapes (no marker-only features). What makes this mode different from the
`locate` question is the removal of the four options — which quietly converts the entire engine
from recognition to production.

That distinction is the point. Slamecka & Graf's generation effect (1978) and the
transfer-appropriate processing literature both say you get good at the format you practise. Four-
option multiple choice trains recognition. "Name every island in the Leewards" is free recall. The
rest of the app can be MCQ; **this mode is where mastery is actually demonstrated**, and the
progression in §7 hangs off it.

### 6.1 Two directions

**Fill mode — name to place.** The app names a feature; he taps it on the map. No candidates, no
highlighting: the whole map is live. On the Caribbean map that is an 88-way choice, not a 4-way
one. This is the default and it needs nothing built that does not exist.

**Name mode — place to name.** A feature lights up; he names it. Free recall, typed or spoken.
Harder, and it is the true form of the childhood memory.

Name mode is only usable if input is generous, and for this user that is a hard requirement:

- Normalise case, accents and punctuation. *Curacao* = *Curaçao*. *La Desirade* = *La Désirade*.
- Accept every `alt` name in the corpus (*Abaco* for *Great Abaco*, *Exuma* for *Great Exuma*).
- Treat *St / St. / Saint / Sint* as interchangeable; ignore a trailing *Island*, *Islands*, *Cay*,
  *Isla*, *Île*.
- Levenshtein ≤ 2 for names of 8 characters or fewer, ≤ 3 beyond. *Eleuthra*, *Eleuthera*,
  *Eleutheria* are all correct.
- Offer speech input where the browser supports it. `speech.js` already handles output; input is
  the same API surface.
- **A near miss is marked correct and the spelling is shown quietly underneath.** Never a
  half-mark, never a "close!" state, never a red mark for orthography.

### 6.2 The sweep

**Choosing a set.** Any pack, any curated group, or any parent's children ("the islands of the
Bahamas"). The default suggestion is the set with the most cards at interval ≥ 1 day that has not
been swept recently — i.e. *the thing you could probably do right now*, with the count stated:
*"The Leeward Islands — 16 features. You have met 15."*

**A set is only offered when ≥ 70% of its items have a `place` card that is at least met.** Below
that the entry reads *"The Grenadines — 2 of 5 met. Not yet."* **Label the Map never introduces
new items.** A sweep of 60 unmet islands is sixty blank stares, and blank stares are not
retrieval practice.

**Order of asking.** The first sweep of a set goes in a **geographic sweep** — north to south along
the arc, or the group's own natural order — because that is the structure of the place and it gives
him a route to walk. **Every subsequent sweep is randomised.** If a set is only ever learned in
order, the list becomes the retrieval cue and "where is Nevis" fails on its own. Breaking the serial
order on the second sweep is what turns a recitation into knowledge.

**Partial completion is the whole aesthetic.** Each named feature fills in and takes its label, and
stays there. The map visibly builds. **There is no progress bar, because the map is the progress
bar**, and there is no score on screen during a sweep.

**On a miss:** the correct feature fills in with a distinct treatment and its label, and the
feature **goes to the back of the queue for this sweep**. The sweep does not end until everything
has been named, so a missed island has to be produced again at the end — within-session spaced
retrieval, the same mechanism as the round's relearning step. **Missed a second time in the same
sweep, it is given**: shown, labelled, marked `given`, and not asked again. Three strikes is
grinding.

**The end.** The completed map, held on screen, and three numbers:

> **The Leeward Islands — 16 of 16.**
> 13 named first time · 2 after a miss · 1 given.

No percentage, no stars, no points. Those three counts are the honest report and they are all the
information there is.

### 6.3 Clean sweeps, and what they mean

**A clean sweep is every feature named first time: no misses, no gives.** That is the concept, and
it is the thing worth chasing. It is recorded with its date.

**A region is *held* when it has been cleanly swept three times at expanding gaps: any first clean
sweep, a second at least 7 days later, a third at least 30 days after that.** That is the honest
operationalisation of "I can name every island in the Leewards," it takes at minimum five weeks,
and it cannot be faked by repetition in an afternoon.

**Held is revocable.** A later sweep that is not clean drops the region back to *known* and says
so: *"The Leewards — held since 3 June, dropped 14 September. Sint Eustatius and Marie-Galante."*
Revocability is what makes the word mean anything.

### 6.4 How it feeds the scheduler

Every answer in a sweep writes to that item's `place` card, with the difficulty bonus from §1.2:

| Event in a sweep | Scheduler effect |
|---|---|
| Correct, Fill mode (no options) | normal advance, ease **+0.15** |
| Correct, Name mode (free recall) | normal advance, ease **+0.25** |
| Missed | normal lapse (relearning, interval × 0.35, ease −0.25) |
| Given | lapse, but **no confusion pair recorded** — there was no wrong answer, only a blank |
| Never introduced | untouched; the mode does not create cards |

A wrong *tap* in Fill mode records a confusion pair against whatever he tapped, which is the
richest confusion signal in the app: it is an unprompted, uncued error with no distractor set
shaping it. Those pairs should be weighted **double** when triggering drills.

**Label the Map is what the app offers when nothing is due.** This replaces `next()` step 4 — the
"practice the weakest cards" branch — which currently churns cards ahead of schedule and corrupts
their intervals (§1.1). A sweep is a better use of the same minutes, it is the mode he wants, and
because it applies the difficulty bonus it is worth *more* than the practice it replaces.

---

## 7. Progression and reward

He is fifty-ish, a professional, and will bounce off cartoon gamification on contact. The honest
markers are the ones that are specific, dated, falsifiable, and capable of going down.

### 7.1 Keep these six

**1. The mastery map.** Per pack and for the world: every item shaded by the state of its
**weakest** facet — unseen, met, known, secure — with lapsing items greying back out (§1.3). This
is the primary progress display and probably the best thing in the app. It is a map, he is a
planner, and it is honest because it takes the minimum rather than the mean. Watching eastern
Canada or the Lesser Antilles fill in is a real reward and it costs no invented currency.

**2. Held regions.** The three-clean-sweeps-at-expanding-gaps marker from §6.3, dated, listed,
revocable. This is the top of the progression and the thing the whole app is pointed at.

**3. The ledger.** A plain table per pack: items met / known / secure, cards at each state, cards
due tomorrow, cards lapsed in the last 30 days, and the four-month-type estimate to finish. Dry on
purpose. A professional trusts numbers he can audit and distrusts a number he cannot.

**4. A personal best that is not a score:** the largest set cleanly swept. *"Best clean sweep: the
Lesser Antilles, 20 of 20, 3 August."* One line. It is a genuine achievement statement and it is
made of the same material as everything else.

**5. The day count, defanged.** Keep counting days practised, because frequent short sessions are
what the spacing effect actually needs. But: **never the headline, never a notification, and a
missed day never zeros it.** Replace `day.streak` with **"practised 41 of the last 50 days"** — a
truthful statistic that measures the same behaviour without the loss-aversion hook that makes
streaks a dark pattern. That framing also survives a two-week holiday, which a streak does not.

**6. Cruel mode as an earned state, not a trophy.** §8. It escalates automatically, it is reported
once in a round summary, and it can be turned off. It is not a badge and it is not announced with
fanfare.

### 7.2 Deliberately leaving out

- **Points, XP, coins, levels, combo multipliers.** They measure time spent, not knowledge, and
  they are the exact register he will reject.
- **Badges and trophies for arbitrary thresholds** ("100 questions!"). No informational content.
- **Leaderboards and anything social.** It is a personal app; comparison is noise.
- **Lives, hearts, or any fail state that ends a session.** Punishing a miss is backwards — a miss
  is the most informative event the app ever gets.
- **Daily goal rings, streak freezes, comeback bonuses, any loss framing.** The honest end state is
  "nothing due", and it should feel like finishing, not like falling short.
- **Unlockable packs.** He should be able to open China on day one. The frontier already paces
  material from the inside; locking content is paternalism dressed as progression.
- **Naming rights.** Cut. Letting him name a region is a pleasant idea that adds nothing to mastery
  and adds a mutable string to every display. The regions already have names, and the names are the
  content.
- **Anything timed.** Standing rule.

---

## 8. Difficulty adaptation

### 8.1 The signal

The measured signal is **rolling accuracy on `due` review questions only, over the last 30 graded
answers in that pack**. Exclude new items (first exposure is not a measurement), relearning repeats
(contaminated by the echo) and drill questions (two options). The current `stats.answered /
stats.right` lifetime figure is useless for this: it is global, it is dominated by mature reviews,
and it stops moving.

### 8.2 Cruel distractors escalate per card, not per user

This is the important change. `cruel` is currently a global boolean setting. It should be a derived
property of card maturity:

> **A card's questions are built with `cruel: true` once its interval is ≥ 5 days and its last 3
> answers were all correct.** A lapse drops it below the threshold and the distractors ease off
> again, automatically.

Why per card: desirable difficulty applies once material is retrievable, not before (Bjork &
Bjork). Cruel distractors on a brand-new island are not a challenge, they are noise — and worse,
the negative suggestion effect (Roediger & Marsh, 2005) means a near-miss lure you cannot yet
reject is a lure you may encode. Tying cruelty to maturity makes escalation automatic, granular,
and self-correcting, with no setting for him to get wrong.

Keep the manual setting, as three states: **auto** (default), **always**, **never**.

### 8.3 Kinds escalate with maturity too

`kindsFor` currently returns every applicable kind and `buildQuestion` shuffles them. Replace the
shuffle with a maturity-weighted pick over an explicit difficulty ordering:

| Facet | Easier → harder |
|---|---|
| place | `locate` → `shape` → Label the Map *Fill* → Label the Map *Name* |
| flag | `name-flag` → `flag-name` |
| capital | `capital-of` → `capital-is` |
| group | `group-member` → `group-of` → `odd-one-out` |
| facts | `region` / `currency` / `language` / `demonym` → `largest` → `border` |

Rule: interval < 5 days picks from the easiest tier; 5–21 days from the first two; ≥ 21 days
weighted toward the hardest available. This is a bigger lever than `cruel` and it is already paid
for — the kinds exist, they are simply being picked at random.

Two engine fixes belong with it. **`largest` should only build when the population ratio between
the top two options is ≥ 2×**; comparing near-identical populations is a coin flip dressed as a
question. And a **6-option variant** of the options form should unlock at pack accuracy ≥ 92%,
which is a cleaner difficulty increase than cruelty alone because it raises the recall demand
rather than only the similarity of the lures.

### 8.4 De-escalation, and telling him

Two lapses on a card within 14 days turns cruelty off for that card and forces the easier kind
until its interval passes 5 days again. Automatic, silent, no ceremony.

**How escalation is announced: one line, after the fact, in the round summary.**

> *The Caribbean is on hard distractors now — wrong answers are the nearest look-alikes.*

Never a modal, never a celebration, never in advance. Announced beforehand it is a threat;
announced afterwards it is a report on his own progress, which is what it actually is. The current
state must also be legible per pack in settings — *"Caribbean: hard. Africa: standard."* — and
overridable.

---

## 9. What to build first

### Tier A — the game does not work without these

1. **The round loop.** Fixed 14 questions, the composition and placement rules of §2.2, immediate
   feedback that always shows the correct answer, and the four-part close screen. Without feedback
   the near-miss distractors actively install errors, so this is not a polish item.
2. **The scheduler rewrite.** Per-card ease, the interval ladder of §1.2, the 270-day cap, the
   multiplicative lapse, the question-difficulty grading, and — importantly — **practice answers
   must not advance intervals.**
3. **The introduction ladder.** Replace the tier sort with the scaffold rule of §3.1, fix the flat
   island tier in `build.mjs`, and gate facets per item. Without this the Caribbean is introduced
   in almost exactly the wrong order, which undermines everything downstream.
4. **The mastery model and the ledger.** Minimum-based item mastery scored against supported
   facets, the four-word vocabulary, the three counts, the headline sentence, and visible decay.
5. **Label the Map, Fill mode.** The mode he is here for, and it needs no new data — `map.js` and
   the existing locate machinery already do it.

### Tier B — makes it work well

6. **Discrimination drills**, including the confusion-state fixes (symmetric keys, residual weight
   on clear, 30-day decay) and the seeding from contested memberships and name-similar pairs.
7. **Interleaving constraints and the first-exposure block**, plus the one-time note explaining
   why mixed practice feels worse.
8. **Maturity-driven kind selection and automatic cruel escalation**, plus the `largest` ratio fix.
9. **Label the Map, Name mode** — generous fuzzy matching, speech input, spelling never graded.
10. **The mastery map view.**

### Tier C — later, or never

11. **Clean-sweep history and held regions.** Real, but it needs weeks of sweeps to have anything
    to show, so it can follow the sweep itself.
12. **The contested-membership question kind.** A distinctive, small, high-value mechanic that
    suits a planner: *"Is Dominica a Leeward or a Windward island?"* with three options where the
    correct answer is **"it depends"** and the explanation is the curated `note`. Only offered once
    both groups are known. Twenty of these exist in the data and they are among the most
    interesting things in the corpus — but they are a garnish, not a foundation.
13. **Multi-pack sessions.** One pack at a time is simpler and adequate for a long while.
14. **Fixing the city corpus.** 461 items currently support two facets because they carry no map
    membership. Either give cities an `m` in the build or deprioritise the city packs honestly.
15. **Anything social, any points system.** Never.

---

## Appendix — specific changes to what is already written

| File | What | Change |
|---|---|---|
| `build/build.mjs:162` | every island gets `t: 2` | Derive island tier from prominence, or ignore `tier` for ordering and use the §3.1 scaffold rule |
| `build/build.mjs:83` | country tier from population/area | Fine globally; it is why Dominica and Grenada are tier 4. The scaffold rule makes this harmless |
| `build/build.mjs` (cities) | city items have no `m` | Add map membership so `locate` and `shape` can fire for 461 items |
| `schedule.js:19–27` | fixed `INTERVALS` | Replace with `interval × ease`, cap 270 days (§1.2) |
| `schedule.js:28` | `MASTERED = 4` (8 days) | Replace with the four-word vocabulary keyed on interval; `known` at 21 days |
| `schedule.js:29` | `FRONTIER = 14` cards | 10 **items** in learning per pack, plus a 25 cards/day projected-load brake |
| `schedule.js:89–94` | `itemMastery` mean over default `FACETS` | Minimum over `facetsFor(item)` |
| `schedule.js:117–123` | `b − 2` on a miss | `interval × 0.35`, floor 1 day, ease −0.25, via a relearning state |
| `schedule.js:127–131` | directional `conf` keys, trigger on `=== 2` | Symmetric pair key, `>= 2`, 30-day halving decay, seeded from contested groups |
| `schedule.js:156–160` | `clearConfusion` deletes the pair | Keep a residual weight of 0.5 so the pair stays a preferred distractor |
| `schedule.js:138–147` | `day.streak` resets to 1 | "practised N of the last 50 days" |
| `schedule.js:241–258` | `next()` practice branch advances boxes | Practice answers update stats and confusions only; offer Label the Map instead |
| `schedule.js:261–263` | relearning repeat at +3, same facet | Same facet, **different kind** where one exists |
| `engine.js` `buildQuestion` | shuffles applicable kinds | Maturity-weighted pick over the §8.3 ordering |
| `engine.js` `largest` | builds on any four items with population | Require a ≥ 2× ratio between the top two options |
| `engine.js` `nearMisses` | same-group distractors are likely | Guarantee at least one same-group distractor when the answer is in a curated group |
| `engine.js` `KINDS` | no two-option or six-option form | Add a two-option side-by-side form for drills (§5.2) and a six-option variant for §8.3 |
