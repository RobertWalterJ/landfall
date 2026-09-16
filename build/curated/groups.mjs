// Landfall — the groupings geography is actually taught in.
//
// No dataset contains "the Leeward Islands". These are the names people learn
// places BY, and they are what turns a list of islands into a mental map, so
// they are curated here and drive the grouping questions.
//
// The important discipline is `contested`. Several of these boundaries are
// genuinely disputed — Dominica is Leeward in the old British administrative
// sense and Windward in modern geographic usage; Barbados is grouped with the
// Windwards politically but sits well east of the arc; Finland is Nordic but
// not Scandinavian. Those members are listed but NEVER used as the answer to a
// membership question, in either direction. They appear in the Atlas with the
// argument attached, which is the part worth knowing.
//
// Member ids: c:XX country or territory (ISO 3166-1 alpha-2)
//             i:xxx curated island (islands.mjs)
//             a:XX-YY sub-national unit (ISO 3166-2)

export const GROUPS = [
  // ── Caribbean ──────────────────────────────────────────────────────────
  {
    id: 'greater-antilles', name: 'The Greater Antilles', scope: 'caribbean',
    blurb: 'The four large islands of the northern Caribbean — around 90% of the land area of the whole West Indies.',
    members: ['c:CU', 'c:JM', 'c:HT', 'c:DO', 'c:PR'],
    contested: ['c:KY'],
    note: 'Hispaniola is one island holding two countries, Haiti and the Dominican Republic. The Cayman Islands are sometimes counted in and sometimes not.',
  },
  {
    id: 'lesser-antilles', name: 'The Lesser Antilles', scope: 'caribbean',
    blurb: 'The long arc from the Virgin Islands south to Trinidad, plus the islands along the Venezuelan coast.',
    members: ['c:VG', 'c:VI', 'c:AI', 'c:MF', 'c:SX', 'c:BL', 'c:KN', 'c:AG', 'c:MS', 'c:GP',
      'c:DM', 'c:MQ', 'c:LC', 'c:VC', 'c:GD', 'c:BB', 'c:TT', 'c:AW', 'c:CW', 'c:BQ'],
    // The arc reads north to south: the Leewards from the Virgins to Guadeloupe,
    // then the Windwards from Dominica to Grenada, with Barbados out to the east.
  },
  {
    id: 'leeward-islands', name: 'The Leeward Islands', scope: 'caribbean',
    blurb: 'The northern half of the Lesser Antilles arc, from the Virgin Islands down to Guadeloupe.',
    members: ['c:VG', 'c:VI', 'c:AI', 'c:MF', 'c:SX', 'c:BL', 'i:saba', 'i:sint-eustatius',
      'i:st-kitts', 'i:nevis', 'i:antigua', 'i:barbuda', 'i:redonda', 'c:MS',
      'i:basse-terre-island', 'i:grande-terre', 'i:marie-galante', 'i:la-desirade',
      'i:terre-de-haut', 'i:terre-de-bas'],
    contested: ['c:DM'],
    note: 'The name is from sailing: the Leewards lie downwind of the Windwards on the prevailing north-easterly trade wind. Dominica is the sore point — the old British colony of the Leeward Islands ran down to include it, but modern geographic usage puts it in the Windwards.',
  },
  {
    id: 'windward-islands', name: 'The Windward Islands', scope: 'caribbean',
    blurb: 'The southern half of the arc, taking the trade wind first.',
    members: ['c:MQ', 'c:LC', 'i:st-vincent-island', 'i:grenada-island'],
    contested: ['c:DM', 'c:BB', 'c:TT'],
    note: 'Barbados is grouped with the Windwards in colonial and cricketing usage but lies about 150 km east of the arc, on its own shelf.',
  },
  {
    id: 'grenadines', name: 'The Grenadines', scope: 'caribbean',
    blurb: 'The chain of small islands strung between Saint Vincent and Grenada, split between the two countries.',
    members: ['i:bequia', 'i:mustique', 'i:canouan', 'i:mayreau', 'i:union-island', 'i:carriacou'],
    note: 'Carriacou and Petite Martinique belong to Grenada; everything north of them to Saint Vincent. Petite Martinique, Palm Island, Petit Saint Vincent and the Tobago Cays are all real and all absent here — Natural Earth does not draw them at any resolution.',
  },
  {
    id: 'lucayan', name: 'The Lucayan Archipelago', scope: 'caribbean',
    blurb: 'The Bahamas and the Turks and Caicos — the same limestone bank, two jurisdictions, and not in the Caribbean Sea at all.',
    members: ['c:BS', 'c:TC'],
    note: 'They sit in the Atlantic north of Cuba. Calling them Caribbean is cultural rather than oceanographic.',
  },
  {
    id: 'abc-islands', name: 'The ABC Islands', scope: 'caribbean',
    blurb: 'Aruba, Bonaire and Curaçao, off the Venezuelan coast — Dutch, dry, and outside the hurricane belt.',
    members: ['c:AW', 'i:bonaire', 'c:CW'],
  },
  {
    id: 'sss-islands', name: 'The SSS Islands', scope: 'caribbean',
    blurb: 'Saba, Sint Eustatius and Sint Maarten — the Dutch islands 900 km north of the ABCs.',
    members: ['i:saba', 'i:sint-eustatius', 'c:SX'],
  },
  {
    id: 'virgin-islands', name: 'The Virgin Islands', scope: 'caribbean',
    blurb: 'One archipelago under three flags: British, American, and the Spanish Virgins that belong to Puerto Rico.',
    members: ['i:tortola', 'i:virgin-gorda', 'i:anegada', 'i:jost-van-dyke',
      'i:st-thomas', 'i:st-john', 'i:st-croix', 'i:vieques', 'i:culebra'],
  },
  {
    id: 'leeward-antilles', name: 'The Leeward Antilles', scope: 'caribbean',
    blurb: 'The chain along the South American shelf — continental islands, not part of the volcanic arc.',
    members: ['c:AW', 'i:bonaire', 'c:CW', 'i:margarita'],
  },

  // ── Europe ─────────────────────────────────────────────────────────────
  {
    id: 'nordic', name: 'The Nordic countries', scope: 'world',
    blurb: 'Denmark, Norway, Sweden, Finland and Iceland, with the Faroes, Greenland and Åland.',
    members: ['c:DK', 'c:NO', 'c:SE', 'c:FI', 'c:IS', 'c:FO', 'c:GL', 'c:AX'],
    note: 'Not the same as Scandinavia: Finland is Nordic but not Scandinavian, and Iceland only arguably so.',
  },
  {
    id: 'scandinavia', name: 'Scandinavia', scope: 'world',
    blurb: 'Strictly the peninsula and Denmark — Norway, Sweden and Denmark.',
    members: ['c:NO', 'c:SE', 'c:DK'],
    contested: ['c:FI', 'c:IS'],
  },
  {
    id: 'baltic-states', name: 'The Baltic states', scope: 'world',
    blurb: 'Estonia, Latvia and Lithuania.',
    members: ['c:EE', 'c:LV', 'c:LT'],
  },
  {
    id: 'benelux', name: 'The Low Countries', scope: 'world',
    blurb: 'Belgium, the Netherlands and Luxembourg.',
    members: ['c:BE', 'c:NL', 'c:LU'],
  },
  {
    id: 'iberia', name: 'Iberia', scope: 'world',
    blurb: 'The peninsula: Spain, Portugal, Andorra and Gibraltar.',
    members: ['c:ES', 'c:PT', 'c:AD', 'c:GI'],
  },
  {
    id: 'balkans', name: 'The Balkans', scope: 'world',
    blurb: 'The peninsula between the Adriatic and the Black Sea.',
    members: ['c:AL', 'c:BA', 'c:BG', 'c:HR', 'c:GR', 'c:XK', 'c:ME', 'c:MK', 'c:RS'],
    contested: ['c:SI', 'c:RO', 'c:TR'],
    note: 'Slovenia, Romania and the European sliver of Türkiye are in or out depending on whether the definition is physical, historical or political.',
  },
  {
    id: 'british-isles', name: 'The British Isles', scope: 'world',
    blurb: 'The archipelago: Great Britain, Ireland and the surrounding islands.',
    members: ['c:GB', 'c:IE', 'c:IM', 'c:JE', 'c:GG'],
    note: 'The term is disputed in Ireland; "Britain and Ireland" or "these islands" is the usual alternative.',
  },
  {
    id: 'visegrad', name: 'The Visegrád Group', scope: 'world',
    blurb: 'Poland, Czechia, Slovakia and Hungary.',
    members: ['c:PL', 'c:CZ', 'c:SK', 'c:HU'],
  },
  {
    id: 'caucasus', name: 'The Caucasus', scope: 'world',
    blurb: 'Georgia, Armenia and Azerbaijan, between the Black Sea and the Caspian.',
    members: ['c:GE', 'c:AM', 'c:AZ'],
  },

  // ── Africa ─────────────────────────────────────────────────────────────
  {
    id: 'maghreb', name: 'The Maghreb', scope: 'world',
    blurb: 'North-west Africa: Morocco, Algeria, Tunisia, Libya and Mauritania.',
    members: ['c:MA', 'c:DZ', 'c:TN', 'c:LY', 'c:MR', 'c:EH'],
  },
  {
    id: 'sahel', name: 'The Sahel', scope: 'world',
    blurb: 'The belt between the Sahara and the savanna, west to east.',
    members: ['c:SN', 'c:ML', 'c:BF', 'c:NE', 'c:TD', 'c:SD', 'c:ER', 'c:MR', 'c:NG'],
    contested: ['c:GM', 'c:SS'],
  },
  {
    id: 'horn-of-africa', name: 'The Horn of Africa', scope: 'world',
    blurb: 'Somalia, Ethiopia, Eritrea and Djibouti.',
    members: ['c:SO', 'c:ET', 'c:ER', 'c:DJ'],
  },
  {
    id: 'east-african-community', name: 'The African Great Lakes', scope: 'world',
    blurb: 'The states around Victoria, Tanganyika and the western rift.',
    members: ['c:UG', 'c:KE', 'c:TZ', 'c:RW', 'c:BI', 'c:CD', 'c:MW', 'c:ZM'],
  },
  {
    id: 'southern-africa', name: 'Southern Africa', scope: 'world',
    blurb: 'The states south of the Congo and Zambezi basins.',
    members: ['c:ZA', 'c:NA', 'c:BW', 'c:ZW', 'c:MZ', 'c:LS', 'c:SZ'],
  },

  // ── Asia and the Pacific ───────────────────────────────────────────────
  {
    id: 'central-asia', name: 'Central Asia', scope: 'world',
    blurb: 'The five former Soviet republics between the Caspian and China.',
    members: ['c:KZ', 'c:UZ', 'c:TM', 'c:KG', 'c:TJ'],
  },
  {
    id: 'levant', name: 'The Levant', scope: 'world',
    blurb: 'The eastern Mediterranean seaboard.',
    members: ['c:LB', 'c:SY', 'c:JO', 'c:IL', 'c:PS'],
    contested: ['c:CY', 'c:TR'],
  },
  {
    id: 'gulf-states', name: 'The Gulf states', scope: 'world',
    blurb: 'The six members of the Gulf Cooperation Council.',
    members: ['c:SA', 'c:AE', 'c:QA', 'c:KW', 'c:BH', 'c:OM'],
  },
  {
    id: 'indochina', name: 'Mainland Southeast Asia', scope: 'world',
    blurb: 'The peninsula: Myanmar, Thailand, Laos, Cambodia, Vietnam and peninsular Malaysia.',
    members: ['c:MM', 'c:TH', 'c:LA', 'c:KH', 'c:VN', 'c:MY'],
  },
  {
    id: 'melanesia', name: 'Melanesia', scope: 'world',
    blurb: 'The "black islands" of the south-west Pacific.',
    members: ['c:PG', 'c:SB', 'c:VU', 'c:FJ', 'c:NC'],
  },
  {
    id: 'polynesia', name: 'Polynesia', scope: 'world',
    blurb: 'The great triangle — Hawaii, New Zealand and Easter Island at its corners.',
    members: ['c:WS', 'c:TO', 'c:TV', 'c:PF', 'c:CK', 'c:NU', 'c:TK', 'c:WF', 'c:AS', 'c:PN'],
    contested: ['c:NZ'],
  },
  {
    id: 'micronesia', name: 'Micronesia', scope: 'world',
    blurb: 'The "small islands" north of the equator in the western Pacific.',
    members: ['c:FM', 'c:MH', 'c:PW', 'c:KI', 'c:NR', 'c:GU', 'c:MP'],
  },
  {
    id: 'greater-sunda', name: 'The Greater Sunda Islands', scope: 'world',
    blurb: 'Borneo, Sumatra, Java and Sulawesi.',
    members: ['c:ID', 'c:MY', 'c:BN'],
    note: 'Borneo alone is divided between three countries — Indonesia, Malaysia and Brunei.',
  },

  // ── The Americas ───────────────────────────────────────────────────────
  {
    id: 'central-america', name: 'Central America', scope: 'world',
    blurb: 'The seven states of the isthmus.',
    members: ['c:GT', 'c:BZ', 'c:SV', 'c:HN', 'c:NI', 'c:CR', 'c:PA'],
    contested: ['c:MX'],
  },
  {
    id: 'southern-cone', name: 'The Southern Cone', scope: 'world',
    blurb: 'Argentina, Chile and Uruguay, with Paraguay and southern Brazil sometimes added.',
    members: ['c:AR', 'c:CL', 'c:UY'],
    contested: ['c:PY', 'c:BR'],
  },
  {
    id: 'andean', name: 'The Andean states', scope: 'world',
    blurb: 'The countries the cordillera runs through.',
    members: ['c:CO', 'c:EC', 'c:PE', 'c:BO', 'c:CL', 'c:VE', 'c:AR'],
  },
  {
    id: 'guianas', name: 'The Guianas', scope: 'world',
    blurb: 'Guyana, Suriname and French Guiana — the only part of South America that is not Spanish- or Portuguese-speaking.',
    members: ['c:GY', 'c:SR', 'c:GF'],
  },

  // ── Canada ─────────────────────────────────────────────────────────────
  {
    id: 'maritimes', name: 'The Maritimes', scope: 'canada',
    blurb: 'Nova Scotia, New Brunswick and Prince Edward Island.',
    members: ['a:CA-NS', 'a:CA-NB', 'a:CA-PE'],
    note: 'Add Newfoundland and Labrador and it becomes Atlantic Canada — the distinction is the common trap.',
  },
  {
    id: 'atlantic-canada', name: 'Atlantic Canada', scope: 'canada',
    blurb: 'The Maritimes plus Newfoundland and Labrador.',
    members: ['a:CA-NS', 'a:CA-NB', 'a:CA-PE', 'a:CA-NL'],
  },
  {
    id: 'prairies', name: 'The Prairie provinces', scope: 'canada',
    blurb: 'Manitoba, Saskatchewan and Alberta.',
    members: ['a:CA-MB', 'a:CA-SK', 'a:CA-AB'],
  },
  {
    id: 'canadian-north', name: 'The territorial North', scope: 'canada',
    blurb: 'Yukon, the Northwest Territories and Nunavut — 40% of Canada’s area, 0.3% of its people.',
    members: ['a:CA-YT', 'a:CA-NT', 'a:CA-NU'],
  },

  // ── United States ──────────────────────────────────────────────────────
  {
    id: 'new-england', name: 'New England', scope: 'usa',
    blurb: 'Maine, New Hampshire, Vermont, Massachusetts, Rhode Island and Connecticut.',
    members: ['a:US-ME', 'a:US-NH', 'a:US-VT', 'a:US-MA', 'a:US-RI', 'a:US-CT'],
  },
  {
    id: 'four-corners', name: 'The Four Corners', scope: 'usa',
    blurb: 'The only point in the United States where four states meet.',
    members: ['a:US-UT', 'a:US-CO', 'a:US-AZ', 'a:US-NM'],
  },
  {
    id: 'pacific-northwest', name: 'The Pacific Northwest', scope: 'usa',
    blurb: 'Washington, Oregon and Idaho — and British Columbia, if you are drawing Cascadia.',
    members: ['a:US-WA', 'a:US-OR', 'a:US-ID'],
    contested: ['a:CA-BC', 'a:US-AK'],
  },
  {
    id: 'great-lakes-states', name: 'The Great Lakes states', scope: 'usa',
    blurb: 'The eight states touching the lakes.',
    members: ['a:US-MN', 'a:US-WI', 'a:US-IL', 'a:US-IN', 'a:US-MI', 'a:US-OH', 'a:US-PA', 'a:US-NY'],
  },
];
