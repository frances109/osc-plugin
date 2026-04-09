#!/usr/bin/env node
// build.mjs
// ─────────────────────────────────────────────────────────────
//  Replaces `vite build` for this project.
//
//  Why not Vite/Rollup?
//  scorecard.js is a plain IIFE (jQuery-dependent, no ES imports).
//  Rollup forbids multiple inputs when format is 'iife' because
//  inlineDynamicImports is implicitly true — a hard constraint
//  with no config workaround. esbuild has no such restriction.
//
//  What this does:
//   1. Copies npm CSS assets (bootstrap, intl-tel-input, bootstrap-icons)
//      into plugin/dist/css/vendor/ so the PHP template can load them
//      without any CDN dependency.
//   2. Prepends the jsPDF UMD bundle so window.jspdf is available,
//      then minifies src/js/scorecard.js → plugin/dist/js/scorecard.js
//      (bundle:false — jQuery and intl-tel-input stay as globals loaded
//       by the PHP template from vendor CSS + their own script tags).
//   3. Minifies src/css/scorecard.css → plugin/dist/css/scorecard.css
//   4. Copies npm JS assets (jquery, bootstrap, intl-tel-input) into
//      plugin/dist/js/vendor/ so the PHP template loads them locally.
//   5. Cleans the output dir first.
// ─────────────────────────────────────────────────────────────

import { build }        from 'esbuild';
import CleanCSS         from 'clean-css';
import {
  existsSync, mkdirSync, rmSync,
  readFileSync, writeFileSync, copyFileSync
} from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NM        = resolve(__dirname, 'node_modules');
const OUT_DIR   = resolve(__dirname, 'plugin/outsourcing-scorecard/dist');

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
function log(msg) { process.stdout.write(msg + '\n'); }

// ── 1. Clean ──────────────────────────────────────────────────────────────────
if (existsSync(OUT_DIR)) {
  rmSync(OUT_DIR, { recursive: true, force: true });
  log('✓ Cleaned ' + OUT_DIR);
}
ensureDir(resolve(OUT_DIR, 'js/vendor'));
ensureDir(resolve(OUT_DIR, 'css/vendor'));

// ── 2. Copy vendor JS (loaded by PHP template — no CDN needed) ────────────────
log('\nCopying vendor JS…');

const vendorJS = [
  { src: 'jquery/dist/jquery.min.js',                                   dest: 'jquery.min.js' },
  { src: 'bootstrap/dist/js/bootstrap.bundle.min.js',                   dest: 'bootstrap.bundle.min.js' },
  { src: 'intl-tel-input/build/js/intlTelInput.min.js',                 dest: 'intlTelInput.min.js' },
  { src: 'intl-tel-input/build/js/utils.js',                            dest: 'utils.js' },
];

for (const v of vendorJS) {
  const src  = resolve(NM, v.src);
  const dest = resolve(OUT_DIR, 'js/vendor', v.dest);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    log('  ✓ js/vendor/' + v.dest);
  } else {
    log('  ⚠ NOT FOUND: ' + v.src + ' — run npm install');
  }
}

// ── 3. Copy vendor CSS (loaded by PHP template — no CDN needed) ───────────────
log('\nCopying vendor CSS…');

const vendorCSS = [
  { src: 'bootstrap/dist/css/bootstrap.min.css',                        dest: 'bootstrap.min.css' },
  { src: 'bootstrap-icons/font/bootstrap-icons.min.css',                dest: 'bootstrap-icons.min.css' },
  { src: 'intl-tel-input/build/css/intlTelInput.css',                   dest: 'intlTelInput.css' },
];

for (const v of vendorCSS) {
  const src  = resolve(NM, v.src);
  const dest = resolve(OUT_DIR, 'css/vendor', v.dest);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    log('  ✓ css/vendor/' + v.dest);
  } else {
    log('  ⚠ NOT FOUND: ' + v.src + ' — run npm install');
  }
}

// bootstrap-icons also needs its fonts folder
const biSrc  = resolve(NM, 'bootstrap-icons/font/fonts');
const biDest = resolve(OUT_DIR, 'css/vendor/fonts');
if (existsSync(biSrc)) {
  ensureDir(biDest);
  import('fs').then(({ readdirSync }) => {
    readdirSync(biSrc).forEach(f => {
      copyFileSync(resolve(biSrc, f), resolve(biDest, f));
    });
    log('  ✓ css/vendor/fonts/ (bootstrap-icons)');
  });
}

// intl-tel-input flag images
const itiFlags = resolve(NM, 'intl-tel-input/build/img');
const itiDest  = resolve(OUT_DIR, 'css/vendor/img');
if (existsSync(itiFlags)) {
  ensureDir(itiDest);
  import('fs').then(({ readdirSync }) => {
    readdirSync(itiFlags).forEach(f => {
      copyFileSync(resolve(itiFlags, f), resolve(itiDest, f));
    });
    log('  ✓ css/vendor/img/ (intl-tel-input flags)');
  });
}

// ── 4. Build scorecard.js — prepend jsPDF UMD then minify ─────────────────────
log('\nBuilding JS…');

const jsPDFPath   = resolve(NM, 'jspdf/dist/jspdf.umd.min.js');
const jsPDFExists = existsSync(jsPDFPath);

if (!jsPDFExists) {
  log('  ⚠ jsPDF not found at ' + jsPDFPath + ' — run npm install');
}

await build({
  entryPoints: [resolve(__dirname, 'src/js/scorecard.js')],
  outfile:     resolve(OUT_DIR, 'js/scorecard.js'),
  bundle:      false,       // plain IIFE — jQuery/iti stay as window globals
  minify:      true,
  platform:    'browser',
  target:      ['es2017'],
  logLevel:    'warning',
  // jsPDF UMD prepended as banner → sets window.jspdf before IIFE runs
  ...(jsPDFExists ? {
    banner: { js: readFileSync(jsPDFPath, 'utf8') }
  } : {})
});
log('  ✓ js/scorecard.js');

// ── 5. Minify scorecard.css ───────────────────────────────────────────────────
log('\nBuilding CSS…');

const cc     = new CleanCSS({ level: 2, returnPromise: true });
const src    = readFileSync(resolve(__dirname, 'src/css/scorecard.css'), 'utf8');
const result = await cc.minify(src);

if (result.errors.length) {
  console.error('CSS errors:', result.errors);
  process.exit(1);
}

writeFileSync(resolve(OUT_DIR, 'css/scorecard.css'), result.styles, 'utf8');
log('  ✓ css/scorecard.css');

log('\n✓ Build complete → ' + OUT_DIR + '\n');
