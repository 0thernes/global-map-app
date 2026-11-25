// Load-time clean-up of known upstream artefacts. Pure (no DOM); unit-tested in test/unit/hardening.test.mjs.
//
// Wikidata SPARQL returns a blank node ("unknown value", e.g. P576 dissolved = unknown date) as a
// http://www.wikidata.org/.well-known/genid/<hash> IRI. An earlier fetch truncated those to 10 characters, so 313
// military rows carry dissolved = "http://www" and status = "dissolved http://www", 22 carry inception = "http://www",
// one carries the full genid IRI as its country and one nuclear-site summary ends in "closed http://www".
// They are not data: the value is "unknown" in the source. This turns each into an explicit unknown and never invents
// a value. Row fields that hold real links (source_url, url, seed_url, extra_sources) are left alone.
const LINK_FIELDS = new Set(['source_url', 'url', 'seed_url', 'extra_sources', 'imagery', 'wikidata_url']);
const PLACEHOLDER = /^(?:https?:\/\/www(?:\.wikidata\.org\/\.well-known\/genid\/[0-9a-f]+)?)$/i;
const TRAILING = /\s+https?:\/\/www(?:\.wikidata\.org\/\.well-known\/genid\/[0-9a-f]+)?$/i;
export const UNKNOWN_NOTE = 'unknown in Wikidata';

/** Returns a copy of `row` with Wikidata unknown-value placeholders replaced; `_unknown` lists the affected fields. */
export function cleanWikidataPlaceholders(row) {
  let out = null;
  const unknown = [];
  for (const [k, v] of Object.entries(row)) {
    if (typeof v !== 'string' || LINK_FIELDS.has(k) || !/https?:\/\/www/i.test(v)) continue;
    out ||= { ...row };
    if (PLACEHOLDER.test(v.trim())) {
      out[k] = '';
      unknown.push(k);
    } else if (TRAILING.test(v)) {
      // "dissolved http://www" -> "dissolved (date unknown in Wikidata)"
      out[k] = v.replace(TRAILING, ` (date ${UNKNOWN_NOTE})`);
      unknown.push(k);
    }
  }
  if (!out) return row;
  if (unknown.length) out._unknown = unknown;
  return out;
}
