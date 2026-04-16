/**
 * validation.js
 * Email format checking and disposable/test domain blocking.
 * No DOM dependency — unit-testable in isolation.
 */

const BLOCKED_DOMAINS = new Set([
  'example.com', 'example.org', 'example.net', 'invalid.com',
  'test.com', 'mailinator.com', 'guerrillamail.com', 'tempmail.com',
  'throwaway.email', 'yopmail.com', 'sharklasers.com', 'grr.la',
  'spam4.me', 'trashmail.com', 'dispostable.com', 'fakeinbox.com',
  'maildrop.cc', 'discard.email', 'spamgourmet.com', 'mailnull.com',
]);

const BLOCKED_PREFIXES = /^(tests?\d*|dummy|fake|sample|noreply|no-reply|admin)$/i;

/**
 * Returns true if the email uses a disposable/test domain or a blocked prefix.
 * @param {string} email
 * @returns {boolean}
 */
export function isTestEmail(email) {
  const lower = email.toLowerCase().trim();
  const atIdx = lower.indexOf('@');
  if (atIdx < 0) return true;

  const prefix = lower.slice(0, atIdx);
  const domain = lower.slice(atIdx + 1);

  return BLOCKED_DOMAINS.has(domain) || BLOCKED_PREFIXES.test(prefix);
}

/**
 * Returns true if the string matches a basic email format.
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
