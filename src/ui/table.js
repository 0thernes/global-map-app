// Table helpers for the design system (v1.3): which columns hold numbers, so they are right-aligned with
// tabular numerals (css/components.css .num). Pure; unit-tested in test/unit/tabs.test.mjs.
// a column is numeric (right-aligned, tabular numerals) when at least 80 % of its non-empty cells are numbers
export function numericCols(n, rows) {
  const out = [];
  for (let i = 0; i < n; i++) {
    let k = 0,
      t = 0;
    for (const r of rows.slice(0, 400)) {
      const v = String(r[i] ?? '').trim();
      if (!v) continue;
      t++;
      if (/^[+\-−±~≈<>]?\s?\d[\d,. ]*(%|×|x)?$/.test(v)) k++;
    }
    out.push(t > 0 && k / t >= 0.8);
  }
  return out;
}
