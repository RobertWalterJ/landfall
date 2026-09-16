// Landfall — what the corpus is made of.
//
// Everything here is a CHOICE, not data: which sub-national level a country is
// actually known by, what a unit should be called in English, which regions
// deserve their own map. The facts themselves come from Natural Earth and
// world-countries; this file only says what to ask about.
//
// The rule for sub-national packs: use the level people learn. Natural Earth's
// admin-1 is the right level for Canada, China and the United States, but for
// Italy, Spain, France and the UK it is one level too fine (provinces,
// departments, districts), so those aggregate up via the `region` field or come
// from admin-0 map subunits instead.

// Country packs are cut from world-countries' own region / subregion fields.
export const COUNTRY_PACKS = [
  {
    id: 'countries-world', name: 'Countries of the world', short: 'World',
    blurb: 'Every sovereign state — 195 of them — with flags, capitals and where they sit.',
    map: 'world', tier: 1,
    filter: (c) => c.sovereign,
  },
  {
    id: 'countries-africa', name: 'African countries', short: 'Africa',
    blurb: 'All 54, from the Maghreb to the Cape — the set most people can name fewest of.',
    map: 'africa', tier: 1,
    filter: (c) => c.sovereign && c.region === 'Africa',
  },
  {
    id: 'countries-europe', name: 'European countries', short: 'Europe',
    blurb: 'Including the microstates and every post-Yugoslav border.',
    map: 'europe', tier: 1,
    filter: (c) => c.sovereign && c.region === 'Europe',
  },
  {
    id: 'countries-asia', name: 'Asian countries', short: 'Asia',
    blurb: 'Central, East, South and Southeast Asia, plus the Gulf.',
    map: 'asia', tier: 1,
    filter: (c) => c.sovereign && c.region === 'Asia',
  },
  {
    id: 'countries-south-america', name: 'South American countries', short: 'South America',
    blurb: 'Twelve sovereign states and one French department.',
    map: 'south-america', tier: 1,
    filter: (c) => c.sovereign && c.subregion === 'South America',
  },
  {
    id: 'countries-central-america', name: 'Central America & Mexico', short: 'Central America',
    blurb: 'The isthmus, north to south.',
    map: 'central-america', tier: 1,
    filter: (c) => c.sovereign && (c.subregion === 'Central America' || c.cca2 === 'MX'),
  },
  {
    id: 'countries-oceania', name: 'Pacific countries', short: 'Oceania',
    blurb: 'Melanesia, Micronesia and Polynesia — the hardest set on Earth.',
    map: 'oceania', tier: 2,
    filter: (c) => c.sovereign && c.region === 'Oceania',
  },
  {
    id: 'countries-middle-east', name: 'The Middle East', short: 'Middle East',
    blurb: 'Western Asia plus Egypt, as the region is normally drawn.',
    map: 'middle-east', tier: 2,
    filter: (c) => c.sovereign && (c.subregion === 'Western Asia' || c.cca2 === 'EG' || c.cca2 === 'IR'),
  },
  {
    id: 'territories', name: 'Territories & dependencies', short: 'Territories',
    blurb: 'The overseas remainder — from Greenland to Pitcairn. Who holds what.',
    map: 'world', tier: 3,
    filter: (c) => !c.sovereign && c.subregion !== 'Caribbean',
  },
];

// The Caribbean gets its own treatment: the islands are the point, not the
// states, so the pack is built from map SUBUNITS (which separate Guadeloupe,
// Martinique, Tobago and Barbuda) plus the curated island layer.
export const CARIBBEAN = {
  id: 'caribbean', name: 'The Caribbean', short: 'Caribbean',
  blurb: 'Every island that carries a name — Greater Antilles, Leewards, Windwards, the Bahamas and the ABCs.',
  map: 'caribbean', tier: 1,
};

