/**
 * main.js
 * Entry point for the Outsourcing Readiness Scorecard.
 *
 * This file wires modules together and handles the top-level event listeners.
 * It contains no business logic of its own — all logic lives in the modules it imports.
 *
 * Module map:
 *   data.js          CONFIG, SCORING_RULES, TIERS
 *   validation.js    isValidEmailFormat, isTestEmail
 *   scoring.js       calcScore, matchTier, buildInsights, getGoalLabel
 *   form-builder.js  buildForm()
 *   quiz.js          createQuizState, updateNav, goNext, goPrev, validateCluster
 *   recaptcha.js     (used internally by api.js)
 *   api.js           sendSubmitPayload, sendCtaEmail
 *   pdf.js           generatePDFBase64  (lazy — jsPDF not in initial bundle)
 *   pdf-worker.js    (separate bundle — spawned by pdf.js as a Web Worker)
 *   download.js      downloadReadinessGuide
 *   popup.js         showPopup
 *
 * window.MagellanConfig is injected by page-scorecard.php before this script loads:
 *   restUrl          — /wp-json/outsourcing-scorecard/v1/submit
 *   nonce            — wp_rest nonce
 *   recaptchaSiteKey — reCAPTCHA v3 site key (empty = skip)
 *   readinessPdfUrl  — URL to plugin/pdf/readiness-guide.pdf
 *   wpHomeUrl        — WP site home URL (used on popup close)
 *   itiUtilsUrl      — URL to plugin/dist/js/vendor/utils.js
 *   pdfWorkerUrl     — URL to plugin/dist/js/pdf-worker.js
 *   jsPDFUrl         — URL to plugin/dist/js/vendor/jspdf.umd.min.js
 */

import { buildForm }                                       from './form-builder.js';
import { createQuizState, updateNav, goNext, goPrev,
         validateCluster }                                 from './quiz.js';
import { buildInsights, matchTier, calcScore, getGoalLabel } from './scoring.js';
import { isValidEmailFormat, isTestEmail }                 from './validation.js';
import { sendSubmitPayload, sendCtaEmail }                 from './api.js';
import { generatePDFBase64 }                               from './pdf.js';
import { downloadReadinessGuide }                          from './download.js';
import { showPopup }                                       from './popup.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// jQuery and intl-tel-input are loaded as global <script> tags by the PHP
// template before this module executes. They are not bundled here.
/* global $, intlTelInput, grecaptcha */

const MG = window.MagellanConfig || {};

// ── intl-tel-input instance (shared across validation + submission) ────────────
let itiInstance = null;

function initPhoneInput() {
  const phoneEl = document.getElementById('phone');
  if (!phoneEl || typeof intlTelInput !== 'function') return;

  itiInstance = intlTelInput(phoneEl, {
    initialCountry:     'auto',
    separateDialCode:   true,
    preferredCountries: ['us', 'ph', 'au', 'gb'],
    geoIpLookup: cb => {
      $.getJSON('https://ipapi.co/json')
        .done(d  => cb(d.country_code))
        .fail(() => cb('us'));
    },
    utilsScript: MG.itiUtilsUrl
      || 'https://cdn.jsdelivr.net/npm/intl-tel-input@21.1.4/build/js/utils.js',
  });
}

// ── PDF generation helper ─────────────────────────────────────────────────────

/**
 * Build the PDF data object from form state and call generatePDFBase64.
 * Returns a Promise<string> — empty string if generation fails.
 *
 * @param {FormData} formData
 * @param {object}   tier
 * @param {string[]} insights
 * @returns {Promise<string>}
 */
function buildPDF(formData, tier, insights) {
  const data = {
    fullname:   formData.get('fullname') ?? '',
    company:    formData.get('company')  ?? '',
    tierTitle:  tier.title,
    tierBody:   tier.body,
    goalLine:   tier.goalLine,
    goalAnswer: getGoalLabel(formData),  // human-readable q14 label e.g. "Scalability"
    insights,
  };

  return generatePDFBase64(data, {
    worker: MG.pdfWorkerUrl ?? '',
    jspdf:  MG.jsPDFUrl     ?? '',
  });
}

