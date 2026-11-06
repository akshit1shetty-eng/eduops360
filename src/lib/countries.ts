/**
 * Country reference + normaliser for the "Country of Residence" column.
 *
 * The sheet holds free text ("USA", "Viet Nam", "Riyadh Province", "Deutschland", …), so the
 * same country shows up under several spellings. resolveCountry() folds every spelling to one
 * canonical country with its ISO 3166-1 numeric code (the ids used by world-atlas) and a
 * label point (used for small countries that have no shape at 110m and for map pins).
 */

export interface CountryRef {
  name: string;
  /** ISO 3166-1 numeric, zero-padded — matches world-atlas geometry ids */
  iso: string;
  /** [longitude, latitude] label point */
  at: [number, number];
}

// name, iso, lon, lat, aliases (beyond the name itself)
const RAW: Array<[string, string, number, number, string[]?]> = [
  ['India', '356', 78.9, 22.5, ['in', 'ind', 'bharat']],
  ['Vietnam', '704', 106.3, 16.0, ['viet nam', 'vn', 'ho chi minh city', 'ho chi minh', 'hanoi', 'ha noi', 'saigon']],
  ['Canada', '124', -106.0, 57.0, ['ca', 'british columbia', 'ontario', 'alberta', 'quebec', 'manitoba', 'saskatchewan', 'nova scotia', 'toronto', 'vancouver', 'calgary', 'montreal']],
  ['Singapore', '702', 103.82, 1.35, ['sg', 'republic of singapore']],
  ['United States', '840', -98.0, 39.0, ['usa', 'us', 'u s', 'u s a', 'united states of america', 'america', 'california', 'texas', 'new york']],
  ['Saudi Arabia', '682', 45.0, 24.0, ['ksa', 'kingdom of saudi arabia', 'riyadh', 'riyadh province', 'jeddah', 'dammam']],
  ['Hong Kong', '344', 114.17, 22.32, ['hk', 'hong kong sar', 'hongkong']],
  ['United Arab Emirates', '784', 54.3, 23.9, ['uae', 'u a e', 'emirates', 'dubai', 'abu dhabi', 'sharjah']],
  ['Thailand', '764', 101.0, 15.5, ['th', 'ประเทศไทย', 'bangkok']],
  ['United Kingdom', '826', -2.0, 53.5, ['uk', 'u k', 'great britain', 'britain', 'england', 'scotland', 'wales', 'northern ireland', 'london']],
  ['Jamaica', '388', -77.3, 18.1],
  ['Nigeria', '566', 8.0, 9.5, ['lagos']],
  ['Bangladesh', '050', 90.3, 23.7],
  ['Indonesia', '360', 117.0, -2.5],
  ['Trinidad and Tobago', '780', -61.25, 10.45, ['trinidad', 'trinidad tobago']],
  ['Germany', '276', 10.4, 51.2, ['deutschland', 'de']],
  ['Mauritius', '480', 57.55, -20.3],
  ['Japan', '392', 138.0, 36.5],
  ['Qatar', '634', 51.2, 25.3, ['doha']],
  ['Australia', '036', 134.0, -25.0, ['sydney', 'melbourne']],
  ['Kuwait', '414', 47.5, 29.3],
  ['Malaysia', '458', 102.0, 4.0, ['kuala lumpur']],
  ['Pakistan', '586', 69.3, 30.0],
  ['Barbados', '052', -59.55, 13.15],
  ['China', '156', 104.0, 35.0, ['prc', 'peoples republic of china']],
  ['Nepal', '524', 84.0, 28.4],
  ['Netherlands', '528', 5.3, 52.1, ['holland', 'the netherlands']],
  ['Philippines', '608', 122.0, 12.5],
  ['Ireland', '372', -8.0, 53.4, ['republic of ireland']],
  ['Egypt', '818', 30.0, 26.8],
  ['Iraq', '368', 43.7, 33.2],
  ['Ethiopia', '231', 39.6, 8.6],
  ['South Africa', '710', 24.0, -29.0],
  ['Lebanon', '422', 35.9, 33.9],
  ['France', '250', 2.3, 46.6],
  ['Oman', '512', 56.0, 21.0],
  ['Taiwan', '158', 121.0, 23.7],
  ['Uganda', '800', 32.3, 1.4],
  ['Saint Vincent and the Grenadines', '670', -61.2, 13.25, ['saint vincent', 'svg']],
  ['Antigua and Barbuda', '028', -61.8, 17.1, ['antigua']],
  ['Grenada', '308', -61.68, 12.12],
  ['South Korea', '410', 127.8, 36.5, ['korea', 'republic of korea', 'korea republic of', 'korea south']],
  ['Saint Kitts and Nevis', '659', -62.75, 17.33, ['saint kitts']],
  ['Kenya', '404', 37.9, 0.2],
  ['Bahamas', '044', -77.4, 24.6],
  ['Spain', '724', -3.7, 40.4],
  ['Bahrain', '048', 50.55, 26.07],
  ['Sri Lanka', '144', 80.7, 7.9],
  ['New Zealand', '554', 172.5, -41.5],
  ['Israel', '376', 34.85, 31.0],
  ['Cameroon', '120', 12.35, 5.7],
  ['Mexico', '484', -102.5, 23.6],
  ['Russia', '643', 96.0, 61.0, ['russian federation']],
  ['Ghana', '288', -1.0, 7.9],
  ['Peru', '604', -75.0, -9.2],
  ['Cambodia', '116', 104.9, 12.6],
  ['Zambia', '894', 27.8, -13.1],
  ['Isle of Man', '833', -4.55, 54.23],
  ["Côte d'Ivoire", '384', -5.5, 7.5, ['ivory coast']],
  ['Tanzania', '834', 34.9, -6.4, ['united republic of tanzania']],
  ['Iran', '364', 53.7, 32.4, ['islamic republic of iran']],
  ['Sweden', '752', 15.0, 62.0],
  ['Denmark', '208', 9.5, 56.0],
  ['Italy', '380', 12.6, 42.8],
  ['Rwanda', '646', 29.9, -1.9],
  ['Syria', '760', 38.9, 34.8, ['syrian arab republic']],
  ['Niger', '562', 8.1, 17.6],
  ['Cyprus', '196', 33.4, 35.1],
  ['Algeria', '012', 2.6, 28.0],
  ['Bermuda', '060', -64.75, 32.3],
  ['Angola', '024', 17.9, -12.3],
  ['Maldives', '462', 73.5, 3.2],
  ['Timor-Leste', '626', 125.7, -8.9, ['east timor', 'timor leste']],
  ['Afghanistan', '004', 66.0, 33.9],
  ['Turkey', '792', 35.2, 39.0, ['turkiye']],
  ['Botswana', '072', 24.7, -22.3],
  ['Switzerland', '756', 8.2, 46.8],
  ['Bhutan', '064', 90.4, 27.5],
  ['Saint Lucia', '662', -60.98, 13.9],
  ['Guyana', '328', -58.9, 4.9],
  ['Belgium', '056', 4.5, 50.6],
  // Common extras so new rows land on the map without a code change
  ['Brazil', '076', -52.0, -10.5], ['Argentina', '032', -64.0, -34.0], ['Chile', '152', -71.0, -33.0],
  ['Colombia', '170', -73.0, 4.0], ['Venezuela', '862', -66.0, 7.0], ['Ecuador', '218', -78.4, -1.5],
  ['Portugal', '620', -8.2, 39.6], ['Poland', '616', 19.4, 52.1], ['Norway', '578', 9.0, 61.0],
  ['Finland', '246', 26.0, 63.0], ['Austria', '040', 14.5, 47.6], ['Greece', '300', 22.0, 39.3],
  ['Czechia', '203', 15.5, 49.8, ['czech republic']], ['Hungary', '348', 19.5, 47.2], ['Romania', '642', 25.0, 45.9],
  ['Ukraine', '804', 31.2, 49.0], ['Morocco', '504', -6.5, 31.8], ['Tunisia', '788', 9.5, 34.0],
  ['Jordan', '400', 36.5, 31.2], ['Yemen', '887', 47.5, 15.5], ['Zimbabwe', '716', 29.8, -19.0],
  ['Myanmar', '104', 96.0, 21.0, ['burma']], ['Laos', '418', 102.5, 19.5, ['lao pdr']], ['Kazakhstan', '398', 67.0, 48.0],
  ['Uzbekistan', '860', 64.5, 41.4], ['Senegal', '686', -14.5, 14.5], ['Sudan', '729', 30.0, 15.5],
  ['Mozambique', '508', 35.5, -17.5], ['Namibia', '516', 17.5, -22.0], ['Malawi', '454', 34.3, -13.3],
  ['Haiti', '332', -72.3, 19.0], ['Dominican Republic', '214', -70.5, 18.8], ['Puerto Rico', '630', -66.5, 18.2],
  ['Belize', '084', -88.7, 17.2], ['Fiji', '242', 178.0, -17.8], ['Papua New Guinea', '598', 145.0, -6.5],
  ['Luxembourg', '442', 6.13, 49.8], ['Macau', '446', 113.55, 22.17, ['macao']], ['Brunei', '096', 114.7, 4.5],
  ['Seychelles', '690', 55.5, -4.6], ['Dominica', '212', -61.37, 15.42], ['Cayman Islands', '136', -81.25, 19.3],
  ['Malta', '470', 14.4, 35.9], ['Iceland', '352', -19.0, 65.0], ['Somalia', '706', 46.0, 6.0],
  ['Belarus', '112', 28.0, 53.7], ['Serbia', '688', 20.9, 44.0], ['Croatia', '191', 16.0, 45.3],
  ['Bulgaria', '100', 25.5, 42.7], ['Slovakia', '703', 19.7, 48.7], ['Lithuania', '440', 23.9, 55.2],
  ['Latvia', '428', 24.6, 56.9], ['Estonia', '233', 25.0, 58.6], ['Mongolia', '496', 103.8, 46.9],
];

