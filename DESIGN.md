# Landfall — Design Specification

Version 1.0 · for direct implementation in hand-written HTML / CSS / vanilla JS.
No frameworks, no utility classes, no component library.

This document is the contract. Where it names a hex value, a millisecond count or
a pixel size, use that value. Where it states a *rule*, the rule outranks any
individual value — if a later screen conflicts with a rule, the rule wins.

---

## 0. The idea in one paragraph

Landfall is a **chart being surveyed**. The ground of the app is shallow water;
every surface that carries content is **paper laid on that water**; the things
you have learned get **inked in**, and the things you have not are **pale
outlines waiting to be drawn**. That single metaphor does the work of a dozen UI
decisions: it explains the palette (sea, paper, ink, the vermilion of a
surveyor's mark), it explains why cards are soft-filled paper shapes with no
outline, it explains the hero, and — crucially — it gives progress a *visual*
form instead of a numeric one. On day 60 the home screen of this app is
literally a more completed chart than it was on day 1, without a single extra
word of text. That is the spine of everything below.

Two people's constraints shape every decision here. **Robert is dyslexic**, so
text is a cost to be spent deliberately, nothing measures reading speed, and
read-aloud is structural. **Robert has seen four of these apps**, so anything
that reads as a generated template — bordered boxes, a wall of equal-weight
cards, decorative icons that mean nothing — is a failure regardless of how well
it works.

---

## 1. Palette and tokens

### 1.1 The decision: two themes, one applied globally

**Recommendation: ship a light theme ("Chart") and a dark theme ("Night
Chart"), selected by `prefers-color-scheme` with a manual override, and apply
the chosen theme consistently to every screen.**

Why two rather than one: this is a phone app used in bed and on transit. Pure
white at full brightness in a dark room is a genuine legibility problem, and
glare/visual-stress sensitivity is over-represented among dyslexic readers
(Irlen-type symptoms — the same reason the light theme's paper is warm off-white
and never `#FFFFFF`). A single light theme, as Halyard shipped, is the wrong
call for a night-reading app.

Why *not* Wordhoard's per-screen inversion: inverting the home screen against
every other screen made the home feel like a different application, and it
forced every component to have two visual lives. Here the **hero** carries the
drama and the theme stays put. One theme, everywhere, all the time.

### 1.2 Light theme — "Chart"

The ground is shallow water. Cards are paper. Ink is chart ink, not black.

```css
:root {
  /* ── ground: the sea ──────────────────────────────────────────── */
  --ground-top:      #D6E7E5;   /* lightest stop — see the contrast rule */
  --ground-bottom:   #BFD8DC;
  --ground: linear-gradient(170deg, var(--ground-top) 0%, var(--ground-bottom) 100%);

  /* ── surfaces: paper ──────────────────────────────────────────── */
  --surface:         #FFFCF7;   /* the bubble. warm paper, never #FFF     */
  --surface-tint:    #E3EFEE;   /* inset / secondary icon tile            */
  --surface-sunk:    #EDF4F3;   /* wells: map frame, list insets          */
  --hairline:        rgba(20, 49, 58, 0.10);

  /* ── ink ──────────────────────────────────────────────────────── */
  --ink:             #14313A;   /* titles, place names, the subject       */
  --ink-2:           #40606B;   /* body, option labels                    */
  --ink-3:           #4F6872;   /* small-caps labels, metadata            */

  /* ── the five meaningful colours ──────────────────────────────── */
  --sea:             #0D6A7C;   /* interactive. links, active, the lead   */
  --sea-deep:        #0A4E5C;   /* gradient stop A                        */
  --sea-bright:      #12809A;   /* gradient stop B                        */
  --vermilion:       #C23B22;   /* the surveyor's mark; WRONG             */
  --verdigris:       #0B7A5E;   /* RIGHT                                   */
  --brass:           #8A5D10;   /* "shaky / in progress" — text-safe       */
  --brass-mark:      #C9902B;   /* "shaky" as a dot or ring — non-text     */

  /* ── washes: verdict tints, always paper-backed ───────────────── */
  --wash-right:      #DFF0E9;
  --wash-wrong:      #FBE4DE;
  --wash-right-veil: rgba(11, 122, 94, 0.10);
  --wash-wrong-veil: rgba(194, 59, 34, 0.10);

  /* ── chart furniture ──────────────────────────────────────────── */
  --land-unseen:     #E8E1D2;   /* map feature you have never met          */
  --land-shaky:      #E9CE9B;   /* met, not mastered                       */
  --land-known:      #14313A;   /* inked in                                */
  --land-context:    #CDE0E1;   /* non-candidate land, the sea's furniture */
  --contour:         rgba(13, 106, 124, 0.07);
}
```

**Computed contrast ratios (sRGB, WCAG 2.2 formula). All verified, not
estimated:**

| Foreground | on `--surface` | on `--ground-top` | on `--ground-bottom` | Verdict |
|---|---|---|---|---|
| `--ink` #14313A | **13.41** | 10.73 | 9.20 | AAA everywhere |
| `--ink-2` #40606B | **6.61** | 5.29 | 4.53 | AA everywhere |
| `--ink-3` #4F6872 | **5.77** | 4.62 | 3.96 | AA on surface + ground-top |
| `--sea` #0D6A7C | **6.09** | 4.87 | 4.18 | AA on surface + ground-top |
| `--vermilion` #C23B22 | **5.20** | 4.17 | 3.57 | AA **on paper only** |
| `--verdigris` #0B7A5E | **5.18** | 4.15 | 3.55 | AA **on paper only** |
| `--brass` #8A5D10 | **5.62** | 4.49 | 3.85 | AA **on paper only** |
| white on `--sea` | 6.23 | — | — | AA |
| white on `--sea-deep` | 9.30 | — | — | AAA |
| white on `--sea-bright` | 4.59 | — | — | AA (worst gradient stop) |
| `--ink` on `--wash-right` | 11.62 | — | — | AAA |
| `--ink` on `--wash-wrong` | 11.28 | — | — | AAA |

**Two hard rules fall out of that table, and they are not negotiable:**

1. **`--vermilion`, `--verdigris` and `--brass` are never used as text directly
   on the ground.** On the ground they may appear only as fills, dots, rings and
   strokes, where the WCAG non-text minimum of 3:1 applies and they clear it
   (3.55 : 1 worst case). As *text* they always sit on `--surface` or on a wash.
2. **`--ink-3` at 11px sits on `--surface` or `--ground-top`, never on
   `--ground-bottom`.** In practice: small-caps labels live on cards. The two
   that must sit on bare ground (section labels between cards) use `--ink-2`.

### 1.3 The contrast trap, stated as a check

You hit this twice before: the ground is a gradient, the card was checked
against the base colour, and at the lightest stop every surface dissolved.

> **THE LIGHTEST-STOP RULE.** A surface must be at least **1.25 : 1** against the
> *lightest* stop of whatever gradient sits behind it, before any shadow is
> applied.

Measured here: `--surface` #FFFCF7 vs `--ground-top` #D6E7E5 = **1.25 : 1**
(and 1.46 : 1 against the bottom stop). That is the floor, deliberately, so that
paper reads as paper without the shadow doing all the work. Shadow and the warm
/ cool hue split then push it well clear perceptually.

When you add any new gradient — the hero, a mastery ring track, a mode tile —
run the same check against its lightest stop before you commit the value.

### 1.4 Dark theme — "Night Chart"

The ground is deep water; the paper goes to wet chart-table card, and the
accents lift because saturated mid-tones die on dark grounds.

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* tokens below */ }
}
:root[data-theme="dark"] { /* the same block */ }
```

```css
  --ground-top:      #0A2027;   /* lightest stop */
  --ground-bottom:   #061318;
  --surface:         #163843;
  --surface-tint:    #1C444F;
  --surface-sunk:    #102B33;
  --hairline:        rgba(233, 241, 240, 0.09);

  --ink:             #E9F1F0;
  --ink-2:           #B3C9CD;
  --ink-3:           #93AEB4;

  --sea:             #57C7D9;
  --sea-deep:        #0B4E5E;
  --sea-bright:      #16788C;
  --vermilion:       #FF8D72;
  --verdigris:       #54D6A8;
  --brass:           #E5B863;
  --brass-mark:      #E5B863;

  --wash-right:      #10362F;
  --wash-wrong:      #3A211C;
  --wash-right-veil: rgba(84, 214, 168, 0.12);
  --wash-wrong-veil: rgba(255, 141, 114, 0.12);

  --land-unseen:     #23414A;
  --land-shaky:      #6B5626;
  --land-known:      #E9F1F0;
  --land-context:    #12303A;
  --contour:         rgba(87, 199, 217, 0.08);
```

**Dark theme computed ratios:**

| Foreground | on `--surface` #163843 | on `--surface-tint` #1C444F |
|---|---|---|
| `--ink` #E9F1F0 | **10.89** | 9.20 |
| `--ink-2` #B3C9CD | **7.23** | 6.11 |
| `--ink-3` #93AEB4 | **5.33** | 4.50 |
| `--sea` #57C7D9 | **6.29** | 5.32 |
| `--vermilion` #FF8D72 | **5.54** | 4.68 |
| `--verdigris` #54D6A8 | **6.88** | 5.81 |
| `--brass` #E5B863 | **6.76** | 5.72 |
| `--ink` on `--wash-right` | 11.51 | — |
| `--ink` on `--wash-wrong` | 12.94 | — |

Lightest-stop check: `--surface` #163843 vs `--ground-top` #0A2027 =
**1.35 : 1**. Clears the floor.

In dark mode the elevation convention inverts — surfaces get *lighter*, and
shadow alone is nearly useless. Every card therefore also gets a 1px top
inner highlight: `box-shadow: inset 0 1px 0 rgba(233,241,240,0.06)` added to
whatever shadow token it already carries.

### 1.5 Why this palette, and why it is not the previous two

Halyard was white / orange / yellow. Wordhoard was navy / marigold / teal.
Landfall is **shallow-water cyan-green ground, warm paper surfaces, deep sea
teal as the single interactive colour, and vermilion reserved almost entirely
for the surveyor's mark and for a miss.** No orange, no marigold, no navy, and
the accent colour is used *sparingly* rather than as a field.

The semantic assignment is chosen so no colour ever carries two meanings:

| Colour | Means, and only means |
|---|---|
| `--sea` | you can touch this |
| `--verdigris` | right |
| `--vermilion` | wrong, and the survey mark on the hero |
| `--brass` | met but not mastered |
| `--ink` | content |

The one overlap — vermilion as both "wrong" and "the mark" — is safe because
the mark appears only on the home hero and the Atlas, and the verdict appears
only mid-round. They never share a screen. If you ever need them together,
the mark loses and becomes `--ink`.

### 1.6 Dyslexia-specific legibility rules baked into the tokens

- **No pure white and no pure black.** Paper is `#FFFCF7`, ink is `#14313A`.
  Maximum contrast is not maximum legibility; the halation of black-on-white is
  a common complaint. 13.41 : 1 is far past AAA and far short of glare.
