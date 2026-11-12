// Regenerates src/icons.js from the vendored-at-build-time lucide-static package (ISC licence,
// vendor/icons/LICENSE-Lucide.txt). Only the icons listed here are shipped. Usage: node scripts/gen_icons.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const NAMES = [
  ...['globe', 'layers', 'filter', 'search', 'swords', 'activity', 'chart-column', 'share-2', 'columns-2'],
  ...['file-text', 'book-open', 'table-2', 'library', 'play', 'pause', 'clapperboard', 'volume-2', 'volume-x'],
  ...['settings', 'camera', 'download', 'circle-help', 'shuffle', 'lasso', 'crosshair', 'x', 'map-pin', 'gauge'],
  ...['music', 'list-ordered', 'scroll-text', 'radar', 'orbit', 'printer', 'skip-forward', 'skip-back'],
  ...['square-pen', 'sparkles', 'minus', 'maximize-2', 'minimize-2', 'chevron-left', 'chevron-right'],
  ...['chevron-down', 'info', 'panel-left-close', 'panel-left-open', 'layout-dashboard', 'rotate-ccw', 'star'],
  ...['grip-vertical', 'log-out', 'dices'],
];
const dir = 'node_modules/lucide-static/icons/';
const ver = JSON.parse(readFileSync('node_modules/lucide-static/package.json', 'utf8')).version;
const body = (n) =>
  readFileSync(dir + n + '.svg', 'utf8')
    .replace(/<!--.*?-->/s, '')
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
const key = (n) => (/^[a-z]+$/.test(n) ? n : `'${n}'`);
const out = `// Lucide icons (ISC licence, vendor/icons/LICENSE-Lucide.txt), generated from lucide-static ${ver} by
// scripts/gen_icons.mjs. Do not edit by hand: add the name there and re-run it.
export const ICONS = {
${NAMES.map((n) => `  ${key(n)}: '${body(n)}',`).join('\n')}
};
export const icon = (n, size = 16) =>
  \`<svg class="ico" width="\${size}" height="\${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\${ICONS[n] || ''}</svg>\`;
`;
writeFileSync('src/icons.js', out);
console.log('icons', NAMES.length, 'from lucide-static', ver);
