/**
 * recaptcha.js
 * Wraps the reCAPTCHA v3 execute() call in a Promise.
 * Returns a dev-bypass token when no site key is configured.
 *
 * Export:
 *   getRecaptchaToken(siteKey) → Promise<string>
 */

/**
 * Obtain a reCAPTCHA v3 token.
 * Resolves immediately with 'dev-bypass' when siteKey is empty (local dev).
 *
 * @param {string} siteKey  window.MagellanConfig.recaptchaSiteKey
 * @returns {Promise<string>}
 */
export function getRecaptchaToken(siteKey) {
  return new Promise(resolve => {
    if (!siteKey) { resolve('dev-bypass'); return; }

    const execute = () => {
      grecaptcha.ready(() => {
        grecaptcha
          .execute(siteKey, { action: 'quiz_submit' })
          .then(resolve)
          .catch(() => resolve(''));
      });
    };

    if (typeof grecaptcha !== 'undefined') {
      execute();
      return;
    }

    // Wait up to 10s for the reCAPTCHA script to load
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 200;
      if (typeof grecaptcha !== 'undefined') {
        clearInterval(interval);
        execute();
      } else if (elapsed >= 10000) {
        clearInterval(interval);
        resolve(''); // Give up — server will skip if secret unconfigured
      }
    }, 200);
  });
}