- **Line-height never below 1.5 for anything longer than a phrase**; body text
  is 1.65. (See §2.)
- **Body copy gets `letter-spacing: 0.01em` and `word-spacing: 0.04em`.** Both
  small, both measurably helpful for letter-crowding.
- **Ragged right, never justified.** Justification creates rivers and variable
  word-spacing, which is the single worst thing you can do to a dyslexic reader.
  `text-wrap: pretty` on prose, `text-wrap: balance` on headings.
- **Emphasis is weight or colour, never italic.** Literata's italic is lovely
  and you will not use it for emphasis anywhere in this app.
- **Measure capped at 60ch** on any prose block.
- **Nothing is text that could be a shape.** See §5 and §9.

---

## 2. Type scale

Two families, already self-hosted at `app/fonts/` with latin, latin-ext and
vietnamese subsets — you need latin-ext and vietnamese, because the corpus
contains `Đắk Nông`, `Ñuble`, `Curaçao`, `İğdir`, `Aisén del General Carlos
Ibáñez del Campo` and `São Tomé and Príncipe`.

```css
--font-read: 'Literata', Georgia, 'Times New Roman', serif;
--font-use:  'Archivo', system-ui, -apple-system, 'Segoe UI', sans-serif;
```

### 2.1 The rule

> **Literata = what you READ. Archivo = what you USE.**

Serif carries place names, the question's subject, numbers, titles, notes and
Atlas prose. Sans carries option labels, buttons, small-caps labels, chips,
stats captions and every piece of navigation. A user should be able to tell,
from the letterforms alone and before reading a word, whether a thing is
content or a control.

There is one deliberate exception, and it is the most important typographic
move in the app:

### 2.2 The Frame / Subject split

The engine produces whole sentences: `"Where is Saba?"`, `"What is the capital
of Jamaica?"`, `"Which of these is in the Leeward Islands?"`. Rendering those as
a single serif sentence is exactly the text-heavy failure mode to avoid — the
frame is identical every time and the subject is the only part that changes.

**Split every prompt into a frame and a subject:**

```
WHERE IS                 ← Archivo 600, 11px, uppercase, .14em, --ink-3
Saba                     ← Literata 700, clamp(2.1rem,9vw,3rem), --ink
```

The frame is *chrome*, so it is sans, small, and quiet. The subject is the thing
under test, so it is serif, huge and dark. Content dwarfs chrome, literally by
a factor of four in type size. The dyslexic reader reads **one word**, not a
sentence, and the instruction is carried by a label they learn to ignore after
three questions.

**Implementation ask (one line per kind in `engine.js`):** add `frame` and
`subject` alongside the existing `prompt`, e.g. in `KINDS.locate.build`:

```js
prompt: 'Where is ' + withArticle(it) + '?',
frame: 'Where is',            // NEW
subject: it.n,                // NEW
```

The full `prompt` string stays and is what `speak` and the aria-label use, so
screen readers and speech still get a grammatical sentence. If a kind cannot be
split (`largest` — "Which has the most people?" has no subject), set
`subject: null` and render the frame alone at **Question / no-subject** size
(§2.3). Do not build a regex fallback; the explicit fields are two minutes of
work and a regex over fifteen prompt templates is a bug farm.

| Kind | frame | subject |
|---|---|---|
| `locate` | Where is | *place* |
| `shape` | Which *country/island/province* is this | — (figure is the subject) |
| `flag-name` | Whose flag is this | — (figure is the subject) |
| `name-flag` | Find the flag of | *place* |
| `capital-of` | Capital of | *place* |
| `capital-is` | Capital of what | *capital* |
| `parent` | Who holds | *place* |
| `group-of` | Which group holds | *place* |
| `group-member` | Which of these is in | *group name* |
| `border` | Which of these borders | *place* |
| `region` | Which sub-region holds | *place* |
| `currency` | Money spent in | *place* |
| `language` | Official language of | *place* |
| `demonym` | Someone from … is | *place* |
| `odd-one-out` | Which of these is **not** in | *group name* |
| `largest` | Which has the most people | — |

Note `odd-one-out` and `border` — the frame carries the negation and the
operative word (`not`) is `--vermilion` and Archivo 700. Negation is the single
highest-risk thing to miss when reading quickly; it gets colour and weight, not
italics, not all-caps.

### 2.3 The scale

`rem` base is 16px. Do not change the root font size; respect the user's.

| Role | Family | Size | Weight | Line-height | Tracking | Notes |
|---|---|---|---|---|---|---|
| **Hero wordmark** | Literata | `clamp(2.4rem, 11vw, 3.1rem)` | 700 | 1.0 | −0.02em | two-tone, §6.2 |
| **Screen title** | Literata | `1.5rem` / 24px | 600 | 1.25 | −0.01em | Atlas, Progress, Setup |
| **Question subject** | Literata | `clamp(2.1rem, 9vw, 3rem)` | 700 | 1.05 | −0.02em | the thing under test |
| **Question frame** | Archivo | `0.6875rem` / 11px | 600 | 1.3 | .14em | uppercase, `--ink-3` |
| **Question, no subject** | Literata | `clamp(1.5rem, 6.5vw, 1.9rem)` | 600 | 1.25 | −0.01em | `largest`, `shape` |
| **Option label** | Archivo | `1.125rem` / 18px | 500 | 1.35 | 0 | `--ink-2`; see overflow rule |
| **Option label, long** | Archivo | `1rem` / 16px | 500 | 1.3 | 0 | ≥ 26 chars, §7.3 |
| **Button label** | Archivo | `1.0625rem` / 17px | 600 | 1 | .01em | |
| **Mode row title** | Archivo | `1.125rem` / 18px | 600 | 1.2 | 0 | `--ink` |
| **Mode row support** | Archivo | `0.875rem` / 14px | 400 | 1.4 | 0 | `--ink-3` |
| **Small-caps label** | Archivo | `0.6875rem` / 11px | 600 | 1.3 | .14em | uppercase |
| **Stat number** | Literata | `2rem` / 32px | 700 | 1 | −0.01em | `font-variant-numeric: tabular-nums` |
| **Stat number, small** | Literata | `1.25rem` / 20px | 700 | 1 | −0.01em | in chips; tabular |
| **Body / prose** | Literata | `1.0625rem` / 17px | 400 | **1.65** | .01em | `--ink-2`, max 60ch |
| **Note / explain** | Literata | `1rem` / 16px | 400 | 1.6 | .01em | `--ink-2` |
| **Chip label** | Archivo | `0.8125rem` / 13px | 600 | 1 | .01em | |
| **Map feature label** | Archivo | `0.75rem` / 12px | 600 | 1 | .02em | SVG, with halo, §7.2 |

**Numbers are serif.** Every count, percentage, streak and population in the app
is Literata 700 with tabular figures. This is what makes the Progress screen
read as a *chart* rather than a dashboard, and it is the cheapest way to make
numbers feel like content rather than telemetry.

**Overflow rule for option labels.** The corpus contains
`Saint Helena, Ascension and Tristan da Cunha` (44 chars) and
`Bosnia and Herzegovina convertible mark` (38). Options never truncate — an
elided place name is an unanswerable question. Instead: at ≥26 characters drop
to the *long* size, wrap to a maximum of three lines, and let the bubble grow.
Below 26 characters the bubble is a fixed 64px min-height.

---

## 3. Space, radius, shadow, motion

### 3.1 Spacing

4px base. Use the ramp; do not invent intermediate values.

```css
--s1:  4px;   --s2:  8px;   --s3: 12px;  --s4: 16px;
--s5: 20px;   --s6: 24px;   --s7: 32px;  --s8: 40px;  --s9: 56px;
--gutter: 18px;                        /* page side padding, phone */
--stack:  12px;                        /* gap between sibling bubbles */
--section: 28px;                       /* gap between groups of bubbles */
--safe-b: max(var(--s4), env(safe-area-inset-bottom));
--safe-t: max(var(--s4), env(safe-area-inset-top));
```

Page gutter is **18px**, not 16 or 20. It is wide enough that a full-width
bubble reads as a floating object rather than a band, and narrow enough that a
64px option row still has room for a 44px trailing speech target.

### 3.2 Radius

```css
--r-bubble: 18px;   /* the default. options, mode rows, chips-as-cards */
--r-card:   26px;   /* large containers: hero frame, sheet top, summary */
--r-tile:   14px;   /* the icon tile inside a mode row */
--r-flag:   12px;   /* flag image corners */
--r-map:    22px;   /* the map well */
--r-pill:   999px;  /* chips, buttons, status pills */
```

18px is the house number and it is the default for everything at content scale.
26px is only for things that *contain* 18px bubbles, so that nesting reads
correctly (an inner radius equal to the outer radius looks like a mistake; the
outer must be larger by roughly the padding).

### 3.3 Shadow — the thing that makes it a bubble

**No element in this app has a visible border, with exactly two exceptions**
(flag tiles, §7.4; and the focus ring, §10). Elevation is carried entirely by
layered soft shadow plus the surface / ground luminance step.

```css
/* resting bubble */
--shadow-1:
  0 1px 2px  rgba(20, 49, 58, 0.05),
  0 4px 10px -2px rgba(20, 49, 58, 0.07);

/* raised: the lead action, the active card */
--shadow-2:
  0 2px 4px  rgba(20, 49, 58, 0.06),
  0 10px 24px -6px rgba(20, 49, 58, 0.11);

/* the verdict sheet, rising from below */
--shadow-3:
  0 -2px 8px rgba(20, 49, 58, 0.06),
  0 -18px 48px -12px rgba(20, 49, 58, 0.18);

/* pressed: shadow collapses inward as the element scales down */
--shadow-press:
  0 1px 1px rgba(20, 49, 58, 0.06);
```

Dark theme: halve every alpha and add
`inset 0 1px 0 rgba(233,241,240,0.06)` to `--shadow-1` and `--shadow-2`.

The two-layer structure is what makes it read as soft rather than as a drop
shadow: a tight, nearly-opaque contact shadow at 1–2px plus a wide, very
diffuse ambient shadow with a negative spread. One-layer shadows look synthetic.

### 3.4 Motion

```css
--e-out:    cubic-bezier(.22, .61, .36, 1);    /* default; decelerate */
--e-in-out: cubic-bezier(.65, 0, .35, 1);      /* symmetric transitions */
--e-soft:   cubic-bezier(.34, .9, .3, 1);      /* sheet rise, no overshoot */

--t-press:  90ms;    /* tap feedback */
--t-state: 180ms;    /* colour / opacity state change */
--t-card:  280ms;    /* sheet, card entry */
--t-screen:320ms;    /* screen change */
--t-map:   520ms;    /* map viewBox ease — already in map.js, keep it */
--t-stagger:40ms;    /* per-item delay in the hero and summary */
```

**What animates:** the verdict sheet's rise, the verdict wash, the map's
viewBox, the hero's entry and drift, press states, the mastery rings on the
Progress screen when the screen enters, screen transitions.

