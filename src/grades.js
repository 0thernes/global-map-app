// Evidence-grade classes. Pure module (no DOM) so it can be unit-tested in Node.
// grade classes (project grading policy, see docs/data-and-grading.md): CIT, Official record, ST (experiencers), Testimony, other. Mixed grades take the highest class.
export const GRADES = [
  {
    k: 'CIT',
    label: 'CIT',
    desc: 'Credible insider testimony: on-record military, IC, heads of state, Congress, heavy-STEM/elite researchers, Sol/TTSA, Kean/Blumenthal/Coulthart/Knapp, Hastings, Diana Pasulka',
    color: '#38e8ff',
  },
  {
    k: 'Official record',
    label: 'Official record',
    desc: 'Government / institutional archive or official file',
    color: '#ffd23f',
  },
  { k: 'ST', label: 'ST', desc: 'Serious testimony: experiencers', color: '#b98cff' },
  {
    k: 'Testimony',
    label: 'TE / testimony',
    desc: 'Public filer or witness, credential unknown (e.g. NUFORC/MUFON reports keep the filer grade)',
    color: '#9db1c2',
  },
  {
    k: 'Online claim',
    label: 'Online claim',
    desc: 'Online claim or trail only (e.g. "Online claim (trail only)", "Online claim (ungraded)"); lowest weight',
    color: '#8a7a9a',
  },
  { k: 'Other', label: 'Other / ungraded', desc: 'Any other grade string found in the data', color: '#7a90a3' },
];
export function gradeClass(g) {
  const s = String(g || '').toLowerCase();
  if (!s) return 'Other';
  if (/\bcit\b|cred\.? insider|credible insider/.test(s)) return 'CIT';
  if (/official record|official/.test(s)) return 'Official record';
  if (/\bst\b|serious testimony|experiencer/.test(s)) return 'ST';
  if (/online claim|trail only/.test(s)) return 'Online claim';
  if (/testimony|^te\b/.test(s)) return 'Testimony';
  return 'Other';
}
export const gradeColor = (k) => (GRADES.find((g) => g.k === k) || GRADES[GRADES.length - 1]).color;
