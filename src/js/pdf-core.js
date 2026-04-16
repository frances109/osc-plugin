/**
 * pdf-core.js
 * All jsPDF drawing primitives and full document assembly.
 *
 * Pure functions — no Worker API, no DOM, no window references.
 * Imported by both pdf-worker.js (Worker context) and pdf.js (main-thread fallback).
 *
 * Single public export:
 *   buildResultsPDF(jsPDF, data) → string   base64-encoded PDF
 *
 * `data` shape:
 *   {
 *     fullname:   string,
 *     company:    string,
 *     tierTitle:  string,
 *     tierBody:   string,
 *     goalLine:   string,
 *     goalAnswer: string,
 *     insights:   string[],
 *   }
 */

// ── Brand palette (A4 mm, matching scorecard.css variables) ───────────────────

const C = {
  navy:     [15,  31,  61],   // --navy
  navyMid:  [26,  50,  96],   // --navy-mid
  accent:   [84, 200, 239],   // --accent
  white:    [255, 255, 255],
  offWhite: [244, 246, 251],  // --light
  muted:    [107, 122, 153],  // --muted
  text:     [30,  40,  60],
};

// A4 page dimensions and margins (mm)
const PW = 210;
const PH = 297;
const ML = 18;
const MR = 18;
const CW = PW - ML - MR;   // usable content width

// ── Colour helpers ────────────────────────────────────────────────────────────

const pF = (doc, c) => doc.setFillColor(c[0], c[1], c[2]);
const pD = (doc, c) => doc.setDrawColor(c[0], c[1], c[2]);
const pT = (doc, c) => doc.setTextColor(c[0], c[1], c[2]);

// ── Primitive drawing functions ───────────────────────────────────────────────