**What does not animate, ever:** the question text (no typewriter, no fade-in
of the subject — it must be readable the instant it exists), the option labels,
numbers counting up, anything that loops indefinitely other than the hero's
drift, anything with a bounce or overshoot on text.

**Reduced motion.** Under `@media (prefers-reduced-motion: reduce)`: screen
transitions become instant, the hero drift stops entirely (the hero still
renders, just static), the map viewBox jumps rather than eases (`animate:false`
into `MapView.setView`), the sheet appears without translation but keeps its
opacity fade at 120ms, and press states keep working — a tap must always give
feedback. Set `--t-stagger: 0`.

---

## 4. The component vocabulary

Six components. Everything on every screen is one of these. If you find
yourself wanting a seventh, the answer is almost always "a bubble with
different contents".

### 4.1 The bubble

```css
.bubble {
  background: var(--surface);
  border-radius: var(--r-bubble);
  box-shadow: var(--shadow-1);
  border: 0;
  padding: var(--s4);
}
```

That is the whole thing. Filled, generously rounded, softly shadowed, no
outline. It is the single most important visual decision in the app and every
"card" in every wireframe below is this.

### 4.2 The press state

Everything tappable scales down. Nothing changes colour on press (colour is
reserved for meaning).

```css
.tap { transition: transform var(--t-press) var(--e-out),
                   box-shadow var(--t-press) var(--e-out); }
.tap:active { transform: scale(.985); box-shadow: var(--shadow-press); }
```

Use `:active`, and add `touch-action: manipulation` to kill the 300ms delay and
double-tap zoom. On elements under 80px tall use `scale(.97)` instead — a 1.5%
scale on a small chip is invisible.

### 4.3 Tap targets — Fitts's law, made concrete

Fitts's law says acquisition time falls with target width and rises with
distance. On a phone the distance is fixed (thumb to screen), so the only lever
is size.

- **Minimum 56 × 56 CSS px for any primary control.** Options are 64px tall
  minimum and full-bleed to the gutters — the width of the screen is a free
  increase in target size, and a full-width row is effectively infinitely wide
  in the horizontal axis.
- **Minimum 44 × 44 for secondary controls** (the speech button, back, settings),
  with at least 8px of clear space to the nearest other target.
- Where a visual element is smaller than its target, extend the hit area with
  padding or a transparent `::after`, never by making the visual bigger.
- **Map hit targets are computed in screen pixels, not SVG units.** See §7.2 —
  this is a real bug waiting in the current `map.js`.

### 4.4 The icon tile

The lead action gets a gradient tile; every other row gets a flat tinted tile.
This is the house pattern and it does real work: it establishes one primary
action per screen without a single word of hierarchy.

```css
.tile {                      /* the default: everything that is not the lead */
  width: 44px; height: 44px; border-radius: var(--r-tile);
  background: var(--surface-tint);
  display: grid; place-items: center;
  color: var(--sea);
}
.tile--lead {
  background: linear-gradient(145deg, var(--sea-bright), var(--sea-deep));
  color: #FFFFFF;
  box-shadow: 0 3px 8px -2px rgba(10, 78, 92, .38);
}
```

White on the lightest gradient stop `--sea-bright` = **4.59 : 1**, so even a
thin-stroked glyph clears AA text contrast, never mind the 3:1 non-text floor.

**Icon drawing rules.** Inline SVG, 24×24 viewBox, `stroke-width: 1.75`,
`stroke-linecap: round`, `stroke-linejoin: round`, `fill: none`, `currentColor`.
Every icon in this app is drawn from chart furniture, not from a generic icon
set — see §9.4. Never a rounded-square-with-a-symbol-inside from a library.

### 4.5 The chip (with status dot)

```
┌─────────────────────┐
│ ● 12 days           │   dot + number + short label, pill, no border
└─────────────────────┘
```

```css
.chip {
  display: inline-flex; align-items: center; gap: var(--s2);
  min-height: 34px; padding: 0 var(--s3) 0 var(--s3);
  border-radius: var(--r-pill);
  background: var(--surface);
  box-shadow: var(--shadow-1);
  font: 600 .8125rem/1 var(--font-use);
  color: var(--ink-2);
}
.chip .dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.chip .n   { font: 700 1.25rem/1 var(--font-read);
             font-variant-numeric: tabular-nums; color: var(--ink); }
```

Dot colours: `--verdigris` = healthy / on track · `--brass-mark` = shaky, needs
work · `--vermilion` = a confusion that has bitten twice · `--sea` = neutral
status. The dot is never the only carrier of meaning (§10).

### 4.6 The progress ring

An SVG ring, 100% CSS-driven from a single `--pct` custom property. Used for
pack mastery everywhere. It is the app's primary quantitative display because a
ring is read as a proportion in one fixation, where "38%" must be parsed.

```
   ╭─╮        r=17, stroke 5, 44×44 box
  ╭   ╮       track:  --surface-tint  (dark: --surface-sunk)
  │ ◔ │       fill:   --sea (0–.34) → --brass-mark (.35–.74) → --verdigris (.75+)
  ╰   ╯       cap: round; starts at 12 o'clock; clockwise
   ╰─╯        no number inside at 44px; number sits beside it
```

```css
/* stroke-dasharray = C = 2πr = 106.81 for r=17 */
circle.ring-fill {
  stroke-dasharray: 106.81;
  stroke-dashoffset: calc(106.81 * (1 - var(--pct)));
  transform: rotate(-90deg); transform-origin: 50% 50%;
  transition: stroke-dashoffset 620ms var(--e-out);
}
```

At 0% the ring is a complete empty track — which is a meaningful, honest state
("none of this yet"), not an error. Never hide a ring because it is empty; that
is how day 1 ends up looking broken.

---

## 5. The opening menu

This is the centrepiece. It has to be compelling on a screen the user sees more
than any other, it has to be honest on day 1 with nothing learned, and it has
to stay good on day 60 with a thousand cards in flight.

### 5.1 Wireframe

```
┌────────────────────────────────────────────┐ ← ground: sea gradient +
│                                            │   faint contour lines
│   Land fall                            ⚙   │  ← wordmark (two-tone) + settings
│   ─────────                                │
│                                            │
│  ╭──────────────────────────────────────╮  │
│  │                          ✕           │  │ ← THE CHAIN (hero)
│  │      ▲         ◌                     │  │   real island silhouettes
│  │  ◌        ▲         ◌      ▲    ◌    │  │   strung on a survey line
│  │ ·····╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌···· │  │   filled = learned
│  │            ◌         ▲               │  │   pale  = not yet
│  ╰──────────────────────────────────────╯  │
│                                            │
│   ● 12 days   ◔ Caribbean 38%   ◑ 9 due    │ ← status chips (conditional)
│                                            │
│  ╭──────────────────────────────────────╮  │
│  │ ▰▰  Quick Play                    ›  │  │ ← LEAD: gradient tile
│  │ ▰▰  12 questions · Caribbean         │  │
│  ╰──────────────────────────────────────╯  │
│  ╭──────────────────────────────────────╮  │
│  │ ░░  Training            ● 9      ›   │  │ ← flat tinted tile
│  │ ░░  spaced, untimed                  │  │
│  ╰──────────────────────────────────────╯  │
│  ╭──────────────────────────────────────╮  │
│  │ ░░  Label the Map       ◔ 4/13   ›   │  │
│  │ ░░  fill in a whole region           │  │
│  ╰──────────────────────────────────────╯  │
│  ╭──────────────────────────────────────╮  │
│  │ ░░  Atlas                         ›  │  │
│  │ ░░  1,742 places · read or listen    │  │
│  ╰──────────────────────────────────────╯  │
│  ╭──────────────────────────────────────╮  │
│  │ ░░  Progress            ● 3      ›   │  │
│  │ ░░  mastery, streak, drills          │  │
│  ╰──────────────────────────────────────╯  │
│                                            │
└────────────────────────────────────────────┘
```

Five modes exactly, as specified, and the list length never changes. New packs
arrive *inside* Quick Play / Training / Label the Map, never as a sixth row.

### 5.2 The wordmark

`Land` in `--ink`, `fall` in `--sea`, set solid with no space between them,
Literata 700 at `clamp(2.4rem, 11vw, 3.1rem)`, tracking −0.02em. Beneath it, a
28px hairline rule in `--vermilion` at 2px, sitting under the `Land` half only —
a coastline under the land, with the sea half left open. That is the two-tone
wordmark plus a mark that means something.

No tagline. The hero explains the app.

### 5.3 THE CHAIN — the hero, built from real map data

Halyard had real flags on a catenary. Wordhoard had a drift of real words.
Landfall has **real island and region silhouettes, drawn from the same
pre-projected path data the quiz uses, strung along a survey line.**

**Exact data source.** For each map in `app/data/maps/*.json`, every feature is
`{ d, cx, cy, bb }` in the map's own projected coordinate space. The Caribbean
map alone has 88 features, all with real `d` paths, ranging from 0.9 to 320.8
units across.

**Selection algorithm:**

1. Determine the source maps: the `map` field of each pack in
   `State.settings().packs`. Default on first run is `['caribbean']` → the
   `caribbean` map (243 KB, already the first thing fetched).
2. From `map.f`, keep features that (a) have a `d` path, (b) have a `bb` whose
   longest dimension is ≥ 2.0 units, and (c) correspond to an item in
   `DB.items`. On the Caribbean map that yields roughly 80 candidates; the
   median longest dimension is 9.9 units, so you get genuine island shapes and
   not dots.
3. Shuffle with a seed of `dayKey() + visitCount`, so the chain is different
   every time the app opens — like Halyard's bunting — but stable if a render
   repeats within a single view.
4. Take **9** on screens ≥ 380px wide, **7** below that.
5. **Weighting:** 60% drawn from items with `State.itemMastery() > 0`, 40% from
   untouched items, clamped by availability. This guarantees the chain is
   always a mix of what you know and what you don't, at every stage of the
   journey.

**Rendering:**

- Each silhouette is its own inline `<svg>`, `viewBox` set to that feature's
  own `bb` expanded by 8% on each side. Normalising per-feature is what lets
  Saba (0.9 units) and Cuba (320 units) appear at the same visual size, which
  is the point: the hero is about *shape recognition*, not area.
- Each silhouette box is 46 × 46 px, `preserveAspectRatio="xMidYMid meet"`.
- The path's `fill` is set by mastery, with a 260ms transition:

  | `itemMastery()` | fill | stroke |
  |---|---|---|
  | 0 (never met) | `--land-unseen` | `--sea` @ 0.28, 0.9px |
  | 0.01 – 0.66 | `--land-shaky` | none |
  | > 0.66 | `--land-known` | none |

