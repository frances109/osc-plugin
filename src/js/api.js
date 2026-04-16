/**
 * api.js
 * WordPress REST API communication layer.
 *
 * All functions are pure async — no DOM access.
 *
 * Exports:
 *   postToWP(payload, config)               → Promise<object>
 *   buildSubmitPayload(formData, tier, insights, itiInstance, pdfBase64)
 *   sendSubmitPayload(formData, tier, insights, itiInstance, pdfBase64, config)
 *   sendCtaEmail(action, formData, tier, itiInstance, config)  → Promise<object>
 */

import { getRecaptchaToken } from './recaptcha.js';
import { calcScore, extractAnswers } from './scoring.js';

// ── Core POST ─────────────────────────────────────────────────────────────────

/**
 * POST a JSON payload to the WP REST endpoint.
 * Attaches the reCAPTCHA token and WP nonce before sending.
 *
 * @param {object} payload
 * @param {{ restUrl: string, nonce: string, recaptchaSiteKey: string }} config
 * @returns {Promise<object>}
 */
export async function postToWP(payload, config) {
  const token = await getRecaptchaToken(config.recaptchaSiteKey);

  const headers = { 'Content-Type': 'application/json' };
  if (config.nonce) headers['X-WP-Nonce'] = config.nonce;

  const response = await fetch(config.restUrl, {
    method:  'POST',
    headers,
    body:    JSON.stringify({ ...payload, recaptcha_token: token }),
  });

  return response.json();
}

// ── Payload builders ──────────────────────────────────────────────────────────

/**
 * Assemble the full quiz submission payload from form data, tier, and PDF.
 * Separates CTA-only actions (schedule/consult) from the PDF-bearing submit.
 *
 * @param {FormData}    formData
 * @param {object}      tier         matched TIERS entry
 * @param {string[]}    insights     array of insight messages
 * @param {object|null} itiInstance  intl-tel-input instance
 * @param {string}      pdfBase64    base64-encoded PDF (may be '')
 * @returns {object}
 */
export function buildSubmitPayload(formData, tier, insights, itiInstance, pdfBase64) {
  const fullname   = formData.get('fullname') ?? '';
  const phone      = itiInstance ? itiInstance.getNumber() : (formData.get('phone') ?? '');
  const pdfFilename = fullname
    ? `Magellan-Readiness-Results-${fullname.replace(/\s+/g, '-')}.pdf`
    : 'Magellan-Outsourcing-Readiness-Results.pdf';

  // Strip 'download' CTAs — those are handled client-side only
  const tierCtas = (tier.ctas ?? [])
    .filter(c => c.action !== 'download')
    .map(c => ({ label: c.label, action: c.action }));

  return {
    fullname,
    email:        formData.get('email')   ?? '',
    phone,
    company:      formData.get('company') ?? '',
    tier:         tier.title,
    tier_body:    tier.body,
    goal_line:    tier.goalLine,
    goal_answer:  formData.get('q14')     ?? '',
    score:        calcScore(formData),
    answers:      extractAnswers(formData),
    insights,
    ctas:         tierCtas,
    pdf_base64:   pdfBase64,
    pdf_filename: pdfFilename,
  };
}

/**
 * Fire-and-forget: generate the PDF, build the payload, and POST to WordPress.
 * Errors are logged to console — a submission failure should never block the popup.
 *
 * @param {FormData}    formData
 * @param {object}      tier
 * @param {string[]}    insights
 * @param {object|null} itiInstance
 * @param {string}      pdfBase64
 * @param {object}      config       window.MagellanConfig
 */
export function sendSubmitPayload(formData, tier, insights, itiInstance, pdfBase64, config) {
  if (!config.restUrl) return;   // dev preview — graceful no-op

  const payload = buildSubmitPayload(formData, tier, insights, itiInstance, pdfBase64);

  postToWP(payload, config)
    .then(res  => console.log('[scorecard] Submission accepted:', res))
    .catch(err => console.error('[scorecard] Submission failed:', err));
}

/**
 * Send a CTA contact-only email to the admin (schedule or consult button click).
 * Returns the fetch Promise so the popup can reflect success/failure.
 *
 * @param {'schedule'|'consult'} action
 * @param {FormData}    formData
 * @param {object}      tier
 * @param {object|null} itiInstance
 * @param {object}      config
 * @returns {Promise<object>}
 */
export function sendCtaEmail(action, formData, tier, itiInstance, config) {
  if (!config.restUrl) {
    return Promise.reject(new Error('No REST endpoint in dev preview.'));
  }

  const phone = itiInstance ? itiInstance.getNumber() : (formData.get('phone') ?? '');

  return postToWP({
    fullname:   formData.get('fullname') ?? '',
    email:      formData.get('email')    ?? '',
    phone,
    company:    formData.get('company')  ?? '',
    tier:       tier.title,
    tier_body:  '',
    goal_line:  '',
    score:      calcScore(formData),
    answers:    { cta_action: action },
    insights:   [],
    is_cta:     true,
  }, config);
}
