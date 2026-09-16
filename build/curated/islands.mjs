// Landfall — named islands.
//
// Natural Earth draws these islands but does not name them: `ne_10m_minor_islands`
// carries no name field at all, and an island that belongs to a country is just
// one more polygon inside that country's MultiPolygon. So the names are curated
// here and the GEOMETRY is matched to them — each entry gives a point, and the
// build claims the parent's polygon that contains (or lies nearest) it.
//
// That ordering matters: nothing here invents a coastline. A point that lands on
// no polygon, or on a polygon another island already claimed, is REPORTED AND
// DROPPED by build-data.mjs rather than quietly drawn in the wrong place. The
// island list is therefore as trustworthy as Natural Earth plus one coordinate.
//
// `group` is the island group used for the grouping questions; see groups.mjs
// for where the contested boundaries are handled.

// Islands that belong here and are NOT here, because Natural Earth does not
// draw them at 10m — not in a country's own geometry and not in the minor
// islands layer either. They are recorded rather than quietly forgotten: the
// moment a finer coastline source is added they can move up into the list, and
// until then the build stays silent instead of reporting the same seven
// failures on every run.
//
//   Petit Saint Vincent   12.545 -61.385      Palm Island (Prune)  12.583 -61.400
//   Isle à Quatre         12.955 -61.235      Young Island         13.128 -61.213
//   Petite Martinique     12.525 -61.383      Ronde Island         12.303 -61.583
//   Tobago Cays           12.628 -61.352
export const ISLANDS = [
  // ── The Bahamas ────────────────────────────────────────────────────────
  { id: 'grand-bahama', name: 'Grand Bahama', parent: 'BS', lat: 26.63, lon: -78.35 },
  { id: 'great-abaco', name: 'Great Abaco', parent: 'BS', lat: 26.35, lon: -77.10, alt: ['Abaco'] },
  { id: 'new-providence', name: 'New Providence', parent: 'BS', lat: 25.03, lon: -77.40,
    note: 'Nassau sits here — two thirds of all Bahamians live on it.' },
  { id: 'andros', name: 'Andros', parent: 'BS', lat: 24.70, lon: -77.95,
    note: 'The largest island in the Bahamas, and mostly uninhabited.' },
  { id: 'eleuthera', name: 'Eleuthera', parent: 'BS', lat: 25.15, lon: -76.13 },
  { id: 'cat-island', name: 'Cat Island', parent: 'BS', lat: 24.45, lon: -75.50 },
  { id: 'great-exuma', name: 'Great Exuma', parent: 'BS', lat: 23.52, lon: -75.83, alt: ['Exuma'] },
  { id: 'long-island-bs', name: 'Long Island', parent: 'BS', lat: 23.25, lon: -75.13 },
  { id: 'san-salvador', name: 'San Salvador', parent: 'BS', lat: 24.05, lon: -74.50,
    note: 'Long identified as Columbus’s first landfall in the Americas, though the claim is contested.' },
  { id: 'crooked-island', name: 'Crooked Island', parent: 'BS', lat: 22.75, lon: -74.22 },
  { id: 'acklins', name: 'Acklins', parent: 'BS', lat: 22.42, lon: -74.00 },
  { id: 'mayaguana', name: 'Mayaguana', parent: 'BS', lat: 22.38, lon: -73.00 },
  { id: 'great-inagua', name: 'Great Inagua', parent: 'BS', lat: 21.07, lon: -73.32 },
  { id: 'rum-cay', name: 'Rum Cay', parent: 'BS', lat: 23.68, lon: -74.85 },

  // ── Turks and Caicos ───────────────────────────────────────────────────
  { id: 'providenciales', name: 'Providenciales', parent: 'TC', lat: 21.79, lon: -72.28 },
  { id: 'grand-turk', name: 'Grand Turk', parent: 'TC', lat: 21.47, lon: -71.14,
    note: 'The seat of government, though Providenciales holds most of the population.' },
  { id: 'north-caicos', name: 'North Caicos', parent: 'TC', lat: 21.93, lon: -71.94 },
  { id: 'middle-caicos', name: 'Middle Caicos', parent: 'TC', lat: 21.80, lon: -71.72 },
  { id: 'south-caicos', name: 'South Caicos', parent: 'TC', lat: 21.50, lon: -71.53 },

  // ── Cayman Islands ─────────────────────────────────────────────────────
  { id: 'grand-cayman', name: 'Grand Cayman', parent: 'KY', lat: 19.32, lon: -81.24 },
  { id: 'cayman-brac', name: 'Cayman Brac', parent: 'KY', lat: 19.72, lon: -79.82 },
  { id: 'little-cayman', name: 'Little Cayman', parent: 'KY', lat: 19.68, lon: -80.05 },

  // ── Greater Antilles outliers ──────────────────────────────────────────
  { id: 'isla-juventud', name: 'Isla de la Juventud', parent: 'CU', lat: 21.70, lon: -82.82,
    alt: ['Isle of Youth', 'Isle of Pines'] },
  { id: 'gonave', name: 'Île de la Gonâve', parent: 'HT', lat: 18.84, lon: -73.05 },
  { id: 'tortue', name: 'Île de la Tortue', parent: 'HT', lat: 20.05, lon: -72.80, alt: ['Tortuga'] },
  { id: 'saona', name: 'Isla Saona', parent: 'DO', lat: 18.15, lon: -68.70 },

  // ── Puerto Rico and the Virgins ────────────────────────────────────────
  { id: 'vieques', name: 'Vieques', parent: 'PR', lat: 18.12, lon: -65.43 },
  { id: 'culebra', name: 'Culebra', parent: 'PR', lat: 18.32, lon: -65.28 },
  { id: 'mona', name: 'Mona', parent: 'PR', lat: 18.08, lon: -67.89, alt: ['Isla de Mona'] },
  { id: 'st-thomas', name: 'Saint Thomas', parent: 'VI', lat: 18.34, lon: -64.93 },
  { id: 'st-john', name: 'Saint John', parent: 'VI', lat: 18.33, lon: -64.73 },
  { id: 'st-croix', name: 'Saint Croix', parent: 'VI', lat: 17.73, lon: -64.78 },
  { id: 'tortola', name: 'Tortola', parent: 'VG', lat: 18.43, lon: -64.62 },
  { id: 'virgin-gorda', name: 'Virgin Gorda', parent: 'VG', lat: 18.48, lon: -64.43 },
  { id: 'anegada', name: 'Anegada', parent: 'VG', lat: 18.73, lon: -64.33,
    note: 'The only coral island in the Virgins — flat, where the rest are volcanic peaks.' },
  { id: 'jost-van-dyke', name: 'Jost Van Dyke', parent: 'VG', lat: 18.45, lon: -64.75 },

  // ── Leewards ───────────────────────────────────────────────────────────
  { id: 'st-kitts', name: 'Saint Kitts', parent: 'KN', lat: 17.33, lon: -62.75, alt: ['St Christopher'] },
  { id: 'nevis', name: 'Nevis', parent: 'KN', lat: 17.15, lon: -62.58 },
  { id: 'saba', name: 'Saba', parent: 'BQ', lat: 17.63, lon: -63.24,
    note: 'A single volcano, 13 km², with the shortest commercial runway in the world.' },
  { id: 'sint-eustatius', name: 'Sint Eustatius', parent: 'BQ', lat: 17.49, lon: -62.98,
    alt: ['Statia'], note: 'The first foreign port to salute the flag of the United States, in 1776.' },
  { id: 'antigua', name: 'Antigua', parent: 'AG', lat: 17.07, lon: -61.80 },
  { id: 'barbuda', name: 'Barbuda', parent: 'AG', lat: 17.63, lon: -61.79 },
  { id: 'basse-terre-island', name: 'Basse-Terre', parent: 'GP', lat: 16.15, lon: -61.72,
    note: 'The volcanic western wing of Guadeloupe’s butterfly.' },
  { id: 'grande-terre', name: 'Grande-Terre', parent: 'GP', lat: 16.30, lon: -61.42,
    note: 'The flat limestone eastern wing, separated from Basse-Terre by the Rivière Salée.' },
  { id: 'marie-galante', name: 'Marie-Galante', parent: 'GP', lat: 15.93, lon: -61.27 },
  { id: 'la-desirade', name: 'La Désirade', parent: 'GP', lat: 16.32, lon: -61.05 },
  { id: 'terre-de-haut', name: 'Terre-de-Haut', parent: 'GP', lat: 15.866, lon: -61.583,
    alt: ['Les Saintes'], note: 'The inhabited half of Les Saintes, in a bay often called one of the finest in the world.' },
  { id: 'terre-de-bas', name: 'Terre-de-Bas', parent: 'GP', lat: 15.855, lon: -61.640 },
  { id: 'redonda', name: 'Redonda', parent: 'AG', lat: 16.938, lon: -62.346,
    note: 'The third island of Antigua and Barbuda: an uninhabited rock with a literary "kingdom" attached to it.' },

  // ── Windwards and the Grenadines ───────────────────────────────────────
  { id: 'st-vincent-island', name: 'Saint Vincent', parent: 'VC', lat: 13.25, lon: -61.20 },
  { id: 'bequia', name: 'Bequia', parent: 'VC', lat: 13.01, lon: -61.24,
    note: 'The largest of the Grenadines, and one of the last places with an aboriginal whaling quota.' },
  { id: 'mustique', name: 'Mustique', parent: 'VC', lat: 12.88, lon: -61.19 },
  { id: 'canouan', name: 'Canouan', parent: 'VC', lat: 12.70, lon: -61.33 },
  { id: 'union-island', name: 'Union Island', parent: 'VC', lat: 12.60, lon: -61.43 },
  { id: 'mayreau', name: 'Mayreau', parent: 'VC', lat: 12.638, lon: -61.393 },
  { id: 'grenada-island', name: 'Grenada', parent: 'GD', lat: 12.117, lon: -61.678,
    note: 'The main island — Carriacou and Petite Martinique are the other two.' },
  { id: 'carriacou', name: 'Carriacou', parent: 'GD', lat: 12.48, lon: -61.45 },
  { id: 'trinidad', name: 'Trinidad', parent: 'TT', lat: 10.45, lon: -61.30 },
  { id: 'tobago', name: 'Tobago', parent: 'TT', lat: 11.25, lon: -60.68 },

  // ── Leeward Antilles (the southern shelf) ──────────────────────────────
  { id: 'bonaire', name: 'Bonaire', parent: 'BQ', lat: 12.18, lon: -68.28 },
  { id: 'margarita', name: 'Isla de Margarita', parent: 'VE', lat: 11.00, lon: -64.00 },

  // ── The western Caribbean ──────────────────────────────────────────────
  { id: 'cozumel', name: 'Cozumel', parent: 'MX', lat: 20.45, lon: -86.92 },
  { id: 'roatan', name: 'Roatán', parent: 'HN', lat: 16.35, lon: -86.45,
    note: 'The largest of the Bay Islands — English-speaking, and Honduran only since 1861.' },
  { id: 'san-andres', name: 'San Andrés', parent: 'CO', lat: 12.55, lon: -81.71,
    alt: ['Isla de San Andrés'],
    note: 'Colombian, but 750 km from Colombia and 230 km from Nicaragua — the subject of a 2012 ICJ ruling.' },
  { id: 'providencia', name: 'Providencia', parent: 'CO', lat: 13.35, lon: -81.37, alt: ['Isla de Providencia', 'Old Providence'] },
];