function drawCover(doc) {
  pF(doc, C.navy);    doc.rect(0, 0, PW, PH, 'F');
  pF(doc, C.accent);  doc.rect(0, 0, PW, 4, 'F');
                      doc.rect(0, PH - 4, PW, 4, 'F');
  pF(doc, C.navyMid); doc.triangle(PW - 80, 0, PW, 0, PW, 90, 'F');

  pT(doc, C.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('MAGELLAN SOLUTIONS', ML, 30);

  pT(doc, C.white);
  doc.setFontSize(32);
  doc.text('Outsourcing', ML, 110);
  doc.text('Readiness',   ML, 125);

  pT(doc, C.accent);
  doc.text('Results', ML, 140);

  pT(doc, [180, 195, 220]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Your personalised outsourcing readiness report.', ML, 158);
}

function drawPageHeader(doc, label) {
  pF(doc, C.navy);
  doc.rect(0, 0, PW, 18, 'F');

  pT(doc, C.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('MAGELLAN SOLUTIONS  \u00B7  OUTSOURCING READINESS RESULTS', ML, 11);

  pT(doc, [180, 195, 220]);
  doc.setFont('helvetica', 'normal');
  doc.text(label, PW - MR, 11, { align: 'right' });
}

function drawPageFooter(doc, pageNum) {
  pF(doc, C.offWhite);
  doc.rect(0, PH - 12, PW, 12, 'F');

  pT(doc, C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `\u00A9 ${new Date().getFullYear()} Magellan Solutions. All rights reserved.`,
    ML, PH - 4.5,
  );
  doc.text(`Page ${pageNum}`, PW - MR, PH - 4.5, { align: 'right' });
}

// ── Reusable layout blocks ────────────────────────────────────────────────────

/**
 * Accent-bar section heading. Returns new y position.
 */
function sectionHeading(doc, y, text) {
  pF(doc, C.accent);
  doc.rect(ML, y - 1, 4, 8, 'F');

  pT(doc, C.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(text, ML + 8, y + 5);

  return y + 18;
}

/**
 * Wrapping body paragraph. Returns new y position.
 */
function paragraph(doc, y, text, {
  color    = C.text,
  bold     = false,
  fontSize = 10,
  maxWidth = CW,
} = {}) {
  pT(doc, color);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, ML, y);
  return y + lines.length * (fontSize * 0.45) + 4;
}

/**
 * Highlighted callout box with accent border. Returns new y position.
 */
function callout(doc, y, text, height = 20) {
  pF(doc, C.offWhite);
  pD(doc, C.accent);
  doc.setLineWidth(0.5);
  doc.roundedRect(ML, y, CW, height, 3, 3, 'FD');

  pT(doc, C.navy);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(text, CW - 10);
  doc.text(lines, ML + 5, y + 7);

  return y + height + 6;
}

/**
 * Bulleted list with accent dots. Returns new y position.
 */
function bulletList(doc, y, items) {
  pT(doc, C.text);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  for (const item of items) {
    pF(doc, C.accent);
    doc.circle(ML + 2, y - 1.5, 1.2, 'F');

    pT(doc, C.text);
    const lines = doc.splitTextToSize(item, CW - 10);
    doc.text(lines, ML + 8, y);
    y += lines.length * 5.5 + 2;
  }

  return y + 2;
}

/**
 * Thin horizontal rule. Returns new y position.
 */
function rule(doc, y) {
  pD(doc, [220, 225, 235]);
  doc.setLineWidth(0.3);
  doc.line(ML, y, ML + CW, y);
  return y + 8;
}

/**
 * Numbered step box (icon circle + title + body). Returns new y position.
 */
function stepBox(doc, y, num, title, body) {
  const BOX_H = 28;

  pF(doc, C.offWhite);
  doc.roundedRect(ML, y, CW, BOX_H, 3, 3, 'F');

  // Number circle
  pF(doc, C.navy);
  doc.circle(ML + 10, y + 14, 7, 'F');
  pT(doc, C.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(String(num), ML + 10, y + 17.5, { align: 'center' });

  // Title
  pT(doc, C.navy);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, ML + 22, y + 12);

  // Body
  pT(doc, C.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const lines = doc.splitTextToSize(body, CW - 28);
  doc.text(lines, ML + 22, y + 20);

  return y + BOX_H + 5;
}

/**
 * Personalised tier result card. Returns new y position.
 */
function tierCard(doc, y, tierTitle, tierBody, goalLine, goalAnswer, insights) {
  // Title banner
  pF(doc, C.navy);
  doc.roundedRect(ML, y, CW, 14, 3, 3, 'F');
  pT(doc, C.accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(tierTitle, ML + 6, y + 9.5);
  y += 20;

  y  = paragraph(doc, y, tierBody, { color: C.text });
  y += 4;
  y  = callout(doc, y, `Since your primary goal is ${goalAnswer}, ${goalLine}`, 18);
  y  = paragraph(doc, y, 'Key Insights:', { bold: true, color: C.navyMid });
  y  = bulletList(doc, y + 2, insights);

  return y;
}

// ── Static page content ───────────────────────────────────────────────────────

function addIntroductionPage(doc) {
  doc.addPage();
  drawPageHeader(doc, 'INTRODUCTION');
  drawPageFooter(doc, 2);
  let y = 30;

  y = sectionHeading(doc, y, 'What is Outsourcing Readiness?');
  y = paragraph(doc, y,
    'Outsourcing readiness refers to the degree to which your organisation has the operational, '
    + 'financial, and cultural foundations required to successfully delegate functions to an external '
    + 'team. It is not simply a question of whether you want to outsource \u2014 it is about whether '
    + 'your organisation is structurally prepared to make outsourcing work.');
  y += 4;
  y = callout(doc, y,
    'Companies that outsource without readiness often face quality issues, communication breakdowns, '
    + 'and wasted investment. This guide helps you avoid those pitfalls.', 22);
  y = paragraph(doc, y,
    'The Magellan Solutions Readiness Assessment evaluates five dimensions:',
    { bold: true, color: C.navy });
  bulletList(doc, y + 2, [
    'Company Profile \u2014 who you are and your industry context',
    'Operational Challenges \u2014 the pain points driving your outsourcing interest',
    'Process & Systems \u2014 your documentation and tooling maturity',
    'Outsourcing Experience & Concerns \u2014 what you know and what worries you',
    'Decision Readiness \u2014 your budget, timeline, and authority to act',
  ]);
}

function addTiersPage(doc) {
  doc.addPage();
  drawPageHeader(doc, 'READINESS TIERS');
  drawPageFooter(doc, 3);
  let y = 30;

  y = sectionHeading(doc, y, 'The Three Readiness Tiers');
  y = paragraph(doc, y,
    'Your assessment score places you in one of three tiers. Understanding your tier is the '
    + 'starting point for knowing what to do next.');
  y += 6;
  y = stepBox(doc, y, 1,
    'Outsourcing Ready  (Score 14\u201316)',
    'Strong processes, tools, and decision authority are in place. You can begin outsourcing now with high confidence of success.');
  y = stepBox(doc, y, 2,
    'Partially Ready  (Score 9\u201313)',
    'Good foundations exist but gaps in documentation, tools, or buy-in may limit early results. Targeted preparation will significantly improve outcomes.');
  y = stepBox(doc, y, 3,
    'Not Ready Yet  (Score 0\u20138)',
    'Outsourcing before addressing key structural gaps often leads to failure. A focused readiness roadmap should come first.');
  y += 4;
  y = rule(doc, y);
  paragraph(doc, y,
    'Regardless of your tier, outsourcing is achievable. The tiers help you time your decision and '
    + 'set realistic expectations \u2014 not to discourage action, but to make your action count.',
    { color: C.muted });
}

function addNextStepsPage(doc) {
  doc.addPage();
  drawPageHeader(doc, 'NEXT STEPS');
  drawPageFooter(doc, 4);
  let y = 30;

  y = sectionHeading(doc, y, 'What to Do Next');
  const steps = [
    {
      n: 1, t: 'Review your score and tier',
      b: 'Understand the specific factors that influenced your result. Each insight in your results indicates an area of strength or a gap to address.',
    },
    {
      n: 2, t: 'Address your critical gaps first',
      b: 'If you scored Partially Ready or Not Ready, prioritise closing the gaps with the highest impact: documentation, tooling, and stakeholder alignment.',
    },
    {
      n: 3, t: 'Define the scope of outsourcing',
      b: 'Identify 1\u20133 specific functions to outsource initially. Start narrow, prove the model, then expand. Avoid trying to outsource everything at once.',
    },
    {
      n: 4, t: 'Build your selection criteria',
      b: 'Determine what you need in an outsourcing partner: industry experience, communication standards, team size, pricing model, and cultural alignment.',
    },
    {
      n: 5, t: 'Engage with a trusted provider',
      b: 'Magellan Solutions specialises in helping SMEs and growing companies outsource the right way. Schedule a strategy call to discuss your specific situation.',
    },
  ];
  for (const s of steps) y = stepBox(doc, y, s.n, s.t, s.b);
}

function addPersonalisedResultsPage(doc, data) {
  doc.addPage();
  drawPageHeader(doc, 'YOUR RESULTS');
  drawPageFooter(doc, 5);
  let y = 30;

  y = sectionHeading(doc, y, 'Your Personalised Assessment Results');

  if (data.fullname) {
    const byline = data.company
      ? `Prepared for: ${data.fullname}  \u00B7  ${data.company}`
      : `Prepared for: ${data.fullname}`;
    y = paragraph(doc, y, byline, { bold: true, color: C.navyMid, fontSize: 10 });
    y += 4;
  }

  tierCard(
    doc, y,
    data.tierTitle, data.tierBody, data.goalLine, data.goalAnswer,
    data.insights ?? [],
  );
}

function addAboutPage(doc, tierTitle) {
  doc.addPage();
  const lastPage = doc.internal.getNumberOfPages();
  drawPageHeader(doc, 'ABOUT MAGELLAN');
  drawPageFooter(doc, lastPage);
  let y = 30;

  y = sectionHeading(doc, y, 'About Magellan Solutions');
  y = paragraph(doc, y,
    'Magellan Solutions is a Philippines-based business process outsourcing (BPO) company founded '
    + 'in 2005, specialising in delivering scalable outsourcing solutions to small and medium-sized '
    + 'businesses worldwide. With 500+ dedicated staff and nearly two decades of industry experience, '
    + 'Magellan Solutions partners with clients across the US, Australia, UK, and beyond to help them '
    + 'reduce operational costs and focus on growth.');
  y += 6;
  y = paragraph(doc, y,
    'We are ISO-certified and HIPAA-compliant, with a track record of delivering measurable results '
    + 'for clients in healthcare, e-commerce, professional services, SaaS, and more.');
  y += 6;
  y = paragraph(doc, y, 'Our Core Services:', { bold: true, color: C.navy });
  y = bulletList(doc, y + 2, [
    'Customer Support & Technical Help Desk',
    'Finance & Accounting (Bookkeeping, AP/AR, Payroll)',
    'Sales Support & Lead Generation / Appointment Setting',
    'Back Office & Data Management',
    'Healthcare Support (Medical Billing, Transcription)',
    'Digital Marketing & Content Operations',
    'IT & Software Support',
  ]);
  y += 4;

  const lower = (tierTitle ?? '').toLowerCase();
  const ctaText = lower.includes('ready!')
    ? 'Your business is ready to outsource. Visit magellan-solutions.com or request a strategy call to start building your custom outsourcing solution.'
    : lower.includes('partially')
      ? "You're almost there. Book a consultation at magellan-solutions.com and we'll help you close the gaps before you outsource."
      : "Building the right foundations makes all the difference. Book a consultation at magellan-solutions.com and we'll create a readiness roadmap for your business.";

  callout(doc, y, ctaText, 20);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build the full personalised results PDF.
 *
 * @param {function} jsPDF  The jsPDF constructor (passed in so this module
 *                          remains independent of how jsPDF is loaded —
 *                          importScripts in Worker, dynamic import() in fallback).
 * @param {object}   data   See module docstring for shape.
 * @returns {string}        Base64-encoded PDF string.
 */
export function buildResultsPDF(jsPDF, data) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Page 1 — Cover
  drawCover(doc);
  drawPageFooter(doc, 1);

  // Pages 2–4 — Static guide content
  addIntroductionPage(doc);
  addTiersPage(doc);
  addNextStepsPage(doc);

  // Page 5 — Personalised results
  addPersonalisedResultsPage(doc, data);

  // Last page — About Magellan
  addAboutPage(doc, data.tierTitle);

  return doc.output('datauristring').split(',')[1];
}
