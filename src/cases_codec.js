// Columnar, dictionary-encoded case table written by data/build_data.py for large case sets (smaller file, faster parse).
// Format: { n, keys: [...], dict: { key: [values] }, col: { key: [index | value | null] } }
// Dictionary columns store an index into dict[key]; plain columns store the value. null = field absent on that row.
export function expandCases(t) {
  if (!t) return [];
  if (Array.isArray(t)) return t;
  const out = new Array(t.n);
  for (let i = 0; i < t.n; i++) out[i] = {};
  for (const k of t.keys) {
    const col = t.col[k];
    const d = t.dict[k];
    for (let i = 0; i < t.n; i++) {
      const v = col[i];
      if (v === null || v === undefined) continue;
      out[i][k] = d ? d[v] : v;
    }
  }
  return out;
}