// ── Inline field-level validation wiring ─────────────────────────────────────

function wireInlineValidation($form) {
  // Clear errors as the user types/changes
  $form.on('change input', '[required]', function () {
    if ($(this).val()) $(this).removeClass('is-invalid');
  });

  // Checkbox group — clear error as soon as one is checked
  $form.on('change', '.q4check', function () {
    if ($('.q4check').is(':checked')) {
      $('#q4error').addClass('d-none');
      $('.q4check').removeClass('is-invalid');
    }
  });

  // Email — validate on blur
  $form.on('blur', '#email', function () {
    const val = $(this).val().trim();
    if (!val) return;

    const $fb = $(this).next('.invalid-feedback');
    if (!isValidEmailFormat(val)) {
      $(this).addClass('is-invalid');
      $fb.text('Please enter a valid email address.');
    } else if (isTestEmail(val)) {
      $(this).addClass('is-invalid');
      $fb.text('Please use a real business email address.');
    } else {
      $(this).removeClass('is-invalid');
      $fb.text('');
    }
  });

  // Phone — validate on blur
  $form.on('blur', '#phone', function () {
    if (!itiInstance || !$(this).val().trim()) return;

    if (!itiInstance.isValidNumber()) {
      $(this).addClass('is-invalid');
      $(this).closest('.col-12')
        .find('.invalid-feedback')
        .text('Please enter a valid phone number for the selected country.');
    } else {
      $(this).removeClass('is-invalid');
    }
  });
}

// ── Form submit handler ───────────────────────────────────────────────────────

async function handleSubmit(e, state) {
  e.preventDefault();

  if (!validateCluster(state.$clusters.eq(state.step), itiInstance)) return;

  const formData = new FormData(e.currentTarget);
  const score    = calcScore(formData);
  const tier     = matchTier(score);
  const insights = buildInsights(formData);

  // Show popup immediately — user sees their result without waiting for the PDF
  showPopup(formData, tier, insights, {
    config:      MG,
    itiInstance,
    onCtaEmail:  sendCtaEmail,
    onDownload:  downloadReadinessGuide,
  });

  // Disable the submit button to prevent double-submit
  $('#submitBtn').prop('disabled', true);

  // Generate PDF in the background (Worker), then POST everything to WordPress
  const pdfBase64 = await buildPDF(formData, tier, insights);
  sendSubmitPayload(formData, tier, insights, itiInstance, pdfBase64, MG);
}

// ── Boot ──────────────────────────────────────────────────────────────────────

$(document).ready(function () {

  // 1. Render all quiz clusters
  buildForm();

  // 2. Create navigation state (must run after buildForm so .cluster exists)
  const state = createQuizState();
  state.$clusters.hide();
  state.$clusters.eq(0).show();
  updateNav(state);

  // 3. Phone input
  initPhoneInput();

  // 4. Landing page transitions
  $('#start-btn').on('click', () => {
    $('.landing-grid').fadeOut(250, () => {
      $('#quizWrapper').removeClass('d-none').hide().fadeIn(300);
    });
  });

  $('#back-btn').on('click', () => {
    $('#quizWrapper').addClass('d-none');
    $('.landing-grid').fadeIn(300);
  });

  // 5. Step navigation
  $('#prevBtn, #prevBtnMobile').on('click', () => goPrev(state));
  $('#nextBtn, #nextBtnMobile').on('click', () => goNext(state, itiInstance));

  // 6. Inline field validation
  wireInlineValidation($('#quizForm'));

  // 7. Form submit
  $('#quizForm').on('submit', e => handleSubmit(e, state));

  // 8. Popup close — redirect to WP home after 3 s
  $('#closePopup').on('click', () => {
    $('#overlay, #popup').addClass('d-none');
    const home = MG.wpHomeUrl || `${window.location.origin}/`;
    setTimeout(() => { window.location.href = home; }, 3000);
  });

});
