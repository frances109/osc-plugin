/**
 * pdf.js
 * Public façade for PDF generation.
 * Hides the Worker / lazy-load complexity from the rest of the application.
 *
 * Strategy:
 *   1. Spawn pdf-worker.js and let it build the PDF entirely off the main thread.
 *      The Worker loads jsPDF via importScripts() — main thread never blocks.
 *   2. If Workers are unavailable (old browser, file:// preview without HTTPS),
 *      fall back to a lazy dynamic import() of jsPDF on the main thread.
 *      jsPDF is ~360 KB — it is NOT in the initial bundle chunk.
 *
 * Export:
 *   generatePDFBase64(data, urls) → Promise<string>
 *
 * `data` shape:
 *   {
 *     fullname:   string,
 *     company:    string,
 *     tierTitle:  string,
 *     tierBody:   string,
 *     goalLine:   string,
 *     goalAnswer: string,
 *     insights:   string[],
 *   }
 *
 * `urls` shape:
 *   {
 *     worker: string,   // URL to plugin/dist/js/pdf-worker.js
 *     jspdf:  string,   // URL to plugin/dist/js/vendor/jspdf.umd.min.js
 *   }
 */

import { buildResultsPDF } from './pdf-core.js';

// WORKER TIMEOUT — generous for slow mobile devices
const WORKER_TIMEOUT_MS = 15_000;

// ── Worker path ───────────────────────────────────────────────────────────────

/**
 * Spawn pdf-worker.js, post data, and resolve with the base64 PDF string.
 *
 * @param {object} data
 * @param {{ worker: string, jspdf: string }} urls
 * @returns {Promise<string>}
 */
function generateViaWorker(data, urls) {
  return new Promise((resolve, reject) => {
    let worker;

    try {
      worker = new Worker(urls.worker);
    } catch (err) {
      reject(new Error(`Worker construction failed: ${err.message}`));
      return;
    }

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('PDF Worker timed out.'));
    }, WORKER_TIMEOUT_MS);

    worker.onmessage = ({ data: reply }) => {
      clearTimeout(timeout);
      worker.terminate();

      if (reply.type === 'done') {
        resolve(reply.base64);
      } else {
        reject(new Error(reply.message ?? 'PDF Worker returned an error.'));
      }
    };

    worker.onerror = err => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error(err.message ?? 'PDF Worker threw an uncaught error.'));
    };

    worker.postMessage({ type: 'generate', jsPDFUrl: urls.jspdf, ...data });
  });
}

// ── Main-thread fallback ──────────────────────────────────────────────────────

// Cache the jsPDF constructor after the first lazy import so we pay the
// network cost at most once per session.
let _cachedJsPDF = null;

/**
 * Lazy-import jsPDF on the main thread and call buildResultsPDF() directly.
 * Only used when Workers are unavailable.
 *
 * @param {object} data
 * @returns {Promise<string>}
 */
async function generateOnMainThread(data) {
  if (!_cachedJsPDF) {
    // Dynamic import — esbuild splits jsPDF into a separate chunk.
    // The browser fetches it only when this code path is reached.
    const module  = await import('jspdf');
    _cachedJsPDF  = module.jsPDF;
  }

  return buildResultsPDF(_cachedJsPDF, data);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate the personalised results PDF as a base64 string.
 * Tries the Worker path first; falls back to main-thread generation.
 * Returns '' if both paths fail (prevents a broken submission).
 *
 * @param {object} data   PDF content (see module docstring)
 * @param {{ worker: string, jspdf: string }} urls
 * @returns {Promise<string>}
 */
export async function generatePDFBase64(data, urls) {
  const workersSupported = typeof Worker !== 'undefined' && !!urls?.worker;

  if (workersSupported) {
    try {
      return await generateViaWorker(data, urls);
    } catch (err) {
      console.warn('[pdf] Worker path failed — falling back to main thread:', err.message);
    }
  }

  try {
    return await generateOnMainThread(data);
  } catch (err) {
    console.error('[pdf] Main-thread generation also failed:', err);
    return '';
  }
}