// Sub-national packs. `source` says where the units come from:
//   admin1   Natural Earth admin-1, used as-is
//   region   Natural Earth admin-1 aggregated up by its `region` field
//   subunit  admin-0 map subunits (the United Kingdom's four countries)
export const ADMIN_PACKS = [
  { id: 'canada', admin: 'Canada', name: 'Canadian provinces & territories', short: 'Canada',
    unit: 'province or territory', map: 'canada', tier: 1, source: 'admin1',
    blurb: 'Thirteen units, ten capitals you should know cold and three you probably do not.' },
  { id: 'usa', admin: 'United States of America', name: 'US states', short: 'US states',
    unit: 'state', map: 'usa', tier: 1, source: 'admin1',
    blurb: 'Fifty states, the District, and the capitals that are never the biggest city.' },
  { id: 'china', admin: 'China', name: 'Chinese provinces', short: 'China',
    unit: 'province-level division', map: 'china', tier: 1, source: 'admin1',
    extraCountries: ['HK', 'MO'], drop: ['Paracel Islands'],
    blurb: 'Twenty-two provinces, five autonomous regions, four municipalities and two SARs.' },
  { id: 'mexico', admin: 'Mexico', name: 'Mexican states', short: 'Mexico',
    unit: 'state', map: 'mexico', tier: 2, source: 'admin1', blurb: 'Thirty-two states, coast to coast.' },
  { id: 'brazil', admin: 'Brazil', name: 'Brazilian states', short: 'Brazil',
    unit: 'state', map: 'brazil', tier: 2, source: 'admin1', blurb: 'Twenty-six states and the Federal District.' },
  { id: 'india', admin: 'India', name: 'Indian states', short: 'India',
    unit: 'state or union territory', map: 'india', tier: 2, source: 'admin1', blurb: 'States and union territories.' },
  { id: 'japan', admin: 'Japan', name: 'Japanese prefectures', short: 'Japan',
    unit: 'prefecture', map: 'japan', tier: 2, source: 'admin1', blurb: 'Forty-seven prefectures, Hokkaido to Okinawa.' },
  { id: 'australia', admin: 'Australia', name: 'Australian states', short: 'Australia',
    unit: 'state or territory', map: 'australia', tier: 1, source: 'admin1',
    drop: ['Jervis Bay Territory', 'Macquarie Island', 'Lord Howe Island', 'Coral Sea Islands', 'Ashmore and Cartier Islands'],
    blurb: 'Six states and two mainland territories.' },
  { id: 'germany', admin: 'Germany', name: 'German states', short: 'Germany',
    unit: 'Land', map: 'germany', tier: 2, source: 'admin1', blurb: 'The sixteen Bundesländer.' },
  { id: 'russia', admin: 'Russia', name: 'Russian federal subjects', short: 'Russia',
    unit: 'federal subject', map: 'russia', tier: 3, source: 'admin1', blurb: 'Oblasts, republics, krais and okrugs — the biggest set here.' },
  { id: 'argentina', admin: 'Argentina', name: 'Argentine provinces', short: 'Argentina',
    unit: 'province', map: 'argentina', tier: 3, source: 'admin1', blurb: 'Twenty-three provinces and Buenos Aires.' },
  { id: 'nigeria', admin: 'Nigeria', name: 'Nigerian states', short: 'Nigeria',
    unit: 'state', map: 'nigeria', tier: 3, source: 'admin1', blurb: 'Thirty-six states and the Federal Capital Territory.' },
  { id: 'south-africa', admin: 'South Africa', name: 'South African provinces', short: 'South Africa',
    unit: 'province', map: 'south-africa', tier: 2, source: 'admin1', blurb: 'The nine post-1994 provinces.' },
  { id: 'indonesia', admin: 'Indonesia', name: 'Indonesian provinces', short: 'Indonesia',
    unit: 'province', map: 'indonesia', tier: 3, source: 'admin1', blurb: 'Across the whole archipelago.' },
  { id: 'switzerland', admin: 'Switzerland', name: 'Swiss cantons', short: 'Switzerland',
    unit: 'canton', map: 'switzerland', tier: 3, source: 'admin1', blurb: 'All twenty-six.' },
  { id: 'netherlands', admin: 'Netherlands', name: 'Dutch provinces', short: 'Netherlands',
    unit: 'province', map: 'netherlands', tier: 3, source: 'admin1',
    drop: ['Saba', 'St. Eustatius', 'Bonaire'],
    blurb: 'The twelve provinces of the European Netherlands.' },
  { id: 'ethiopia', admin: 'Ethiopia', name: 'Ethiopian regions', short: 'Ethiopia',
    unit: 'region', map: 'ethiopia', tier: 3, source: 'admin1', blurb: 'The federal regions.' },
  { id: 'egypt', admin: 'Egypt', name: 'Egyptian governorates', short: 'Egypt',
    unit: 'governorate', map: 'egypt', tier: 3, source: 'admin1', blurb: 'Twenty-seven governorates.' },
  { id: 'kenya', admin: 'Kenya', name: 'Kenyan provinces', short: 'Kenya',
    unit: 'province', map: 'kenya', tier: 4, source: 'admin1', blurb: 'The former eight provinces, as Natural Earth draws them.' },
  { id: 'pakistan', admin: 'Pakistan', name: 'Pakistani provinces', short: 'Pakistan',
    unit: 'province', map: 'pakistan', tier: 3, source: 'admin1', blurb: 'Provinces and territories.' },
  { id: 'vietnam', admin: 'Vietnam', name: 'Vietnamese provinces', short: 'Vietnam',
    unit: 'province', map: 'vietnam', tier: 4, source: 'admin1', blurb: 'North to south.' },
  { id: 'philippines', admin: 'Philippines', name: 'Philippine provinces', short: 'Philippines',
    unit: 'province', map: 'philippines', tier: 4, source: 'admin1', blurb: 'Across the archipelago.' },
  { id: 'colombia', admin: 'Colombia', name: 'Colombian departments', short: 'Colombia',
    unit: 'department', map: 'colombia', tier: 4, source: 'admin1', blurb: 'Thirty-two departments.' },
  { id: 'chile', admin: 'Chile', name: 'Chilean regions', short: 'Chile',
    unit: 'region', map: 'chile', tier: 4, source: 'admin1', blurb: 'North to south down the longest country.' },
  { id: 'peru', admin: 'Peru', name: 'Peruvian regions', short: 'Peru',
    unit: 'region', map: 'peru', tier: 4, source: 'admin1', blurb: 'Coast, sierra and selva.' },
  { id: 'poland', admin: 'Poland', name: 'Polish voivodeships', short: 'Poland',
    unit: 'voivodeship', map: 'poland', tier: 4, source: 'admin1', blurb: 'Sixteen voivodeships.' },
  { id: 'turkey', admin: 'Turkey', name: 'Turkish provinces', short: 'Türkiye',
    unit: 'province', map: 'turkey', tier: 4, source: 'admin1', blurb: 'Eighty-one provinces.' },
  { id: 'south-korea', admin: 'South Korea', name: 'South Korean provinces', short: 'South Korea',
    unit: 'province or metropolitan city', map: 'south-korea', tier: 4, source: 'admin1', blurb: 'Provinces and metropolitan cities.' },
  { id: 'new-zealand', admin: 'New Zealand', name: 'New Zealand regions', short: 'New Zealand',
    unit: 'region', map: 'new-zealand', tier: 4, source: 'admin1', blurb: 'Both islands.' },
  { id: 'saudi-arabia', admin: 'Saudi Arabia', name: 'Saudi regions', short: 'Saudi Arabia',
    unit: 'region', map: 'saudi-arabia', tier: 4, source: 'admin1', blurb: 'Thirteen regions.' },

  // Aggregated up a level, because admin-1 is too fine for these.
  { id: 'italy', admin: 'Italy', name: 'Italian regions', short: 'Italy',
    unit: 'region', map: 'italy', tier: 2, source: 'region', blurb: 'The twenty regions, five of them autonomous.' },
  { id: 'spain', admin: 'Spain', name: 'Spanish autonomous communities', short: 'Spain',
    unit: 'autonomous community', map: 'spain', tier: 2, source: 'region', blurb: 'Seventeen communities and two autonomous cities.' },
  { id: 'france', admin: 'France', name: 'French regions', short: 'France',
    unit: 'region', map: 'france', tier: 2, source: 'region', blurb: 'Thirteen metropolitan regions and five overseas.' },
  { id: 'uk', admin: 'United Kingdom', name: 'The United Kingdom', short: 'UK',
    unit: 'country', map: 'uk', tier: 1, source: 'subunit', blurb: 'Four countries, and where the border actually runs.' },
];

