/**
 * pdf-worker.js
 * Web Worker entry point — runs entirely off the main thread.
 *
 * Responsibilities:
 *   1. Receive a 'generate' message from the main thread.
 *   2. Load jsPDF via importScripts() from the URL provided by the main thread
 *      (points to the local vendor copy in plugin/dist/js/vendor/).
 *   3. Call buildResultsPDF() from pdf-core.js with the jsPDF constructor.
 *   4. Post the base64 result back, or post an error on failure.
 *
 * This file is bundled as a *separate* esbuild entry point by build.mjs so it
 * produces plugin/dist/js/pdf-worker.js — a self-contained Worker script that
 * includes pdf-core.js inline (no further network requests from inside the Worker).
 *
 * Message protocol — Main → Worker:
 *   {
 *     type:       'generate',
 *     jsPDFUrl:   string,     // URL to jspdf.umd.min.js (local vendor copy)
 *     fullname:   string,
 *     company:    string,
 *     tierTitle:  string,
 *     tierBody:   string,
 *     goalLine:   string,
 *     goalAnswer: string,
 *     insights:   string[],
 *   }
 *
 * Worker → Main:
 *   { type: 'done',  base64: string }
 *   { type: 'error', message: string }
 */

import { buildResultsPDF } from './pdf-core.js';

/* global self, importScripts */

self.onmessage = function handleMessage(event) {
  const msg = event.data;
  if (msg.type !== 'generate') return;

  try {
    // Load jsPDF UMD synchronously into the Worker scope.
    // importScripts() is the standard way to load scripts in a Worker.
    // It sets self.jspdf = { jsPDF } on the global Worker scope.
    importScripts(msg.jsPDFUrl);

    if (typeof self.jspdf === 'undefined' || typeof self.jspdf.jsPDF !== 'function') {
      throw new Error('jsPDF failed to initialise after importScripts().');
    }

    const base64 = buildResultsPDF(self.jspdf.jsPDF, {
      fullname:   msg.fullname,
      company:    msg.company,
      tierTitle:  msg.tierTitle,
      tierBody:   msg.tierBody,
      goalLine:   msg.goalLine,
      goalAnswer: msg.goalAnswer,
      insights:   msg.insights,
    });

    self.postMessage({ type: 'done', base64 });

  } catch (err) {
    self.postMessage({ type: 'error', message: err.message ?? String(err) });
  }
};
