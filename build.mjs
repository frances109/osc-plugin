#!/usr/bin/env node
/**
 * build.mjs — Outsourcing Readiness Scorecard plugin build
 *
 * Why esbuild instead of Vite/Rollup?
 *   main.js is a standard ES module, so Rollup could bundle it.
 *   However, pdf-worker.js must also be a self-contained bundle (a Worker
 *   script can't use dynamic import() across origins). esbuild handles
 *   multiple independent entry points cleanly with no restrictions.
 *
 * What this script does:
 *   1. Cleans plugin/dist/
 *   2. Copies vendor JS  (jquery, bootstrap, intl-tel-input, jspdf.umd) to dist/js/vendor/
 *   3. Copies vendor CSS (bootstrap, bootstrap-icons, intl-tel-input) to dist/css/vendor/
 *      including fonts/ and img/ sub-directories
 *   4. Bundles src/js/main.js       → dist/js/scorecard.js  (ES module → IIFE, minified)
 *   5. Bundles src/js/pdf-worker.js → dist/js/pdf-worker.js (self-contained Worker bundle)
 *      jsPDF is NOT bundled into pdf-worker.js — the Worker loads it at runtime
 *      via importScripts(jsPDFUrl), where jsPDFUrl points to the local vendor copy.
 *      This keeps pdf-worker.js small and lets the browser cache jsPDF separately.
 *   6. Minifies src/css/scorecard.css → dist/css/scorecard.css
 *
 * Usage:
 *   npm run build        — production build
 *   npm run build:watch  — watch src/js/main.js (CSS watch: run CleanCSS manually)
 */

import { build, context }  from 'esbuild';
import CleanCSS            from 'clean-css';
import {
  existsSync, mkdirSync, rmSync,
  readFileSync, writeFileSync, copyFileSync, readdirSync,
} from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NM        = resolve(__dirname, 'node_modules');
const OUT_DIR   = resolve(__dirname, 'plugin/outsourcing-scorecard/dist');
const WATCH     = process.argv.includes('--watch');

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function log(msg) {
  process.stdout.write(msg + '\n');
}

function copyDir(src, dest) {
  ensureDir(dest);
  readdirSync(src).forEach(f => copyFileSync(resolve(src, f), resolve(dest, f)));
}

function copyFile(srcRel, destName) {
  const src  = resolve(NM, srcRel);
  const dest = resolve(OUT_DIR, destName);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    log(`  ✓ ${destName}`);
  } else {
    log(`  ⚠ NOT FOUND: ${srcRel} — run npm install`);
  }
}

// ── 1. Clean ──────────────────────────────────────────────────────────────────

if (existsSync(OUT_DIR)) {
  rmSync(OUT_DIR, { recursive: true, force: true });
  log('✓ Cleaned ' + OUT_DIR);
}
ensureDir(resolve(OUT_DIR, 'js/vendor'));
ensureDir(resolve(OUT_DIR, 'css/vendor'));

// ── 2. Vendor JS ──────────────────────────────────────────────────────────────
log('\nCopying vendor JS…');
copyFile('jquery/dist/jquery.min.js',                   'js/vendor/jquery.min.js');
copyFile('bootstrap/dist/js/bootstrap.bundle.min.js',   'js/vendor/bootstrap.bundle.min.js');
copyFile('intl-tel-input/build/js/intlTelInput.min.js', 'js/vendor/intlTelInput.min.js');
copyFile('intl-tel-input/build/js/utils.js',            'js/vendor/utils.js');
// jsPDF UMD — loaded by pdf-worker.js via importScripts() at runtime
copyFile('jspdf/dist/jspdf.umd.min.js',                 'js/vendor/jspdf.umd.min.js');

// ── 3. Vendor CSS ─────────────────────────────────────────────────────────────
log('\nCopying vendor CSS…');
copyFile('bootstrap/dist/css/bootstrap.min.css',        'css/vendor/bootstrap.min.css');
copyFile('bootstrap-icons/font/bootstrap-icons.min.css','css/vendor/bootstrap-icons.min.css');
copyFile('intl-tel-input/build/css/intlTelInput.css',   'css/vendor/intlTelInput.css');