// City packs. Everything is drawn from Natural Earth's populated places, cut by
// population and by whether the place is a capital of something.
export const CITY_PACKS = [
  { id: 'cities-world', name: 'Great cities of the world', short: 'World cities',
    map: 'world', tier: 2, min: 3_000_000,
    blurb: 'Where the largest cities on Earth actually are — most of them not where people guess.' },
  { id: 'cities-canada', name: 'Canadian cities', short: 'Canadian cities',
    map: 'canada', tier: 1, country: 'Canada', min: 90_000,
    blurb: 'Every city worth the name, and which province it is in.' },
  { id: 'cities-usa', name: 'US cities', short: 'US cities',
    map: 'usa', tier: 2, country: 'United States of America', min: 400_000,
    blurb: 'The big ones, and which state they belong to.' },
  { id: 'cities-caribbean', name: 'Caribbean towns', short: 'Caribbean towns',
    map: 'caribbean', tier: 2, subregion: 'Caribbean', min: 0,
    blurb: 'Capitals and ports, from Nassau to Port of Spain.' },
  { id: 'cities-europe', name: 'European cities', short: 'European cities',
    map: 'europe', tier: 3, region: 'Europe', min: 700_000,
    blurb: 'Beyond the capitals.' },
  { id: 'cities-africa', name: 'African cities', short: 'African cities',
    map: 'africa', tier: 3, region: 'Africa', min: 1_200_000,
    blurb: 'The fastest-growing city system in the world.' },
  { id: 'cities-asia', name: 'Asian cities', short: 'Asian cities',
    map: 'asia', tier: 3, region: 'Asia', min: 3_000_000,
    blurb: 'Where most urban humans live.' },
];