- **The survey line.** A single SVG path behind the silhouettes: a shallow
  catenary across the hero, `stroke: var(--vermilion)`, `stroke-width: 1.5`,
  `stroke-dasharray: 1 7`, `stroke-linecap: round`, opacity 0.45. It is a
  dotted survey traverse, and it is the structural rhyme with Halyard's bunting
  line without repeating it. The silhouettes sit *on* the line, alternating
  slightly above and below it, with per-item vertical jitter of ±10px seeded
  from the same shuffle.
- **The landfall mark.** Exactly one silhouette carries a small vermilion `✕`
  (two 9px strokes, 1.75 width, rotated 6°) at its upper-right. It marks **the
  place the next question will be about** — read `Scheduler.next()` for the
  active packs before painting, or, on day 1, the lowest-tier unseen item. It
  gives the hero a focal point, it is a genuine piece of information, and it is
  the only vermilion on the screen apart from the wordmark's coastline.
- **The frame.** The hero sits in a `--r-card` (26px) well of
  `--surface-sunk` at 0.55 alpha with no shadow — it is water, slightly stiller
  than the ground, not a card. Behind it, three faint contour arcs in
  `--contour`, drawn as concentric ellipses around the chain's centroid at
  1px — the "form lines" of an old chart. Height: `clamp(160px, 26dvh, 210px)`.

**Motion (restrained, and the only looping animation in the app):**

- **Entry:** each silhouette fades from 0 to 1 and rises 10px, `--t-card` with
  `--t-stagger` (40ms) × index. Total 9 × 40 + 280 = 640ms. The survey line
  draws itself left to right over 700ms via `stroke-dashoffset`. This happens
  once per app open, never on re-entry from another screen.
- **Drift:** after entry, each silhouette gets
  `animation: swell 9s ease-in-out infinite` translating ±3px vertically, with
  `animation-delay: calc(var(--i) * -1.1s)` so they are out of phase. Three
  pixels over nine seconds is barely perceptible and reads as water. Anything
  larger reads as a loading state.
- **Tap:** a silhouette is a 46px visual in a 56px target; tapping opens that
  place's Atlas card (§7.7). The hero is not decoration — it is a shortcut into
  the corpus, which is exactly what a chart is for.
- `prefers-reduced-motion`: no entry stagger, no drift, no line draw. Static.

**Day 1 vs day 60 — why this works at both ends:**

| | Day 1 | Day 60 |
|---|---|---|
| Chain | 9 pale outlines on a dotted line — an unsurveyed coast, with one vermilion ✕ showing where to start | 5–6 silhouettes inked solid, 2 in brass, 1–2 pale — a chart mostly drawn, with what remains visible |
| Reads as | an invitation | an achievement, and a to-do list |
| Broken? | no — an empty chart is the correct picture of an empty state | no — it never fills completely, because the weighting always pulls in unseen items |

The hero is therefore also the progress display, which is why the status chips
below it can stay small. **No empty-state illustration, no "get started" copy,
no onboarding card.** The chain plus the vermilion mark says it.

### 5.4 Status chips — what you see at a glance

A single horizontally-scrolling row of chips (§4.5), `overflow-x: auto`,
`scrollbar-width: none`, 8px gaps, first item flush to the gutter. **Chips are
conditional, and a chip that would show zero does not render.**

| Chip | Shows when | Content | Dot |
|---|---|---|---|
| Streak | `day.streak ≥ 2` | `12` + `days` | verdigris |
| Pack mastery | always (≥ 1 pack active) | ring at `--pct` + pack `short` + `38%` | ring colour |
| Due | `dueCount > 0` | `9` + `due` | brass |
| Drills | `confusions().length > 0` | `3` + `to untangle` | vermilion |

**On day 1 exactly one chip renders**: the pack mastery chip, ring empty, `0%`.
That is honest and it is not sad — an empty ring next to "Caribbean" is a
statement of scope, not of failure. **Never show "0 day streak" or "0 mastered".
Never render a zero as if it were an achievement.** That single rule is what
separates an app that feels good on day 1 from one that feels like a reproach.

By day 60 all four chips render and the row scrolls slightly. The row's height
never changes, so the mode list below it never moves between visits — an
important stability property when the same thumb opens the same app twice a day.

### 5.5 The mode list

Five bubbles, `--stack` (12px) apart, full width to the gutters.

```
╭──────────────────────────────────────────╮
│  ┌────┐                                  │   min-height 76px
│  │ ▰▰ │  Quick Play              ● 9  ›  │   padding 14px 16px
│  │ ▰▰ │  12 questions · Caribbean        │   tile 44px, gap 14px
│  └────┘                                  │
╰──────────────────────────────────────────╯
     ↑        ↑                    ↑     ↑
   tile     title + support      status  chevron
                                  slot
```

- **Quick Play is the lead** and is the only row with `--tile--lead` (gradient)
  and `--shadow-2`. Everything else gets `--tile` (flat `--surface-tint`) and
  `--shadow-1`. One gradient per screen. This is the house pattern and it
  removes the need for any "primary button" language.
- **Chevron** (`›`, a 16×16 stroked chevron in `--ink-3`) sits at the trailing
  edge of every row. It is the affordance that says "this goes somewhere",
  which is what lets the rows have no border and still read as tappable.
- **Status slot** sits between support text and chevron. It holds *at most one*
  of: a dot + number, or a small ring. Never a sentence. If a row has nothing
  to report, the slot is empty and the chevron sits alone.
- **Support line** is one short phrase, ≤ 34 characters, Archivo 400 14px in
  `--ink-3`. Quick Play's is dynamic (`12 questions · Caribbean`) because it
  states what will happen if you tap — which removes an entire confirmation
  step for the most-used action.
- Rows are `<button>` elements, not divs.

**Icons — drawn from chart furniture, one per mode:**

| Mode | Icon | Why it is not arbitrary |
|---|---|---|
| Quick Play | a dividers/compass pair, legs apart | the instrument you step off a distance with |
| Training | three nested contour rings | repetition, layered |
| Label the Map | a leader line from a dot to a short rule | exactly how a feature is labelled on a chart |
| Atlas | an open folded chart, two panels | the book of maps |
| Progress | a depth sounding: a vertical line with three tick marks | measuring how far down you have got |

No generic "play triangle", "brain", "book", "chart-bar" set. Every glyph is
something that appears on a real chart. This is a small thing that does a
disproportionate amount of work against the generated-template feeling.

### 5.6 Justification for every element on this screen

| Element | Principle | Decision it drives |
|---|---|---|
| Hero from real corpus data | *Recognition over recall*; the hero doubles as the progress display | No decorative illustration. The picture on the home screen is made of the actual content, and it changes as you learn |
| Only 5 modes | Hick's law — choice time grows with the log of the number of options; and his standing rule from Halyard | Packs live inside modes. The list never grows |
| Lead action visually distinct | *One primary action per screen*; Fitts + visual salience | Gradient tile + `--shadow-2` on Quick Play only |
| Support line states the outcome | *Progressive disclosure* — the common case needs no setup screen | Tapping Quick Play starts the round. Setup is behind a long-press or the chevron on the support line's pack name |
| Chips are conditional | Empty states should be honest, not padded | Day 1 shows one chip, not four zeros |
| Status as dot + number | Prefer colour and shape over text | `● 9` not "9 items due for review" |
| Chevrons | Affordance without borders | The row can be a soft filled bubble and still read as navigable |
| Numbers in serif | Content / chrome distinction | Counts feel like facts about the world, not telemetry |
| Contour lines on the ground | Gestalt figure/ground | Gives the ground texture so paper surfaces sit *on* something, at 7% alpha so it never competes |

---

## 6. Round setup

Reached from the chevron on Quick Play's pack name, from Training's row, or
from Settings. **Not shown before a default Quick Play round** — progressive
disclosure: the common case is "play the thing I played last time".

```
┌────────────────────────────────────────────┐
│  ‹  Set up a round                         │  ← back + screen title (Literata)
│                                            │
│   PACKS                                    │  ← small-caps label, --ink-2
│  ╭──────────────────────────────────────╮  │
│  │  ◔  The Caribbean          88   ✓    │  │  ring + name + count + check
│  │  ◔  Canadian provinces     13        │  │
│  │  ◔  Countries of the world 197  ✓    │  │
│  │  ◌  US states              51        │  │
│  │                              show all›  │
│  ╰──────────────────────────────────────╯  │
│                                            │
│   ROUND LENGTH                             │
│  ╭──────────────────────────────────────╮  │
│  │   8      12      20      ∞           │  │  ← segmented, 56px tall
│  ╰──────────────────────────────────────╯  │
│                                            │
│   WHAT GETS ASKED                          │
│  ╭──────────────────────────────────────╮  │
│  │  ⬤ where    ⬤ flags   ⬤ capitals     │  │  ← toggle chips, 6 facets
│  │  ⬤ who holds it  ⬤ groups  ⬤ facts   │  │
│  ╰──────────────────────────────────────╯  │
│                                            │
│  ╭──────────────────────────────────────╮  │
│  │            Start  ›                  │  │  ← lead button, gradient
│  ╰──────────────────────────────────────╯  │
└────────────────────────────────────────────┘
```

**Rules:**

- **Packs are a single bubble containing rows**, not one bubble per pack. 51
  packs as 51 separate cards is the bordered-box death. Inside the bubble, rows
  are separated by nothing at all — 14px of vertical padding each, no rules, no
  dividers. Grouping is by proximity (Gestalt), not by lines.
- Each pack row: **mastery ring** (recognition of progress at a glance), pack
  `short` name in Archivo 500 16px, item count `n` in Literata 700 as a small
  number in `--ink-3`, and a **check** in `--sea` when selected. Selected rows
  also get `background: var(--surface-tint)` with 12px radius, inset by 8px —
  a soft highlight, no border.
- The list shows the **5 packs with the most progress, plus the current
  selection, plus the 3 easiest unstarted packs by `tier`**, then `show all ›`
  opens a full sheet with a search field. Never render 51 rows unprompted.
- **Round length is segmented**, one bubble, four cells, 56px tall, selected
  cell gets `--surface-tint` + `--ink` while the rest are `--ink-3`. `∞` means
  play until you stop — which, for an app with no timers, is the natural mode
  and should feel first-class.
- **Facets, not question kinds.** The engine has fifteen kinds but six facets
  (`place, flag, capital, parent, group, facts`), and the facet labels already
  exist in `schedule.js` as `FACET_LABEL`. Six toggles is a screen; fifteen is a
  form. Each toggle is a chip with a filled/hollow dot. **A facet that no
  selected pack supports renders at 0.4 opacity and is not tappable** — e.g.
  flags are meaningless for `canada`, capitals for most cities. Do not hide it;
  showing it greyed teaches the structure of the corpus.
- **No timer control on this screen.** The clock setting (`settings.clock`,
  default `0`) lives in Settings under a heading that says what it is, off by
  default, and it is the only opt-in of its kind.

---

## 7. The question screens

### 7.1 The shared frame

All three answer forms share one layout. The chrome is identical so that only
the content changes between questions — which is what lets a round feel like
one continuous act rather than a sequence of pages.