/** Values that name a region rather than a country — counted, but not placed on the map. */
const REGION_WORDS = new Set([
  'apac', 'asia', 'asia pacific', 'africa', 'europe', 'emea', 'middle east', 'mena', 'gcc', 'latam',
  'latin america', 'caribbean', 'north america', 'south america', 'oceania', 'others', 'other', 'global',
]);

export function normalizeKey(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9฀-๿]+/g, ' ')
    .replace(/\bst\b/g, 'saint')
    .trim()
    .replace(/^the /, '');
}

const LOOKUP = new Map<string, CountryRef>();
for (const [name, iso, lon, lat, aliases = []] of RAW) {
  const ref: CountryRef = { name, iso, at: [lon, lat] };
  for (const key of [name, ...aliases]) LOOKUP.set(normalizeKey(key), ref);
}

export type ResolvedLocation =
  | { kind: 'country'; country: CountryRef }
  | { kind: 'region'; label: string }
  | { kind: 'unknown'; label: string };

export function resolveCountry(raw: string): ResolvedLocation | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) return null;
  const key = normalizeKey(trimmed);
  const hit = LOOKUP.get(key);
  if (hit) return { kind: 'country', country: hit };
  if (REGION_WORDS.has(key)) return { kind: 'region', label: trimmed };
  return { kind: 'unknown', label: trimmed };
}

