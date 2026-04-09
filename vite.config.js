// vite.config.js
// ─────────────────────────────────────────────────────────────
//  npm run dev     → hot-reload dev server at http://localhost:3000
//                    opens src/preview/scorecard.html automatically
//  npm run build   → minifies src/ → plugin/dist/  (via build.mjs)
//  npm run preview → Vite static preview of the last build
//
//  NOTE: scorecard.js is a plain IIFE with no ES module imports
//  at the source level, so Rollup/Vite cannot bundle it as 'iife'
//  with multiple inputs. The build script (build.mjs) uses esbuild
//  + clean-css directly for production. Vite is used only for the
//  dev server (hot CSS reloading, instant preview).
// ─────────────────────────────────────────────────────────────

import { defineConfig } from 'vite';
import { resolve }      from 'path';

export default defineConfig({
  base: './',

  server: {
    port: 3000,
    open: '/src/preview/scorecard.html',
    host: true,
  },

  resolve: {
    alias: {
      '~bootstrap-icons': resolve(__dirname, 'node_modules/bootstrap-icons'),
    },
  },
});