```
┌────────────────────────────────────────────┐
│  ‹        ▪▪▪▪▪▫▫▫▫▫▫▫              ♪  ⏸  │ ← back · progress · sound · pause
│                                            │
│   WHERE IS                          ((•))  │ ← frame (Archivo 11 caps) + speak
│   Saba                                     │ ← subject (Literata 700, 3rem)
│                                            │
│   ┌──────────────────────────────────┐     │
│   │                                  │     │
│   │       THE ANSWER SURFACE         │     │ ← map / options / flags
│   │                                  │     │
│   └──────────────────────────────────┘     │
│                                            │
└────────────────────────────────────────────┘
```

- **Progress is a run of dots, not a bar and never a percentage.** One 6px dot
  per question in the round: answered-right = `--verdigris`, answered-wrong =
  `--vermilion`, current = `--ink` at 10px, unanswered = `--ink-3` @ 0.3. For
  `∞` rounds, show the last 12 dots only. Twelve dots is a shape you read in
  one glance; "7/12" is a number you have to parse, and a filling bar implies
  a race.
- **The speak button `((•))` is a 44px target at the trailing edge of the
  prompt block, top-aligned with the frame label.** It is a concentric-arc
  "sound radiating" glyph in `--sea` on a `--surface-tint` circle. Tapping it
  calls `say(q.speak)`. It is present on **every** question, always in the same
  place, so the gesture becomes automatic. When `settings.speech === 'prompt'`
  or `'both'`, it auto-fires on question entry and the button shows a filled
  state while speaking.
  - **Unlock gotcha (already noted in `speech.js`):** call `unlock()` on the
    first `pointerdown` anywhere in the app, including the boot screen tap. If
    you don't, every speech button silently does nothing and looks broken.
- **No timer element exists in this layout.** There is no clock, no ring, no
  bar that depletes. If `settings.clock > 0` (opt-in), a thin 2px line appears
  at the very top edge of the screen, full-bleed, in `--brass-mark`, and
  nothing else changes. It is deliberately the most ignorable possible
  treatment.
- **Pause `⏸`** opens a small sheet with: end round, change packs, settings.
  The back chevron leaves the round with a confirm.

### 7.2 Form: map tap (`locate`)

```
┌────────────────────────────────────────────┐
│  ‹        ▪▪▪▪▫▫▫▫▫▫▫▫              ♪  ⏸  │
│                                            │
│   WHERE IS                          ((•))  │
│   Saba                                     │
│   tap it on the map                        │ ← promptSub, Archivo 14, --ink-3
│                                            │
│  ╭──────────────────────────────────────╮  │
│  │  ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~   │  │ ← map well, --surface-sunk
│  │     ◯        ◯                       │  │   r-map 22px, inset 0
│  │          ◯                           │  │
│  │                ◯                     │  │ ← 4 candidates, ringed
│  │   ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~    │  │
│  ╰──────────────────────────────────────╯  │
│                                            │
│                              [ ⌕ ]  [ ⟲ ]  │ ← zoom out / recentre, 44px
└────────────────────────────────────────────┘
```

**Rules:**

- **The map well fills all remaining vertical space** (`flex: 1`), minimum
  `40dvh`. `MapView` already eases the viewBox to the candidates' bounding box
  over 520ms — keep that, it is correct and it is what makes the question real
  rather than a stab.

- **Tap targets must be computed in screen pixels.** `map.js` currently uses
  `r: Math.max(22, size * 0.62)` in *SVG units*. On the Caribbean map
  (w = 860) zoomed to a tight candidate box, 22 units can be over 100px; on the
  world map (w = 1150) shown unzoomed it is about 7px. That is a Fitts's law
  failure in one direction and a mis-tap generator in the other. Replace with:

  ```js
  // after setView settles, recompute hits in screen space
  unitsPerPx() { return this.view[2] / (this.host.getBoundingClientRect().width || 360); }
  // ...
  const rMin = 30 * this.unitsPerPx();          // 30px radius = 60px target
  const hit  = el('circle', { r: Math.max(rMin, size * 0.62), ... });
  ```

  and re-run the hit-layer build when the zoom animation completes. **60px
  effective target, always, at every zoom level.**

- **Candidate separation.** If any two candidates' hit circles overlap by more
  than 30% after zoom, reduce `rMin` for that question to the largest value
  that keeps overlap under 30%, floor 44px. Overlapping targets are worse than
  small ones because they make the *right* answer register as wrong.

- **Gestalt figure/ground on the map:**
  - Non-candidate land: `--land-context` fill, no stroke. It is furniture.
  - Candidate features: `--surface` fill with a 1.2px `--sea` stroke. They
    read as paper on water — the same material as the cards, which ties the
    map to the rest of the app.
  - **All four candidates are drawn identically.** Never let the correct one be
    a different size, colour or stroke. Obvious, and easy to break the moment
    you add a "highlight" for anything.
  - The ring already drawn for features under 16 units stays, restyled:
    `stroke: var(--sea)`, 1.5px, `stroke-dasharray: 3 4`, r 11, opacity 0.7.
    It is a "position circle" from chart practice and it means "this small
    thing is in play".
  - `ctx` (the surrounding-country context path, 133 KB on the Caribbean map)
    fills at `--land-context` @ 0.55 — present enough to orient, quiet enough
    not to compete.

- **Zoom controls.** Two 44px circular buttons, `--surface`, `--shadow-1`,
  bottom-trailing, floating over the map: **`⌕` zoom out to the whole map** (a
  held press, returns on release — "show me where I am") and **`⟲` recentre on
  the candidates**. Pinch-zoom and one-finger pan are enabled on the map well
  (`touch-action: none` on the SVG, manual pointer handling), but the buttons
  exist because pinch is a poor primary affordance and a discoverability
  problem.

- **No labels on the map during the question.** Labels appear only in the
  verdict (§8) and in Label the Map.

### 7.3 Form: four text options

Used by eleven of the fifteen kinds. This is the workhorse screen.

```
┌────────────────────────────────────────────┐
│  ‹        ▪▪▪▪▪▫▫▫▫▫▫▫              ♪  ⏸  │
│                                            │
│   CAPITAL OF                        ((•))  │
│   Jamaica                                  │
│                                            │
│  ╭──────────────────────────────────────╮  │
│  │  Kingston                       ((•)) │  │ ← 64px min, full width
│  ╰──────────────────────────────────────╯  │
│  ╭──────────────────────────────────────╮  │
│  │  Bridgetown                     ((•)) │  │
│  ╰──────────────────────────────────────╯  │
│  ╭──────────────────────────────────────╮  │
│  │  Port of Spain                  ((•)) │  │
│  ╰──────────────────────────────────────╯  │
│  ╭──────────────────────────────────────╮  │
│  │  Castries                       ((•)) │  │
│  ╰──────────────────────────────────────╯  │
│                                            │
└────────────────────────────────────────────┘
```

**Rules:**

- **One column, never a 2 × 2 grid.** Four full-width rows are a single
  vertical scan path — one saccade sequence, top to bottom. A 2 × 2 grid of
  *text* forces horizontal re-scanning and doubles fixations. (Flags are
  different; see §7.4 — images are recognised in parallel, text is not.)
- 64px minimum height, 12px gaps, `--r-bubble`, `--shadow-1`, no border,
  `--surface`, label in `--ink-2` Archivo 500 18px, left-padded 18px.
- **The trailing speech target.** Each option carries a 40px `((•))` glyph in a
  44 × 64 hit zone at the trailing edge, `--ink-3` at 0.5 opacity resting.
  Tapping it speaks that option and **does not answer**. To prevent mis-taps:
  - the speech zone's hit area stops 6px short of the label's right edge;
  - the option's own tap handler checks `event.target.closest('.say')` and
    returns early;
  - the option's press-scale does not fire when the speech zone is pressed —
    instead the glyph alone scales, so the feedback tells you which of the two
    controls you actually hit.
  - The glyphs render only when `settings.speech !== 'off'`. When
    `speech === 'both'`, options are also spoken in sequence after the prompt,
    and each glyph lights in turn.
- **No A/B/C/D letters, no leading icons, no numbers.** They are four more
  things to read for zero information.
- **No hover styles.** This is a phone app; hover states on touch produce
  sticky highlights after a tap.
- **Long labels:** at ≥ 26 characters drop to 16px, wrap to max 3 lines, let
  the bubble grow. `Saint Helena, Ascension and Tristan da Cunha` must fit.
- **Negation is coloured.** In `odd-one-out`, the frame reads
  `WHICH OF THESE IS NOT IN` with `NOT` in `--vermilion` Archivo 700. The same
  applies to any future negative construction. Never rely on the reader
  catching a small "not".

### 7.4 Form: four flags (`name-flag`)

```
┌────────────────────────────────────────────┐
│  ‹        ▪▪▪▪▪▪▫▫▫▫▫▫              ♪  ⏸  │
│                                            │
│   FIND THE FLAG OF                  ((•))  │
│   Saint Kitts and Nevis                    │
│                                            │
│  ╭────────────────╮  ╭────────────────╮    │
│  │ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨ │  │ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨ │    │
│  │ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨ │  │ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨ │    │  4:3, r-flag 12
│  ╰────────────────╯  ╰────────────────╯    │
│  ╭────────────────╮  ╭────────────────╮    │
│  │ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨ │  │ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨ │    │
│  │ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨ │  │ ▨▨▨▨▨▨▨▨▨▨▨▨▨▨ │    │
│  ╰────────────────╯  ╰────────────────╯    │
│                                            │
└────────────────────────────────────────────┘
```

- **2 × 2 grid here, and only here.** Images are processed in parallel; four
  flags can be compared in a single fixation when they are adjacent in both
  axes. The grid also makes each tile larger than a full-width row would allow
  vertically — at a 375px viewport each tile is ~165 × 124px, vastly over the
  Fitts minimum.
- Gap 12px. Each tile is a bubble whose *content* is the flag, 6px of paper
  visible around it, so white-fielded flags (Japan, the Nordic crosses, Cyprus)
  do not bleed into the card.
- **The one legitimate border in the app.** The flag image gets
  `box-shadow: inset 0 0 0 1px rgba(20,49,58,0.14)`. This is a *data boundary*,
  not decoration: without it, Japan's flag is a red dot floating in space and
  the answer becomes ambiguous. State this in a code comment so nobody
  "cleans it up" later.
- Flags come from `data/flags.json`; 250 items in the corpus have `fl`. Render
  as inline SVG or a data-URI `<img>` with `loading="eager"` for the four in
  play — a flag that arrives late after the user has already tapped is a
  correctness bug, not a performance one. Preload the next question's four
  during the verdict dwell.
- The **whose-flag** kind (`flag-name`) is the inverse: one large flag as the
  figure (full width, 4:3, `--r-card`, the inset hairline) with four *text*
  options below in the §7.3 single-column treatment.

### 7.5 Form: shape (`shape`)

