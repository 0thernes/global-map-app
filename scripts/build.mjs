// Bundle src/ into js/app.js (IIFE, so index.html works from file:// with no server).
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const opts = {
  absWorkingDir: root,
  entryPoints: ['src/app.js'],
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  sourcemap: true,
  legalComments: 'eof',
  logLevel: 'warning',
  outfile: 'js/app.js',
  plugins: [
    {
      // bare 'three' -> the vendored r170 build; three/examples/jsm/* add-ons come from the pinned three@0.170.0 devDependency
      name: 'vendored-three',
      setup(b) {
        b.onResolve({ filter: /^three$/ }, () => ({ path: path.join(root, 'vendor/three/three.module.min.js') }));
      },
    },
  ],
};
if (watch) {
  const { context } = await import('esbuild');
  const c = await context(opts);
  await c.watch();
  console.log('watching src/ ...');
} else {
  const r = await build({ ...opts, metafile: true });
  const out = r.metafile.outputs['js/app.js'];
  console.log(`built js/app.js (${(out.bytes / 1024).toFixed(0)} KB)`);
}
