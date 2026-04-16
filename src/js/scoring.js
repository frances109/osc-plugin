/**
 * scoring.js
 * Pure scoring logic — no DOM, no side effects.
 *
 * Exports:
 *   calcScore(formData)      — returns numeric score from SCORING_RULES
 *   matchTier(score)         — returns the matching TIERS entry
 *   buildInsights(formData)  — returns array of insight message strings
 *   extractAnswers(formData) — returns plain key→value answer map for the REST payload
 *   getGoalLabel(formData)   — returns the human-readable q14 option label
 */

import { SCORING_RULES, TIERS, CONFIG } from './data.js';

/**
 * Sum points for every scored field in formData.
 * @param {FormData} formData
 * @returns {number}
 */
export function calcScore(formData) {
  return SCORING_RULES.reduce((total, rule) => {
    const answer = formData.get(rule.field);
    const result = rule.cases[answer] ?? rule.cases['_'];
    return total + (result?.pts ?? 0);
  }, 0);
}

/**
 * Return the first tier whose min threshold is met.
 * TIERS must be ordered highest-min-first (as defined in data.js).
 * @param {number} score
 * @returns {object}
 */
export function matchTier(score) {
  return TIERS.find(t => score >= t.min);
}

/**
 * Build the array of insight messages for the current answers.
 * One message per scoring rule, in rule order.
 * @param {FormData} formData
 * @returns {string[]}
 */
export function buildInsights(formData) {
  return SCORING_RULES.map(rule => {
    const answer = formData.get(rule.field);
    const result = rule.cases[answer] ?? rule.cases['_'];
    return result?.msg ?? '';
  }).filter(Boolean);
}

/**
 * Extract all quiz answers (non-contact fields) into a plain object.
 * Checkbox arrays are joined into comma-separated strings.
 * @param {FormData} formData
 * @returns {Record<string, string>}
 */
export function extractAnswers(formData) {
  const answers = {};
  const contactFields = new Set(['fullname', 'email', 'phone', 'company']);

  for (const [rawKey, value] of formData.entries()) {
    if (contactFields.has(rawKey)) continue;
    const key = rawKey.replace(/\[\]$/, '');            // strip checkbox [] suffix
    answers[key] = answers[key] ? `${answers[key]}, ${value}` : value;
  }

  return answers;
}

/**
 * Return the human-readable label for the q14 answer (primary goal).
 * Used in both the popup and the PDF.
 * @param {FormData} formData
 * @returns {string}
 */
export function getGoalLabel(formData) {
  const val = formData.get('q14');
  if (!val) return '';

  for (const cluster of CONFIG.clusters) {
    for (const q of cluster.questions) {
      if (q.id === 'q14' && q.options) {
        const opt = q.options.find(o => o.value === val);
        if (opt) return opt.label;
      }
    }
  }

  return val;
}