One silhouette, drawn from the map's `d` path in its own normalised viewBox,
centred in a `--surface-sunk` well at `--r-map`, `clamp(150px, 24dvh, 220px)`
tall, filled `--ink` at 0.88 with no stroke. Below it, four text options per
§7.3. The frame reads `WHICH PROVINCE IS THIS` etc., built from `kindLabel(it)`
— the corpus already gives `x.type` per pack (`Province`, `Prefecture`,
`Canton`, `Voivodeship`, `Governorate`), and using the real word is both more
accurate and more interesting than "region".

---

## 8. The verdict moment

The hardest screen in the app, and the one with a known failure behind it:
post-answer content did not fit on a phone.

### 8.1 Structure

```
┌────────────────────────────────────────────┐
│                                            │
│   [ the question screen, still visible ]   │ ← never unmounted
│   [ map zoomed to the answer, labelled ]   │   wash veil over it
│                                            │
│  ╭──────────────────────────────────────╮  │ ← sheet, r-card 26 top only
│  │           ────                       │  │   fixed, shadow-3
│  │  ✓  Saba                             │  │ ← HEAD  (never scrolls)
│  │     the SSS Islands                  │  │
│  ├──────────────────────────────────────┤  │
│  │  A single volcano, 13 km², with  ▲   │  │ ← BODY  (scrolls inside)
│  │  the shortest commercial runway  █   │  │   max-height computed
│  │  in the world.                   ▼   │  │
│  │                                      │  │
│  │  ((•))  hear it again                │  │
│  ├──────────────────────────────────────┤  │
│  │  ╭────────────────────────────────╮  │  │ ← FOOT  (never scrolls)
│  │  │          Continue  ›           │  │  │
│  │  ╰────────────────────────────────╯  │  │
│  ╰──────────────────────────────────────╯  │
└────────────────────────────────────────────┘
```

```css
.sheet {
  position: fixed; inset: auto 0 0 0;         /* index.html already places this
                                                 outside the transformed screen
                                                 container — keep it there */
  max-height: min(58dvh, 560px);
  display: grid; grid-template-rows: auto minmax(0, 1fr) auto;
  background: var(--surface);
  border-radius: var(--r-card) var(--r-card) 0 0;
  box-shadow: var(--shadow-3);
  padding: var(--s3) var(--gutter) var(--safe-b);
}
.sheet__body { overflow-y: auto; overscroll-behavior: contain;
               -webkit-overflow-scrolling: touch; }
.sheet__foot { padding-top: var(--s3); }
```

**The three rules that make it work:**

1. **58dvh cap, contents scroll inside, Continue pinned outside the scroll.**
   `minmax(0, 1fr)` on the body row is load-bearing — without the `0`, a grid
   track will not shrink below its content and the sheet blows past its cap.
2. **The sheet must never cover the thing that answers the question.** For map
   questions, the map is the answer; 58dvh leaves 42dvh of map, and the map
   re-zooms to frame the correct feature *within that 42dvh* — pass the
   remaining height into `MapView.fit()` rather than using the host's full
   rect. For options questions the sheet may cover the options entirely, which
   is fine: the answer has moved into the sheet head.
3. **`dvh`, not `vh`.** Mobile browser chrome collapses on scroll and `vh`
   units do not follow, which is how a pinned button ends up under the
   address bar.

### 8.2 The head

- **Verdict glyph, 28px**, leading: a `✓` in `--verdigris` for right, an `✕` in
  `--vermilion` for wrong. Colour and shape both, never colour alone.
- **The answer** in Literata 700 at `clamp(1.6rem, 7vw, 2rem)` — `q.answerLabel`.
  On a miss this is *the correct answer*, not the user's wrong one. What they
  tapped is shown, smaller and struck through, only on the options surface
  behind the sheet (§9.2), never restated in the sheet. The sheet's job is to
  teach the right answer.
- **One line of context** beneath, Archivo 14px `--ink-3`: the group, the
  parent, or the sub-region — whichever is most specific and available
  (`g[0]` → `pr` → `x.sr`).
- On a miss the head gets a 3px left bar in `--vermilion` at `--r-pill`, inset
  into the sheet's padding; on a hit, `--verdigris`. Redundant with the glyph,
  which is the point.

### 8.3 The body

Populated, in this order, from what actually exists:

1. `q.explain` when the kind supplies one (`border` lists every neighbour;
   `largest` lists all four populations; group kinds supply `g.blurb`;
   `capital-of` notes multiple capitals; `currency` gives the ISO code).
2. `item.note` when present — 12 items in the corpus carry one, and they are
   the best writing in the data ("Saba: a single volcano, 13 km², with the
   shortest commercial runway in the world"). These are the moments worth
   pausing on.
3. On a miss where a confusion has now been recorded twice
   (`State.data.conf[a>b] === 2`): a single chip, `● untangle these later`,
   which is a promise, not a demand. Do not interrupt the round with a drill.
4. **A `((•))` speech row**, always last, 44px tall, Archivo 15px in `--sea`:
   reads the answer plus the body text. If `settings.speech === 'both'` it
   fires automatically on verdict entry — which is the whole reason auto-advance
   must scale with content length (§8.5).

Body prose is the Body/prose style: Literata 17px, line-height 1.65, max 60ch,
ragged right. If the body is empty (common on a straightforward hit), the body
row collapses to zero and the sheet is short — roughly 26dvh. **The sheet is
never a fixed height.** A short answer gets a short sheet.

### 8.4 The foot

One full-width `Continue ›` button, 56px, `--r-pill`, gradient
`--sea-bright → --sea-deep`, white label Archivo 600 17px, `--shadow-2`. Always
present, always in the same place, always tappable — including while an
auto-advance is pending.

On the last question of a round the label becomes `See the round ›`.

### 8.5 Pacing — the auto-advance rules

This is where the no-timer constraint has real teeth. A fixed auto-advance
delay *is* a reading-speed test, just an invisible one.

**Rule 1 — a miss never auto-advances.** Ever. A wrong answer is the moment
learning happens; it stays until the user taps Continue. No exceptions, no
setting.

**Rule 2 — a hit auto-advances only if there is little to read, and the delay
scales with how much there is.**

```js
// words = word count of everything currently rendered in the sheet head+body
const dwell = right
  ? Math.min(6000, 900 + words * 400)   // 400ms/word ≈ 150 wpm
  : Infinity;                            // a miss waits for a tap
```

400ms per word is deliberately slow — comfortable silent reading for a
non-dyslexic adult is 200–250 wpm, and 150 wpm is a fair planning figure for a
dyslexic reader on unfamiliar proper nouns. The 900ms base covers the sheet's
own rise plus recognition of the verdict glyph. The 6-second ceiling exists so
a long `border` explanation does not strand the user; past that they will tap.

Worked examples from the real corpus:

| Situation | Sheet content | words | dwell |
|---|---|---|---|
| Right, `locate` on Saba, no note shown | `Saba` / `the SSS Islands` | 4 | 2.5s |
| Right, `capital-of` Jamaica | `Kingston` / `Caribbean` | 2 | 1.7s |
| Right, `locate` on Saba **with** its note | + 14-word note | 18 | 6.0s (capped) |
| Right, `border` on Nigeria | + "Nigeria borders Benin, Cameroon, Chad, Niger." | 11 | 5.3s |
| Any miss | anything | — | waits |

**Rule 3 — speech extends the dwell.** If speech fired automatically, the dwell
is `max(dwell, speechDuration + 600ms)`, tracked via the utterance's `end`
event. Cutting off the read-aloud mid-sentence is the single most irritating
thing this app could do.

**Rule 4 — there is no countdown indicator.** No ring filling, no bar
depleting, no button that fills up. Any depiction of remaining time reinstates
exactly the pressure the constraint exists to remove. The only signal that the
app will move on is that it moves on.

**Rule 5 — a tap interrupts, and the interruption is sticky.** Any pointerdown
inside the sheet, on the wash, or on the map — anywhere other than Continue —
cancels the pending timer **and sets that verdict to manual for the rest of its
life**. It does not pause-and-resume. If the user reached out to read something,
the app must not move a second later because a timer resumed. Continue is then
the only way forward, and it is already there.

**Rule 6 — a global setting.** Settings → `Move on` → `after a pause` (default)
/ `only when I tap`. Two options, plain words, and the second one makes the
entire app manual.

### 8.6 The verdict transition, frame by frame

| t | What happens |
|---|---|
| 0 | Tap registers. Chosen element scales to .985 (90ms) |
| 0 | `sound.right()` or `sound.wrong()` fires immediately — audio is the fastest feedback channel there is |
| 0–180ms | Wash veil fades in over the whole screen: `--wash-right-veil` / `--wash-wrong-veil` |
| 0–180ms | On options: correct option's surface → `--wash-right`, 3px leading bar `--verdigris`, ✓ appears at its trailing edge. If wrong, the tapped option → `--wash-wrong`, label struck through in `--vermilion`, ✕ at trailing edge. Both states shown at once — you see what you picked *and* what was right |
| 60ms | On map: `MapView.mark(correctId, 'right')`, correct feature fills `--verdigris`; if wrong, the tapped feature fills `--vermilion`. A label appears over the correct feature |
| 60–580ms | Map re-zooms to frame the correct feature inside the remaining 42dvh (520ms, existing ease) |
| 140ms | Sheet begins its rise: `translateY(14px) → 0`, `opacity 0 → 1`, 280ms `--e-soft`. **Not a full off-screen slide** — a 100%-height slide at a believable speed takes 400ms+ and feels sluggish on the twelfth repetition |
| 420ms | Sheet settled. Auto-speech fires here if enabled |
| 420ms + dwell | Advance, if the rules allow |

Exit: sheet fades and drops 10px over 160ms; wash clears over 140ms; the next
question's content is already built and swapped under it.

---

## 9. Round summary, Atlas, Progress, Label the Map

### 9.1 Round summary

```
┌────────────────────────────────────────────┐
│                                            │
│            ╭─────────╮                     │
│            │   ◕     │   9                 │ ← big ring + big number
│            ╰─────────╯   of 12             │   Literata 700, 3.4rem
│                                            │
│   ▪▪▫▪▪▪▪▫▪▪▪▪                             │ ← the round, dot by dot
│                                            │
│   WHAT MOVED                               │
│  ╭──────────────────────────────────────╮  │
│  │  ▲ Saba            unseen → shaky    │  │ ← silhouette + the change
│  │  ▲ Nevis           shaky  → known    │  │
│  │  ▲ Anguilla        known  → known    │  │
│  ╰──────────────────────────────────────╯  │
│                                            │
│   WORTH ANOTHER LOOK                       │
│  ╭──────────────────────────────────────╮  │
│  │  ▲ Saba  ⇄  ▲ Sint Eustatius     ›   │  │ ← the confusion pair, both shapes
│  ╰──────────────────────────────────────╯  │
│                                            │
│  ╭──────────────────────────────────────╮  │
│  │          Another round  ›            │  │
│  ╰──────────────────────────────────────╯  │
│           Back to the chart                │ ← text link, --sea
└────────────────────────────────────────────┘
```

- **The score is a ring and a serif number, not a percentage and not a grade.**
  No "Great job!", no stars, no confetti. The corpus is the reward.
- **"What moved" is the honest measure** and it is why the app is worth using:
  it reports box transitions from `State`, not right/wrong. Show at most 5
  rows, prioritising items that changed state. Each row leads with **the
  item's actual silhouette** from the map data (24px, same normalisation as the
  hero) — recognition over recall, and it ties the summary to the home screen.