/** Sequential learner-count bins for the map (validated single-hue upGrad red ramp). */
export const MAP_BINS: Array<{ min: number; label: string; color: string }> = [
  { min: 1, label: '1–9', color: '#F4949C' },
  { min: 10, label: '10–49', color: '#EC5C67' },
  { min: 50, label: '50–199', color: '#E0222D' },
  { min: 200, label: '200–999', color: '#B3000E' },
  { min: 1000, label: '1,000+', color: '#6E0009' },
];

export const MAP_NO_DATA = '#E3E4E5';

export function binColor(count: number): string {
  if (count <= 0) return MAP_NO_DATA;
  let color = MAP_BINS[0].color;
  for (const b of MAP_BINS) if (count >= b.min) color = b.color;
  return color;
}

/* ───────────────────────── Regions ───────────────────────── */

export type RegionId = 'subcontinent' | 'sea' | 'emea' | 'eastasia' | 'canada' | 'us' | 'row';

export interface RegionDef {
  id: RegionId;
  name: string;
  description: string;
  /** Identity colour on the global map (adjacent regions validated for colour-blind separation) */
  color: string;
  /** ISO numeric codes of member countries (null = every country not in another region) */
  isos: Set<string> | null;
  /** Zoom window as [[west, south], [east, north]]; null = whole world */
  view: [[number, number], [number, number]] | null;
  /** Where the region's label sits on the global map [lon, lat] */
  label: [number, number];
}

