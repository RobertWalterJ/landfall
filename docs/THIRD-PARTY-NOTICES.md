# Sources, and what their licences require

Landfall is built from open data. Three of the four sources ask for something in
return, and this file is where that is given. `app/data/core.json` is a derived
database built from all of them; `docs/` is the published copy.

## Natural Earth — public domain

Coastlines, country and admin-1 boundaries, map subunits, populated places and
minor islands, all at 1:10m. <https://www.naturalearthdata.com>

Natural Earth is in the public domain and asks for no attribution. It is
credited anyway, in the app and here, because knowing where a shape came from
is part of knowing whether to trust it.

## mledoze/world-countries — ODbL 1.0

Capitals, borders, currencies, languages, demonyms, areas and populations for
sovereign states. <https://github.com/mledoze/countries>

**This is a share-alike licence, and it reaches the output.** `core.json`
embeds those fields, which makes it a Derivative Database under ODbL §4.4, and
it is publicly distributed. So:

- **`app/data/core.json` and `docs/data/core.json` are offered under the Open
  Database License 1.0.** <https://opendatacommons.org/licenses/odbl/1-0/>
- Any Produced Work from that database — the app's screens, a printed chart —
  carries the notice required by ODbL §4.3: *Contains information from
  mledoze/world-countries, which is made available under the ODbL.*

The application code in `app/js/`, `build/` and `app/styles.css` is not part of
that database and is covered by `LICENSE`.

## flag-icons — MIT

The country flag SVGs, which ship inlined in `app/data/flags.json`.
<https://github.com/lipis/flag-icons>

MIT requires its copyright notice to travel with substantial portions of the
work, and the flags are deployed, so the notice is reproduced in full:

```
MIT License

Copyright (c) 2013 Panayiotis Lipiridis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Wikidata and Wikimedia Commons — CC0, and per-file for the flags

Island capitals, areas, populations and alternative names come from Wikidata
(`build/harvest-islands.mjs`), which is CC0 — no conditions.

The eight island flags in `sources/island-flags/` come from Wikimedia Commons
(`build/fetch-island-flags.mjs`): Nevis, Barbuda, Saba, Sint Eustatius,
Bonaire, Bequia, Vieques and Culebra. Flags on Commons are usually public
domain, but not uniformly, and **the fetch does not currently record each
file's licence.** Until it does, treat those eight as unverified: they are
fine for private use, and anyone redistributing this should check each file's
Commons page. `build/fetch-island-flags.mjs` should ask the API for
`extmetadata` and write the licence alongside the SVG.

Tobago and Carriacou both fly a flag and both are deliberately absent, because
no verifiable SVG was found and guessing at one teaches the wrong flag.
