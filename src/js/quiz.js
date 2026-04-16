/**
 * quiz.js
 * Step-by-step navigation state and per-cluster validation.
 *
 * Exports:
 *   createQuizState()     — returns a fresh { step, $clusters } state object
 *   updateNav(state)      — shows/hides prev/next/submit buttons
 *   goNext(state)         — advances to the next cluster (validates first)
 *   goPrev(state)         — goes back to the previous cluster
 *   validateCluster($cluster, itiInstance) — validates all fields in a cluster
 */

import { isValidEmailFormat, isTestEmail } from './validation.js';

// ── Navigation ────────────────────────────────────────────────────────────────

/**
 * Create the initial quiz navigation state.
 * Call after buildForm() so all .cluster elements exist in the DOM.
 * @returns {{ step: number, $clusters: JQuery }}
 */
export function createQuizState() {
  return { step: 0, $clusters: $('.cluster') };
}

/**
 * Sync the visibility of Prev / Next / Submit controls to the current step.
 * @param {{ step: number, $clusters: JQuery }} state
 */
export function updateNav({ step, $clusters }) {
  const isFirst = step === 0;
  const isLast  = step === $clusters.length - 1;

  $('#prevBtn').toggleClass('d-none', isFirst);
  $('#nextBtn').toggleClass('d-none', isLast);
  $('#prevBtnMobile').css('visibility', isFirst ? 'hidden' : 'visible');
  $('#nextBtnMobile').css('visibility', isLast  ? 'hidden' : 'visible');
  $('#submitBtn').toggleClass('d-none', !isLast);
}

/**
 * Advance one step if the current cluster is valid.
 * @param {{ step: number, $clusters: JQuery }} state
 * @param {object|null} itiInstance  intl-tel-input instance
 */
export function goNext(state, itiInstance) {
  if (!validateCluster(state.$clusters.eq(state.step), itiInstance)) return;
  state.$clusters.eq(state.step).hide();
  state.step++;
  state.$clusters.eq(state.step).show();
  updateNav(state);
}

/**
 * Go back one step unconditionally (no validation needed).
 * @param {{ step: number, $clusters: JQuery }} state
 */
export function goPrev(state) {
  state.$clusters.eq(state.step).hide();
  state.step--;
  state.$clusters.eq(state.step).show();
  updateNav(state);
}

// ── Per-cluster validation ────────────────────────────────────────────────────

/**
 * Validate all required fields in the given cluster element.
 * Marks invalid fields with Bootstrap's .is-invalid class.
 *
 * @param {JQuery}       $cluster
 * @param {object|null}  itiInstance  intl-tel-input instance (may be null in dev)
 * @returns {boolean}  true if all fields are valid
 */
export function validateCluster($cluster, itiInstance) {
  let valid = true;

  // Standard required inputs / selects
  $cluster.find('[required]').each(function () {
    const ok = !!$(this).val();
    $(this).toggleClass('is-invalid', !ok);
    if (!ok) valid = false;
  });

  // Email — format + disposable domain check
  const $email = $cluster.find('#email');
  if ($email.length && $email.val()) {
    const val = $email.val().trim();
    const $fb = $email.next('.invalid-feedback');

    if (!isValidEmailFormat(val)) {
      $email.addClass('is-invalid');
      $fb.text('Please enter a valid email address.');
      valid = false;
    } else if (isTestEmail(val)) {
      $email.addClass('is-invalid');
      $fb.text('Please use a real business email address.');
      valid = false;
    } else {
      $email.removeClass('is-invalid');
    }
  }

  // Phone — intl-tel-input number validation
  const $phone = $cluster.find('#phone');
  if ($phone.length && itiInstance && $phone.val().trim()) {
    if (!itiInstance.isValidNumber()) {
      $phone.addClass('is-invalid');
      $phone.closest('.col-12').find('.invalid-feedback')
        .text('Please enter a valid phone number for the selected country.');
      valid = false;
    } else {
      $phone.removeClass('is-invalid');
    }
  }

  // Checkbox group (q4) — at least one must be checked
  const $checks = $cluster.find('.q4check');
  if ($checks.length) {
    const checked = $checks.is(':checked');
    $('#q4error').toggleClass('d-none', checked);
    $checks.each(function () { $(this).toggleClass('is-invalid', !checked); });
    if (!checked) valid = false;
  }

  return valid;
}