- **"Worth another look"** shows confusion pairs registered this round, as two
  silhouettes with a `⇄` between them. Tapping starts a two-item drill. This is
  the single most valuable screen in the app for someone who wants to actually
  learn the Leewards, and it exists because `schedule.js` already tracks
  `conf[a>b]`.
- Items animate in on a 40ms stagger. Nothing else moves. `sound.fanfare()`
  fires once on entry if sound is on.

### 9.2 Label the Map

The childhood thing — work through a region naming every feature until the map
is filled in. It gets the most screen and the least chrome.

```
┌────────────────────────────────────────────┐
│  ‹   The Caribbean            ◕ 34/88      │ ← ring + tally, Literata
│                                            │
│  ╭──────────────────────────────────────╮  │
│  │                                      │  │
│  │   Cuba        ▰▰▰                    │  │ ← named features stay inked
│  │        ▰▰  Hispaniola                │  │   with their labels
│  │   ◯        ◯     ▰ Anguilla          │  │
│  │      ◯   ◯    ◯                      │  │ ← unnamed: pale outlines
│  │            ◯       ◯                 │  │
│  │                                      │  │
│  ╰──────────────────────────────────────╯  │
│                                            │
│  ╭──────────────────────────────────────╮  │
│  │  PLACE THIS                   ((•))  │  │ ← the name to place
│  │  Montserrat                          │  │   Literata 700, 2.2rem
│  ╰──────────────────────────────────────╯  │
└────────────────────────────────────────────┘
```

- The map takes everything above the prompt bubble; the prompt bubble is
  pinned to the bottom above the safe area.
- **Named features ink in permanently** (`--land-known`) and gain a 12px
  Archivo 600 label with a 3px paper halo (`paint-order: stroke`,
  `stroke: var(--surface)`, `stroke-width: 3`) so labels survive over any fill.
  Unnamed features stay `--land-unseen` with the dashed position circle.
- A miss: the tapped feature flashes `--wash-wrong` for 400ms, the correct one
  pulses once in `--verdigris` and inks in **anyway** — you get told, and it is
  re-queued for later in the session. Never leave a feature blank as
  punishment; the goal state is a completed chart.
- The map does **not** zoom to candidates in this mode — the whole region stays
  framed, because seeing the archipelago whole is the entire point. Pinch and
  pan are available.
- On completion: the full map, every label placed, held on screen with a small
  vermilion `✕` and the date, Literata. Offer `Do it again` / `Save as image`.
  No timer, no score, no stars. **The finished chart is the reward.**
- No timer even as an option in this mode. It is explicitly the contemplative
  one.

### 9.3 Atlas — list and item card

```
 LIST                                  ITEM CARD
┌──────────────────────────┐   ┌──────────────────────────┐
│  ‹  Atlas                │   │  ‹                  ((•))│
│                          │   │                          │
│  ╭────────────────────╮  │   │   ╭──────────────────╮   │
│  │ ⌕  islands, cities…│  │   │   │       ▰▰▰        │   │ ← its shape,
│  ╰────────────────────╯  │   │   │      ▰▰▰▰▰       │   │   real path data
│                          │   │   ╰──────────────────╯   │
│  ╭────────────────────╮  │   │                          │
│  │ ▲ Saba         ◔  ›│  │   │   ISLAND · NETHERLANDS   │ ← small caps
│  │ ▲ Anguilla     ◕  ›│  │   │   Saba                   │ ← Literata 700 3rem
│  │ ▲ Nevis        ◌  ›│  │   │                          │
│  │ ▲ Montserrat   ◔  ›│  │   │  ╭────╮ ╭────╮ ╭────╮    │
│  │ ▲ Barbuda      ◕  ›│  │   │  │ ▨  │ │ ⌂  │ │ ¤  │    │ ← flag / capital /
│  ╰────────────────────╯  │   │  │ NL │ │The │ │ USD│    │   currency tiles
│                          │   │  ╰────╯ ╰Bot.╯ ╰────╯    │
│  THE LEEWARD ISLANDS     │   │                          │
│  ╭────────────────────╮  │   │  A single volcano, 13    │ ← the note, Literata
│  │ … 16 places      › │  │   │  km², with the shortest  │   17px / 1.65
│  ╰────────────────────╯  │   │  commercial runway in    │
│                          │   │  the world.              │
└──────────────────────────┘   │                          │
                               │  ╭────────────────────╮  │
                               │  │  Where it is    ›  │  │ ← opens the map,
                               │  ╰────────────────────╯  │   feature marked
                               │  ╭────────────────────╮  │
                               │  │  Drill this     ›  │  │ ← 5-question round
                               │  ╰────────────────────╯  │   on this one place
                               └──────────────────────────┘
```

**List rules:**

- Search first, always focused-but-not-keyboard-raised on entry. Matches `n`
  and `alt`. 1,742 items — search is the primary access method, browse is
  secondary.
- Rows carry the **silhouette** (24px), the name, a mastery ring, a chevron.
  Grouped into single bubbles by pack or by curated group, with a small-caps
  section label on the ground between bubbles (`--ink-2`, per §1.2 rule 2).
- The 44 curated groups get their own browsable entries — "The Leeward
  Islands", "The Grenadines", "The Four Corners" — because those are the
  things he actually wants to read, and `g.blurb` is real writing.

**Item card rules:**

- **The shape is the hero of the card**, drawn from the same normalised path
  data. If the item has no `d` path (cities, some markers), use a 1:1 map
  excerpt centred on `cx, cy` at a fixed radius instead, with a vermilion `✕`
  on the point. Never show an empty box.
- **Facts are tiles, not a table.** A row of 2–4 tiles, each 88 × 88, `--r-tile`,
  `--surface-tint`: flag, capital, currency, language, demonym, population —
  whichever exist. Each tile is glyph-on-top, value-below (Archivo 13px), label
  as small-caps beneath. A definition list of eight rows is text bloat; six
  tiles is a glance.
- **The `((•))` in the header reads the whole card**: name, kind, parent, then
  the note. This is the read-aloud path for a dyslexic reader who wants to
  *learn about* a place rather than be tested on it, and it is the reason the
  Atlas is a top-level mode rather than a sub-screen.
- Two actions at the foot, both bubbles, the first with a gradient tile.

### 9.4 Progress

```
┌────────────────────────────────────────────┐
│  ‹  Progress                               │
│                                            │
│   ▪▪▪▪▪▫▪   12 days                        │ ← last 7 days + streak number
│                                            │
│   MASTERY                                  │
│  ╭──────────────────────────────────────╮  │
│  │  ◕  The Caribbean      38%   34/88   │  │
│  │  ◔  Canada             71%    9/13   │  │
│  │  ◌  Countries          4%     8/197  │  │
│  ╰──────────────────────────────────────╯  │
│                                            │
│   WHAT KEEPS SLIPPING                      │
│  ╭──────────────────────────────────────╮  │
│  │  ▲ Saba  ⇄  ▲ St Eustatius   ×4   ›  │  │
│  │  ▲ Dominica ⇄ ▲ Dom. Rep.    ×3   ›  │  │
│  │  ▲ Niger ⇄ ▲ Nigeria         ×2   ›  │  │
│  ╰──────────────────────────────────────╯  │
│                                            │
│   BY FACET                                 │
│  ╭──────────────────────────────────────╮  │
│  │  where it is      ▰▰▰▰▰▰▰▱▱▱   68%   │  │ ← 10-cell shape bar
│  │  its flag         ▰▰▰▰▱▱▱▱▱▱   41%   │  │
│  │  its capital      ▰▰▰▰▰▰▱▱▱▱   57%   │  │
│  │  who holds it     ▰▰▱▱▱▱▱▱▱▱   22%   │  │
│  ╰──────────────────────────────────────╯  │
└────────────────────────────────────────────┘
```

- **The streak is seven marks plus a number**, not a flame and not a calendar
  grid. Seven 10 × 10 rounded squares from `State.data.day.days`: practised =
  `--verdigris` filled, not practised = `--surface-tint`. A shape you read in
  one fixation.
- **Mastery rows use `State.packMastery()`**, which counts unseen items — so
  `4% · 8/197` on world countries is the truth and not a flattering
  subset-score. Show both the ring and the fraction; the fraction is what makes
  the number trustworthy.
- **"What keeps slipping"** is `State.confusions()`, rendered as paired
  silhouettes. This is the app's best feature and it gets a real section, not a
  footnote. Tapping runs a focused A-vs-B drill and calls `clearConfusion()`
  when it is beaten twice.
- **Facet bars are ten discrete cells, not a continuous bar.** Discrete cells
  are countable at a glance and quantised, which is honest about the precision
  of the underlying estimate; a smooth bar implies a precision the Leitner box
  average does not have. `FACET_LABEL` from `schedule.js` supplies the words.
- **Day 1**: mastery section shows the active pack at 0% (an empty ring is
  fine); the confusions and facet sections do not render at all. No zeros, no
  placeholder rows, no "start playing to see your stats here" copy. The screen
  is short on day 1 and that is correct.

---

## 10. Microinteractions and feedback

Restrained. The rule is: **motion either communicates state or it does not
exist.**

| Interaction | Behaviour |
|---|---|
| Any tap | `scale(.985)` over 90ms (`.97` under 80px tall), shadow collapses to `--shadow-press`. No colour change |
| Verdict wash | Full-screen veil at 10–12% alpha in the verdict colour, 180ms in / 140ms out. Not a flash, not a full-saturation fill |
| Correct option | Surface → `--wash-right`, 3px leading bar, ✓ at trailing edge, 180ms |
| Wrong option | Tapped one → `--wash-wrong` + strike-through + ✕; correct one lights simultaneously. Both visible at once, always |
| Map mark | Fill transitions over 200ms; a single 1.06 scale pulse on the correct feature, 260ms, `transform-origin` at the feature's `cx cy` |
| Map zoom | The existing 520ms cubic ease in `map.js`. Never instant — the movement is what teaches where the place sits relative to its neighbours |
| Streak | **Audible before visible.** `sound.js` walks a pentatonic ladder up as the streak builds, which is already built and is the right primary channel. Visually: nothing during the round except the progress dots going verdigris. No combo counter, no "×3!", no escalating badges |
| Streak, home screen | The chip's number changes. That is all |
| Hero drift | ±3px, 9s, out of phase. The only infinite animation in the app |
| Hero entry | 40ms stagger, once per app open |
| Sheet rise | 14px translate + opacity, 280ms `--e-soft`, no overshoot |
| Screen change | 320ms; forward = new screen slides in 16px from trailing edge with opacity; back = the reverse. Transform on a wrapper, never on the sheet's ancestor (see the comment already in `index.html` — a transformed ancestor re-anchors `position: fixed` and parks the sheet off-screen) |
| Ring fill | 620ms `--e-out` on `stroke-dashoffset`, on screen entry only |
| Long press | 450ms, on an option: speaks it. On a pack row: opens its Atlas entry |
| Haptics | `navigator.vibrate(8)` on a miss only, if supported. Not on every tap — constant haptics are noise |

