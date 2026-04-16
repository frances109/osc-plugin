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
    if (!siteKey) {
      resolve('dev-bypass');
      return;
    }

    if (typeof grecaptcha === 'undefined') {
      resolve('not-loaded');
      return;
    }

    grecaptcha.ready(() => {
      grecaptcha
        .execute(siteKey, { action: 'quiz_submit' })
        .then(resolve)
        .catch(() => resolve(''));
    });
  });
}