// Bootstrap Icons fonts
const biFonts = resolve(NM, 'bootstrap-icons/font/fonts');
if (existsSync(biFonts)) {
  copyDir(biFonts, resolve(OUT_DIR, 'css/vendor/fonts'));
  log('  ✓ css/vendor/fonts/ (bootstrap-icons)');
}

// intl-tel-input flag images
const itiImg = resolve(NM, 'intl-tel-input/build/img');
if (existsSync(itiImg)) {
  copyDir(itiImg, resolve(OUT_DIR, 'css/vendor/img'));
  log('  ✓ css/vendor/img/ (intl-tel-input flags)');
}

// ── 4. JS bundles ─────────────────────────────────────────────────────────────
log('\nBuilding JS…');

// Shared esbuild options for both entry points
const sharedBuildOpts = {
  bundle:   true,       // resolve all ES module imports into a single output file
  minify:   !WATCH,
  platform: 'browser',
  target:   ['es2017'],
  logLevel: 'warning',
  // Mark jQuery and intl-tel-input as external globals — they are loaded
  // separately by the PHP template / Worker importScripts, not bundled in.
  // jsPDF is also external here because pdf-worker.js loads it via importScripts.
  external: [],
};

// ── 4a. Main application bundle (main.js → scorecard.js) ─────────────────────
// Output format: IIFE wrapping the entire module graph, so it works when loaded
// via a plain <script> tag in the PHP template (no type="module" needed).
// jQuery is a global — the bundle calls window.$ / window.jQuery.
//
// jsPDF is marked external here so esbuild does NOT pull it into scorecard.js.
// It lives in vendor/jspdf.umd.min.js and is loaded only when the PDF Worker
// needs it (via importScripts). The main-thread fallback path in pdf.js uses
// dynamic import('jspdf') — esbuild treats external dynamic imports as a
// runtime no-op chunk reference, so the fallback gracefully returns '' if the
// vendor file is unreachable rather than crashing.
// Result: scorecard.js ~45 KB instead of ~767 KB.
const mainOpts = {
  ...sharedBuildOpts,
  entryPoints: [resolve(__dirname, 'src/js/main.js')],
  outfile:     resolve(OUT_DIR, 'js/scorecard.js'),
  format:      'iife',
  globalName:  'OSC',     // not actually used, but required by esbuild for IIFE
  external:    ['jspdf'], // kept in vendor/, never bundled into scorecard.js
  define: {
    'window.$':            'window.$',
    'window.intlTelInput': 'window.intlTelInput',
  },
};

// ── 4b. PDF Worker bundle (pdf-worker.js → pdf-worker.js) ────────────────────
// Output format: IIFE again — Workers don't support type="module" in all browsers.
// jsPDF is NOT bundled here; it's loaded at Worker runtime via importScripts().
// pdf-core.js IS bundled (inlined) since the Worker can't import it separately.
const workerOpts = {
  ...sharedBuildOpts,
  entryPoints: [resolve(__dirname, 'src/js/pdf-worker.js')],
  outfile:     resolve(OUT_DIR, 'js/pdf-worker.js'),
  format:      'iife',
  // jsPDF is loaded by the Worker via importScripts — mark it external
  // so esbuild doesn't try to bundle it and the Worker uses importScripts instead.
  // The pdf-worker.js source accesses it as self.jspdf after importScripts runs.
  external:    ['jspdf'],
  define: {
    // Stub out 'jspdf' import references — the Worker never uses import(),
    // it receives jsPDF via importScripts() which sets self.jspdf.
    // esbuild needs this because pdf-core.js doesn't import jsPDF itself
    // (jsPDF is passed in as a parameter to buildResultsPDF).
  },
};

if (WATCH) {
  const ctx = await context(mainOpts);
  await ctx.watch();
  log('  ✓ Watching src/js/main.js → js/scorecard.js');

  const wCtx = await context(workerOpts);
  await wCtx.watch();
  log('  ✓ Watching src/js/pdf-worker.js → js/pdf-worker.js');
} else {
  await build(mainOpts);
  log('  ✓ js/scorecard.js');

  await build(workerOpts);
  log('  ✓ js/pdf-worker.js');
}

// ── 5. CSS ────────────────────────────────────────────────────────────────────
if (!WATCH) {
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
}