**What never animates:** question text, option labels, numbers counting up,
anything that loops other than the hero drift, page-load skeletons (the corpus
is local; there is nothing to wait for).

---

## 11. Accessibility checklist

Specific to this build. Every line is checkable.

**Structural**

- [ ] One `<h1>` per screen. The question's *subject* is the `<h1>` on a
      question screen; the frame is in an `aria-label` on the heading so a
      screen reader hears `"Where is Saba?"` as one phrase rather than two
      fragments.
- [ ] Options are `<button>` inside a `<div role="group" aria-labelledby>`
      pointing at the prompt. Not a radiogroup — there is no confirm step.
- [ ] Map candidates are `<circle role="button" tabindex="0">` with an
      `aria-label` of the place name, and they respond to Enter/Space. A
      tap-the-map question that is keyboard-unreachable is an unanswerable
      question.
- [ ] The verdict sheet is `role="dialog" aria-modal="true"`, focus moves to
      the sheet head on open, focus is trapped, and Continue is the last
      tab stop. Escape triggers Continue.
- [ ] `aria-live="assertive"` on a visually-hidden region announcing
      `"Correct. Saba."` / `"Not quite. The answer is Saba."` the instant the
      verdict lands.
- [ ] Screen changes move focus to the new screen's `<h1>`.

**Contrast and colour**

- [ ] Every text/background pair in §1.2 and §1.4 verified at ≥ 4.5 : 1 (done
      above; re-run the check if any value changes).
- [ ] Every meaningful non-text element (rings, dots, map fills, icon strokes)
      at ≥ 3 : 1 against its own background.
- [ ] **No information carried by colour alone.** Right/wrong = colour **and**
      glyph (✓ / ✕) **and** position (the sheet's leading bar). Mastery = ring
      arc length **and** colour. Status dots always sit beside a number or a
      word.
- [ ] Verified against deuteranopia and protanopia: verdigris (#0B7A5E) and
      vermilion (#C23B22) collapse toward each other for red-green colour
      blindness, which is precisely why ✓/✕ glyphs are mandatory and not
      optional polish.

**Targets and input**

- [ ] Every primary control ≥ 56 × 56 CSS px; every secondary ≥ 44 × 44 with
      ≥ 8px separation.
- [ ] Map hit radii computed in screen px, ≥ 60px effective, at every zoom
      level (§7.2).
- [ ] `touch-action: manipulation` on all controls; `user-select: none` on
      option labels so a slow tap does not start a text selection.
- [ ] Focus visible: `outline: 3px solid var(--sea); outline-offset: 3px;`
      applied via `:focus-visible` only. This is the app's second and last
      legitimate border.

**Motion, time and reading**

- [ ] `prefers-reduced-motion` honoured per §3.4.
- [ ] **No timer, no countdown, no depleting bar anywhere by default.** Grep
      the codebase for `setInterval` before shipping; the only legitimate
      timeouts are the verdict dwell and the speech-end handler.
- [ ] Auto-advance never fires on a miss, scales with word count, caps at 6s,
      waits for speech, and is cancelled permanently by any tap (§8.5).
- [ ] Every screen reachable and completable with auto-advance fully disabled.
- [ ] Line-height ≥ 1.5 on every block of more than one line; 1.65 on prose.
- [ ] No justified text, no italics for emphasis, measure ≤ 60ch.
- [ ] Respects the OS font size: `rem`-based, and the layout survives 200%
      text zoom without clipping (test the option bubbles at
      `Saint Helena, Ascension and Tristan da Cunha` at 200%).

**Speech**

- [ ] `unlock()` called on the first `pointerdown` in the session, including on
      the boot screen — without it mobile speech silently fails.
- [ ] A speech affordance is present on: every question prompt, every text
      option, the verdict body, every Atlas card, every Label-the-Map prompt.
      It is never behind a menu.
- [ ] `speechSynthesis.cancel()` on every screen change and on Continue, so
      speech never bleeds from one question into the next.
- [ ] Speech failure (no voices, blocked) hides the buttons rather than
      leaving dead controls.

**Robustness**

- [ ] `localStorage` failure (private mode) already handled in `schedule.js` —
      the UI must not assume `State` persists; no screen may hard-fail on an
      empty `State`.
- [ ] Latin-ext and vietnamese font subsets are loaded — `Đắk Nông`, `Ñuble`,
      `Curaçao`, `İğdir`, `São Tomé and Príncipe` must not render in a fallback.
- [ ] Every screen tested at 320px wide (iPhone SE) and at 430px (Pro Max).

---

## 12. What would make this feel AI-generated — and what we are doing instead

This is the section he will judge the result on. Each row is a failure mode
that a default implementation falls into, and the specific counter-decision in
this spec.

| The tell | Why it reads as generated | What we do instead |
|---|---|---|
| **Every element is a bordered box** with `1px solid #e5e7eb` and `border-radius: 8px` | It is the default of every component library and every generated layout. It produces a page of equal-weight rectangles with no hierarchy | **Zero borders.** Soft-filled paper surfaces, 18px radius, two-layer shadow. Exactly two borders exist in the whole app: the flag image hairline (a data boundary, §7.4) and the focus ring (§10). Both are documented in comments so nobody adds a third |
| **Fixing that by stripping to hairline rules**, which is what the last attempt did | Flatter *and* more text-heavy — nothing has weight, so everything has to be labelled | Filled bubbles with real elevation. Grouping by proximity and shared surface, never by dividing lines |
| **A grid of identical cards** with a title, a subtitle and an icon, all the same size | No primary action, nothing to look at first, reads as a generated CMS index | One gradient tile on the lead action, flat tinted tiles on the rest. Exactly one gradient per screen |
| **A generic icon set** — play triangle, brain, book, bar chart, trophy | Stock icons signal that nobody thought about the subject | Five icons drawn from chart furniture: dividers, contour rings, a leader line, a folded chart, a depth sounding (§5.5). They are about *this* subject |
| **A decorative hero illustration** — a globe, a stylised map, a gradient blob | Wallpaper. It does nothing and it is visibly not made of the app's content | The hero is real projected path data from the corpus, weighted by real mastery state, reshuffled per visit, tappable into the Atlas, and it doubles as the progress display (§5.3) |
| **Everything explained in a sentence** — "9 items are due for review today" | Text is the lazy default; four sentences of status is a wall | `● 9` on a chip. Status is a dot, a number and a ring. The mode list's longest support line is 34 characters |
| **A full-sentence question in one type size** — "What is the capital of Jamaica?" | Repetitive, and the only word that matters is buried in the middle | The Frame/Subject split (§2.2): `CAPITAL OF` at 11px, `Jamaica` at 3rem. The content is four times the size of the chrome |
| **Purple-to-blue gradients and a violet accent** | The 2023 generated-app palette | Chart-paper light theme, shallow-water ground, sea teal, vermilion, verdigris, brass. Gradients only on the lead action tile and the Continue button |
| **Confetti, stars, "Great job!", streak flames, badges** | Gamification bolted on top of a thing that does not need it | The round summary is a ring, a number, and what actually moved between Leitner boxes. The reward in Label the Map is the finished chart. The streak is audible (the pentatonic ladder that already exists) and seven small marks on the Progress screen |
| **A progress bar or a percentage everywhere** | Dashboard language, not content language | Dots for the round, rings for mastery, ten discrete cells for facets. Every number is Literata 700, so counts read as facts about the world rather than telemetry |
| **A fixed 2-second auto-advance** | It is a reading-speed test in disguise, which is the exact thing he banned | Dwell scales at 400ms/word from a 900ms base, caps at 6s, never fires on a miss, waits for speech, and any tap cancels it permanently (§8.5) |
| **A read-aloud button in a settings menu** | Treats accessibility as a preference rather than as the interface | A speech target on every prompt, every option, every verdict and every Atlas card, always in the same position, sized at 44px (§7.3, §8.3, §9.3) |
| **Empty-state cards with "Nothing here yet!" and a cheerful illustration** | Padding. It makes day 1 feel like a reproach | Conditional chips: a zero never renders. Day 1 shows one chip, an empty mastery ring, a pale chain and a vermilion mark on where to start. The screen is shorter on day 1 and that is the correct picture (§5.4) |
| **A sixth, seventh and eighth mode as content is added** | The menu grows until it needs a menu | Five modes, permanently. The 51 packs and 44 groups arrive *inside* Quick Play, Training, Label the Map and Atlas |
| **Uniform 16px body text everywhere** | Nothing is content, nothing is chrome, everything is grey | Two families with an explicit job each, a 3rem subject against an 11px label, and numbers in serif |

---

## 13. Implementation notes and engine asks

Small, concrete, and all of them are prerequisites for something above.

1. **`engine.js` — add `frame` and `subject`** to each kind's returned object
   (§2.2 has the table). Keep `prompt` for speech and aria. ~15 one-line edits.
2. **`engine.js` — surface `item.note`** on the question object as `q.note`
   (12 items have one, and they are the best content in the corpus) so the
   verdict body can show it without a second lookup.
3. **`map.js` — screen-space hit radii** (§7.2). Add `unitsPerPx()`, use it in
   the hit-circle build, and rebuild the hit layer when the zoom animation
   completes.
4. **`map.js` — accept a height override in `fit()`** so the verdict can frame
   the answer inside the 42dvh left above the sheet (§8.1 rule 2).
5. **`map.js` — expose a feature-extraction helper** returning
   `{ id, d, bb }` for the hero, the summary and the Atlas silhouettes. One
   function, used in four places.
6. **New `hero.js`** — the chain: selection, seeded shuffle, per-feature
   normalised SVG, mastery fill, survey line, landfall mark, drift.
7. **`app.js` — call `speech.unlock()` on the first `pointerdown`**, including
   on the boot screen.
8. **`styles.css`** — tokens in `:root`, the dark block under both
   `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])` and
   `:root[data-theme="dark"]`, then the six components in §4, then per-screen
   rules. The token block and the component block together should be under
   300 lines; if a screen needs more than 60 lines of its own, it is probably
   reaching for a seventh component and should not be.
9. **`index.html` is already correct** about the sheet living outside the
   transformed screen container. Do not move it. The comment there explains
   why, and it is the exact bug that would otherwise park the verdict sheet
   below the bottom of the phone.
10. **Ship the `.bat` launcher and a Desktop shortcut** alongside the PWA, per
    standing preference — this is a local app and it should never need a
    terminal.
