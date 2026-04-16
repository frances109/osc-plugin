/**
 * download.js
 * Handles the "Download Our Readiness Guide" CTA.
 * Fetches the static PDF from plugin/pdf/ and triggers a browser download.
 *
 * Export:
 *   downloadReadinessGuide(pdfUrl) → void
 */

/**
 * Download the static readiness-guide.pdf.
 * Disables the button during the fetch and restores it on completion.
 *
 * @param {string} pdfUrl  window.MagellanConfig.readinessPdfUrl
 */
export function downloadReadinessGuide(pdfUrl) {
  if (!pdfUrl) {
    alert('PDF not available. Please try again later.');
    return;
  }

  const $btn   = $('[data-action="download"]');
  const origTxt = $btn.text();

  $btn.prop('disabled', true).text('Downloading\u2026');

  fetch(pdfUrl)
    .then(res => {
      if (!res.ok) throw new Error(`PDF not found (${res.status})`);
      return res.blob();
    })
    .then(blob => {
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href     = url;
      link.download = 'Outsourcing-Readiness-Checklist.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      $btn.prop('disabled', false).text(origTxt);
    })
    .catch(() => {
      $btn.prop('disabled', false).text(origTxt);
      alert('Could not download the guide. Please try again later.');
    });
}