// English display names where Natural Earth's differ from what anyone says.
export const RENAMES = {
  'Xizang': 'Tibet',
  'Inner Mongol': 'Inner Mongolia',
  'Ningxia Hui': 'Ningxia',
  'Xinjiang Uygur': 'Xinjiang',
  'Guangxi Zhuang': 'Guangxi',
  'Distrito Federal|Mexico': 'Mexico City',
  'México': 'State of Mexico',
  'Québec': 'Quebec',
  "Valle d'Aosta": 'Aosta Valley',
  'Piemonte': 'Piedmont',
  'Lombardia': 'Lombardy',
  'Toscana': 'Tuscany',
  'Sardegna': 'Sardinia',
  'Sicily': 'Sicily',
  'Apulia': 'Apulia (Puglia)',
  'Trentino-Alto Adige': 'Trentino-Alto Adige/Südtirol',
  'Cataluña': 'Catalonia',
  'Andalucía': 'Andalusia',
  'País Vasco': 'Basque Country',
  'Castilla y León': 'Castile and León',
  'Castilla-La Mancha': 'Castile-La Mancha',
  'Foral de Navarra': 'Navarre',
  'Valenciana': 'Valencian Community',
  'Islas Baleares': 'Balearic Islands',
  'Canary Is.': 'Canary Islands',
  'Aragón': 'Aragon',
  'Galicia': 'Galicia',
  'Asturias': 'Asturias',
  'Murcia': 'Region of Murcia',
  'Guyane française': 'French Guiana',
  'Corse': 'Corsica',
  'Bretagne': 'Brittany',
  'Normandie': 'Normandy',
  'Nord-Pas-de-Calais': 'Hauts-de-France',

  // German states, in English.
  'Bayern': 'Bavaria',
  'Niedersachsen': 'Lower Saxony',
  'Nordrhein-Westfalen': 'North Rhine-Westphalia',
  'Rheinland-Pfalz': 'Rhineland-Palatinate',
  'Sachsen': 'Saxony',
  'Sachsen-Anhalt': 'Saxony-Anhalt',
  'Thüringen': 'Thuringia',
  'Hessen': 'Hesse',
  'Mecklenburg-Vorpommern': 'Mecklenburg-Western Pomerania',

  // Dutch provinces, in English.
  'Zuid-Holland': 'South Holland',
  'Noord-Holland': 'North Holland',
  'Noord-Brabant': 'North Brabant',
  'Fryslan': 'Friesland',
};

// Sub-national units whose capital Natural Earth does not carry, or carries
// under a name that will not match. Hand-checked.
// City names Natural Earth spells wrong or oddly.
export const CITY_FIXES = {
  'Shenyeng': 'Shenyang',
  'Xian': "Xi'an",
  'Zhaotang': 'Zhaotong',
  'Hulin': 'Hulin',
};

export const CAPITAL_FIXES = {
  'CA-NU': 'Iqaluit',
  'CA-NT': 'Yellowknife',
  'CA-YT': 'Whitehorse',
  'CA-PE': 'Charlottetown',
  'CA-NL': "St. John's",
  'CA-NB': 'Fredericton',
  'CA-NS': 'Halifax',
  'CA-ON': 'Toronto',
  'CA-QC': 'Quebec City',
  'CA-MB': 'Winnipeg',
  'CA-SK': 'Regina',
  'CA-AB': 'Edmonton',
  'CA-BC': 'Victoria',

  // Prefectures whose capital shares the prefecture's name and is too small to
  // appear in Natural Earth's populated places.
  'JP-41': 'Saga', 'JP-35': 'Yamaguchi', 'JP-31': 'Tottori', 'JP-05': 'Akita',
  'JP-12': 'Chiba', 'JP-11': 'Saitama', 'JP-29': 'Nara', 'JP-25': 'Otsu',
  'NL-FL': 'Lelystad',
};
