/**
 * popup.js
 * Results popup — renders the tier result, insights, and CTA buttons.
 * Handles CTA button clicks (schedule, consult, download).
 *
 * Exports:
 *   showPopup(formData, tier, insights, deps)
 *
 * `deps` shape:
 *   {
 *     config:               window.MagellanConfig,
 *     itiInstance:          object|null,
 *     onCtaEmail:           (action, formData, tier, itiInstance, config) → Promise,
 *     onDownload:           (pdfUrl) → void,
 *   }
 */

// ── CTA feedback toast ────────────────────────────────────────────────────────

function showCtaFeedback(action, success) {
  const id = `cta-msg-${action}`;
  if ($(`#${id}`).length) return;   // already showing

  const $msg = $('<p>', { id })
    .addClass(success ? 'cta-feedback cta-feedback--ok' : 'cta-feedback cta-feedback--err')
    .text(success
      ? '\u2713 Your request has been sent. We\'ll be in touch shortly.'
      : '\u26A0 Something went wrong. Please try again or contact us directly.')
    .appendTo('#popupContent');

  setTimeout(() => $msg.fadeOut(400, function () { $(this).remove(); }), 4000);
}

// ── CTA button handler ────────────────────────────────────────────────────────

function handleCtaClick(action, formData, tier, deps) {
  if (action === 'schedule' || action === 'consult') {
    const $btn    = $(`[data-action="${action}"]`);
    const origTxt = action === 'schedule' ? 'Request your Strategy Call' : 'Book a Consultation';

    $btn.prop('disabled', true).text('Sending\u2026');

    deps.onCtaEmail(action, formData, tier, deps.itiInstance, deps.config)
      .then(() => {
        $btn.text('Sent!');
        showCtaFeedback(action, true);
      })
      .catch(() => {
        $btn.prop('disabled', false).text(origTxt);
        showCtaFeedback(action, false);
      });

  } else if (action === 'download') {
    deps.onDownload(deps.config.readinessPdfUrl);
  }
}

// ── Popup content builder ─────────────────────────────────────────────────────

/**
 * Render the results popup content and show the overlay.
 *
 * @param {FormData}   formData
 * @param {object}     tier       matched TIERS entry
 * @param {string[]}   insights   array of insight messages
 * @param {object}     deps       external dependencies (see module docstring)
 */
export function showPopup(formData, tier, insights, deps) {
  const $content = $('#popupContent').empty();
  const goal     = formData.get('q14');
  const isShared = formData.get('q15') !== 'yes';

  // Tier title
  $('<h2>').text(tier.title).appendTo($content);

  // Insights paragraph
  $('<p>').text(insights.join(' ')).appendTo($content);

  // Recommendation
  $('<p>').append(
    $('<strong>').text('Recommendation: ').append($('<br>')),
    document.createTextNode(tier.body),
  ).appendTo($content);

  // Goal line
  $('<p>').append(
    document.createTextNode('Since your primary goal is '),
    $('<strong>').text(goal),
    document.createTextNode(`, ${tier.goalLine}`),
  ).appendTo($content);

  // Decision-maker note
  if (isShared) {
    $('<p>').append(
      $('<strong>').text('Note: ').append($('<br>')),
      document.createTextNode('You may need buy-in from other decision-makers before proceeding.'),
    ).appendTo($content);
  }

  // CTA buttons
  const $btnRow = $('<div>').addClass('cta-btn-row').appendTo($content);
  tier.ctas.forEach(cta => {
    $('<button>', { 'data-action': cta.action })
      .addClass('btn btn-primary me-2 mb-2')
      .text(cta.label)
      .on('click', () => handleCtaClick(cta.action, formData, tier, deps))
      .appendTo($btnRow);
  });

  // Show overlay + popup
  $('#overlay, #popup').removeClass('d-none');
  $('#popup').addClass('d-flex flex-column');
}
