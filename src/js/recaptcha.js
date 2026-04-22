/**
 * recaptcha.js
 * Wraps the reCAPTCHA v3 execute() call in a Promise.
 *
 * FIX: The previous version resolved with '' on timeout/error, which the
 * PHP server interpreted as "score too low" — a confusing, misleading error.
 *
 * Now resolves with 'not-loaded' on any client-side failure so the PHP
 * server can return a clear, actionable message:
 *   "Security check could not complete. Please disable any ad blockers..."
 *
 * Resolves with 'dev-bypass' when no site key is configured (local dev).
 *
 * Export:
 *   getRecaptchaToken(siteKey) → Promise<string>
 */

/**
 * Obtain a reCAPTCHA v3 token.
 *
 * @param {string} siteKey  window.MagellanConfig.recaptchaSiteKey
 * @returns {Promise<string>}
 */
export function getRecaptchaToken(siteKey) {
  return new Promise(resolve => {
    // No key configured → dev preview, skip reCAPTCHA entirely.
    if (!siteKey) {
      resolve('dev-bypass');
      return;
    }

    const execute = () => {
      grecaptcha.ready(() => {
        grecaptcha
          .execute(siteKey, { action: 'quiz_submit' })
          .then(token => {
            // Resolve with the real token, or 'not-loaded' if the
            // execute call somehow returned a falsy value.
            resolve(token || 'not-loaded');
          })
          .catch(err => {
            console.warn('[scorecard] reCAPTCHA execute() failed:', err);
            // Resolve with sentinel so server returns a meaningful message
            // rather than the generic "score too low".
            resolve('not-loaded');
          });
      });
    };

    if (typeof grecaptcha !== 'undefined') {
      execute();
      return;
    }

    // Poll for up to 10 s — handles async/defer script loading.
    // If still not available after 10 s, the script is blocked (ad blocker,
    // strict CSP, network error) and we surface a clear sentinel token.
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 200;
      if (typeof grecaptcha !== 'undefined') {
        clearInterval(interval);
        execute();
      } else if (elapsed >= 10_000) {
        clearInterval(interval);
        console.warn('[scorecard] reCAPTCHA script did not load within 10 s. Token: not-loaded');
        resolve('not-loaded');
      }
    }, 200);
  });
}