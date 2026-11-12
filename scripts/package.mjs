// Release packaging: copies the runtime files into dist/site (for GitHub Pages) and/or writes
// dist/global-map-app-v<version>.zip (for releases). Pure Node (zlib deflate + CRC-32), no zip binary needed.
// Usage: node scripts/package.mjs [--site] [--zip] [--out <path>]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const INCLUDE = [
  'index.html',
  'launch.cmd',
  'LICENSE',
  'DATA_LICENSE.md',
  'CREDITS.md',
  'README.md',
  'CHANGELOG.md',
  'css',
  'js',
  'data',
  'vendor',
  'assets',
  'textures',
];
const EXCLUDE = [
  /^data\/private\//,
  /^data\/tools\//,
  /^data\/sources\//,
  /__pycache__/,
  /\.py$/,
  /\.sh$/,
  /^data\/unplotted.*\.csv$/,
  /\.DS_Store$/,
];
const args = process.argv.slice(2);
const want = { site: args.includes('--site'), zip: args.includes('--zip') || !args.includes('--site') };

function walk(p, out = []) {
  const st = statSync(p, { throwIfNoEntry: false });
  if (!st) return out;
  if (st.isDirectory()) for (const f of readdirSync(p).sort()) walk(join(p, f), out);
  else out.push(p.replace(/\\/g, '/'));
  return out;
}
const files = INCLUDE.flatMap((p) => walk(p)).filter((f) => !EXCLUDE.some((r) => r.test(f)));

if (want.site) {
  const dir = 'dist/site';
  rmSync(dir, { recursive: true, force: true });
  for (const f of files) {
    mkdirSync(join(dir, dirname(f)), { recursive: true });
    copyFileSync(f, join(dir, f));
  }
  writeFileSync(join(dir, '.nojekyll'), '');
  console.log(`site: ${files.length} files -> ${dir}`);
}
if (want.zip) {
  const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : `dist/global-map-app-v${pkg.version}.zip`;
  mkdirSync(dirname(out), { recursive: true });
  const root = `global-map-app-v${pkg.version}/`;
  const chunks = [],
    central = [];
  let off = 0;
  const dosTime = 0,
    dosDate = ((2026 - 1980) << 9) | (11 << 5) | 12; // fixed timestamp (2026-11-12) for reproducible zips
  for (const f of files) {
    const data = readFileSync(f);
    const name = Buffer.from(root + relative('.', f).replace(/\\/g, '/'));
    const comp = /\.(png|jpg|webp|mp3|woff2|gz|zip)$/i.test(f) ? null : deflateRawSync(data, { level: 9 });
    const body = comp && comp.length < data.length ? comp : data;
    const method = body === data ? 0 : 8;
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt16LE(dosTime, 10);
    lh.writeUInt16LE(dosDate, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(body.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(name.length, 26);
    chunks.push(lh, name, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt16LE(dosTime, 12);
    ch.writeUInt16LE(dosDate, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(body.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(off, 42);
    central.push(ch, name);
    off += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(off, 16);
  writeFileSync(out, Buffer.concat([...chunks, cd, end]));
  console.log(`zip: ${files.length} files, ${(statSync(out).size / 1e6).toFixed(1)} MB -> ${out}`);
}
