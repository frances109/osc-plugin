/**
 * form-builder.js
 * Builds the quiz form DOM from the CONFIG data structure.
 * Depends on jQuery (window.$) and CONFIG from data.js.
 *
 * Single export:
 *   buildForm() — renders all clusters into #clusterContainer
 */

import { CONFIG } from './data.js';

// ── Individual field builders ─────────────────────────────────────────────────

function buildSelect(q) {
  const $select = $('<select>', { name: q.id, id: q.id })
    .addClass('form-select')
    .attr({ required: q.required || null });

  $select.append(
    $('<option>', { value: '', disabled: true, selected: true, hidden: true })
      .text('-- Please choose an option --'),
  );

  q.options.forEach(o => $select.append($('<option>', { value: o.value }).text(o.label)));

  return $select;
}

function buildCheckboxGroup(q) {
  const $grid = $('<div>').addClass('checkbox-card-grid');

  q.options.forEach(o => {
    const uid    = `${q.id}-${o.value}`;
    const $input = $('<input>', {
      type: 'checkbox', id: uid,
      name: `${q.id}[]`, value: o.value,
    }).addClass('checkbox-card-input q4check');

    const $label = $('<label>', { for: uid })
      .addClass('checkbox-card-label')
      .append(
        $('<span>').addClass('checkbox-card-tick'),
        $('<span>').addClass('checkbox-card-text').text(o.label),
      );

    $grid.append($('<div>').addClass('checkbox-card-item').append($input, $label));
  });

  // Error element shown by validateCluster when nothing is checked
  $grid.append(
    $('<div>', { id: 'q4error' })
      .addClass('invalid-feedback d-none')
      .text(q.error),
  );

  return $grid;
}

function buildContactGroup(q) {
  const $row = $('<div>').addClass('row g-2');

  q.fields.forEach(f => {
    const $col   = $('<div>').addClass('col-12 col-sm-6');
    const $input = $('<input>', {
      type: f.type, id: f.id, name: f.name, placeholder: f.placeholder,
    }).addClass('form-control').attr({ required: f.required || null });

    $col.append($input);
    if (f.error) {
      $col.append($('<div>').addClass('invalid-feedback').text(f.error));
    }
    $row.append($col);
  });

  return $row;
}

function buildQuestion(q) {
  const $wrap = $('<div>').addClass('question mb-3');
  $wrap.append($('<label>', { for: q.id }).addClass('form-label').text(q.label));

  if (q.type === 'select') {
    $wrap.append(buildSelect(q));
    $wrap.append($('<div>').addClass('invalid-feedback').text(q.error));
  } else if (q.type === 'checkbox') {
    $wrap.append(buildCheckboxGroup(q));
  } else if (q.type === 'contact') {
    $wrap.append(buildContactGroup(q));
  }

  return $wrap;
}

// ── Cluster builder ───────────────────────────────────────────────────────────

function buildCluster(cluster, stepNum, totalSteps) {
  const $cluster = $('<div>').addClass('cluster');

  // Step progress bar
  const $progressWrap = $('<div>').addClass('step-progress-wrap').append(
    $('<div>').addClass('step-progress-info').append(
      $('<span>').addClass('step-progress-label').text(`STEP ${stepNum} OF ${totalSteps}`),
      $('<span>').addClass('step-progress-title').text(cluster.title.toUpperCase()),
    ),
    $('<div>').addClass('step-progress-bar').append(
      $('<div>').addClass('step-progress-fill')
        .css('width', `${(stepNum / totalSteps) * 100}%`),
    ),
  );
  $cluster.append($progressWrap);

  // Step label + section title
  $cluster.append($('<div>').addClass('cluster-step-label').text(`STEP ${stepNum}`));
  $cluster.append($('<h3>').addClass('cluster-title').text(cluster.title));

  // Questions — use a grid layout when there are 3+ questions or a checkbox present
  const useGrid  = cluster.questions.length >= 3
                || cluster.questions.some(q => q.type === 'checkbox');
  const $qWrap   = useGrid ? $('<div>').addClass('question-grid') : $('<div>');

  cluster.questions.forEach(q => {
    const $q = buildQuestion(q);
    if (useGrid && (q.type === 'contact' || q.type === 'checkbox')) {
      $q.addClass('question-full');
    }
    $qWrap.append($q);
  });

  $cluster.append($qWrap);
  return $cluster;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Renders all quiz clusters into #clusterContainer.
 * Call once on DOMContentLoaded.
 */
export function buildForm() {
  const $container = $('#clusterContainer');
  const total      = CONFIG.clusters.length;

  CONFIG.clusters.forEach((cluster, idx) => {
    $container.append(buildCluster(cluster, idx + 1, total));
  });
}