const AFRICA = ['012', '024', '204', '072', '854', '108', '120', '132', '140', '148', '174', '178', '180', '384', '262', '818', '226', '232', '748', '231', '266', '270', '288', '324', '624', '404', '426', '430', '434', '450', '454', '466', '478', '480', '504', '508', '516', '562', '566', '646', '678', '686', '690', '694', '706', '710', '728', '729', '834', '768', '788', '800', '894', '716', '732'];
const EUROPE = ['826', '372', '276', '250', '528', '056', '724', '620', '380', '756', '040', '752', '578', '208', '246', '352', '616', '203', '703', '348', '642', '100', '300', '191', '688', '705', '070', '499', '807', '008', '440', '428', '233', '112', '804', '498', '442', '470', '833', '643', '268', '051', '031'];
const MIDDLE_EAST = ['682', '784', '634', '414', '512', '048', '368', '364', '422', '376', '275', '400', '760', '887', '792', '196'];

export const REGIONS: RegionDef[] = [
  {
    id: 'subcontinent', name: 'India + Subcontinent', description: 'India, Bangladesh, Nepal, Sri Lanka, Pakistan, Bhutan, Maldives, Afghanistan',
    color: '#E50913', isos: new Set(['356', '050', '524', '144', '586', '064', '462', '004']),
    view: [[60, 4], [98, 38]], label: [74, 45],
  },
  {
    id: 'sea', name: 'SEA', description: 'South-East Asia',
    color: '#2a78d6', isos: new Set(['704', '702', '764', '458', '360', '608', '116', '418', '104', '096', '626']),
    view: [[92, -11], [142, 24]], label: [116, -2],
  },
  {
    id: 'emea', name: 'EMEA', description: 'Europe, Middle East & Africa',
    color: '#1f9e89', isos: new Set([...EUROPE, ...MIDDLE_EAST, ...AFRICA]),
    view: [[-25, -36], [65, 71]], label: [20, 12],
  },
  {
    id: 'eastasia', name: 'East Asia', description: 'China, Hong Kong, Macau, Taiwan, Japan, South Korea, Mongolia',
    color: '#d9a21b', isos: new Set(['156', '344', '446', '158', '392', '410', '408', '496']),
    view: [[73, 18], [146, 54]], label: [136, 47],
  },
  {
    id: 'canada', name: 'Canada', description: 'Canada',
    color: '#eb6834', isos: new Set(['124']),
    view: [[-141, 42], [-52, 72]], label: [-100, 60],
  },
  {
    id: 'us', name: 'US', description: 'United States',
    color: '#6250d6', isos: new Set(['840']),
    view: [[-126, 24], [-66, 50]], label: [-100, 37],
  },
  {
    id: 'row', name: 'Rest of World', description: 'Latin America & Caribbean, Oceania, Central Asia',
    color: '#B5B7BA', isos: null,
    view: null, label: [134, -25],
  },
];

export function regionOfIso(iso: string): RegionDef {
  return REGIONS.find(r => r.isos?.has(iso)) ?? REGIONS[REGIONS.length - 1];
}
