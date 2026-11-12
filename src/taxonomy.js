// Layers-of-layers taxonomy (pure; shared by the app, scripts/coverage.mjs and tests). Definitions: docs/audit/TAXONOMY.md.
// domain > layer > sub-layer > subtype > record. Sub-layer keys are derived only from fields present in each row.

/** Nuclear sites > reactor / storage / test / lab / missile / waste / fuel cycle / other (from the row's subtype + name). */
export const nucKind = (s) =>
  /waste|disposal|repositor/i.test(s)
    ? 'waste'
    : /storage|spent fuel|depot|stockpile/i.test(s)
      ? 'storage'
      : /missile|silo|icbm|launch/i.test(s)
        ? 'missile'
        : /test|proving|explosion|polygon/i.test(s)
          ? 'test'
          : /laborator|research|institut|cent(er|re)|academ/i.test(s)
            ? 'lab'
            : /power|reactor|plant|generating/i.test(s)
              ? 'reactor'
              : /enrich|reprocess|fuel|mine|mill|conversion/i.test(s)
                ? 'fuel cycle'
                : 'other';

/** Case sub-layer key: Animal mutilation > cattle / horse / dog / wildlife / other livestock / unspecified; others use subtype. */
export function caseSub(c) {
  if (c.category === 'Animal mutilation') {
    const t = `${c.subtype || ''} ${c.name || ''} ${c.summary || ''}`;
    if (/cattle|\bcows?\b|bull|steer|heifer|calf|calves/i.test(t)) return 'cattle';
    if (/horse|pony|mare|stallion|colt/i.test(t)) return 'horse';
    if (/\bdogs?\b|canine|puppy/i.test(t)) return 'dog';
    if (/deer|elk|moose|wildlife|wolf|fox|bear|bird|fish/i.test(t)) return 'wildlife';
    if (/sheep|goat|pig|llama|alpaca|livestock/i.test(t)) return 'other livestock';
    return 'unspecified';
  }
  return c.subtype || '';
}

/** Reference-layer sub-layer keys. */
export const SUB_FIELD = {
  military: (it) =>
    it.src === 'MIRTA'
      ? 'US DoD (MIRTA)'
      : /^fort/.test(it.kind || '')
        ? 'fort / historic fortification'
        : /^gendarmerie/.test(it.kind || '')
          ? 'gendarmerie / police barracks'
          : it.kind || 'other',
  nuclear: (it) => (/operat/i.test(it.status || '') ? 'operating' : it.status || 'unknown status'),
  map_nuclear_tests: (it) => it.environment || 'unknown environment',
  map_nuclear_sites: (it) => nucKind(`${it.subtype || ''} ${it.name || ''}`),
  volcanoes: (it) => it.type || it.primary_type || 'volcano',
  hydrolakes: (it) => (it.vol_src === 3 ? 'depth modelled (unmapped depth)' : 'depth/volume reported'),
  map_offlimits_mountains: (it) =>
    ({
      offlimits_mountain: 'off-limits mountain',
      nuclear_storage: 'nuclear-weapons storage',
      literal_name: "literal 'secret' place name",
    })[it.category] ||
    it.category ||
    'other',
  trenches: (it) => (it.kind === 'deep' ? 'named deep' : 'trench'),
  fireballs: (it) => (+it.impact_energy_kt >= 1 ? 'impact energy ≥ 1 kt' : 'impact energy < 1 kt'),
};
