#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  assert,
  mean,
  normalizeVerdict,
  parseCli,
  quantile,
  readJson,
  readJsonl,
  runMain,
  sampleSd,
  seededRng,
  sha256File,
  stableStringify,
  writeJson,
} from './lib.mjs';
import { validateStudy } from './validate-study.mjs';

const REQUIRED_CELLS = ['A', 'R0', 'R1', 'G0', 'G1'];

function listRunDirs(root) {
  assert(existsSync(root) && lstatSync(root).isDirectory(), `results directory does not exist: ${root}`);
  return readdirSync(root)
    .sort()
    .map((name) => resolve(root, name))
    .filter((path) => lstatSync(path).isDirectory() && existsSync(resolve(path, 'manifest.json')));
}

function aggregateRun(runDir, config, freezeHash, scheduleHash) {
  const manifest = readJson(resolve(runDir, 'manifest.json'));
  assert(manifest.schema_version === 'openwiki-factorial-run@2.0.0', `${manifest.run_id}: unsupported manifest schema`);
  assert(manifest.freeze_sha256 === freezeHash, `${manifest.run_id}: freeze hash mismatch`);
  assert(manifest.schedule_sha256 === scheduleHash, `${manifest.run_id}: schedule hash mismatch`);
  if (manifest.status !== 'completed') {
    return {
      run_id: manifest.run_id,
      cell: manifest.cell,
      repeat_index: manifest.repeat_index,
      status: manifest.status,
      failure: manifest.failure,
    };
  }
  assert(manifest.audit_receipt.complete === true, `${manifest.run_id}: completed run has incomplete audit`);

  const judgments = readJsonl(resolve(runDir, manifest.artifacts.judgments.path));
  assert(judgments.length > 0, `${manifest.run_id}: no judgments`);
  let pass = 0;
  let partial = 0;
  let fail = 0;
  const judges = new Set();
  const answerKeys = new Set();
  for (const row of judgments) {
    const verdict = normalizeVerdict(row.verdict);
    if (verdict === 'PASS') pass += 1;
    else if (verdict === 'PARTIAL') partial += 1;
    else fail += 1;
    judges.add(row.judge_id);
    answerKeys.add(`${row.question_id}\0${row.answer_repeat}`);
  }
  assert(judges.size >= config.design.judges, `${manifest.run_id}: insufficient judges in analysis`);

  const audit = readJson(resolve(runDir, manifest.audit_receipt.path));
  const costRows = readJsonl(resolve(runDir, manifest.artifacts.cost_log.path));
  const totalCost = costRows.reduce((sum, row) => sum + Number(row.cost ?? 0), 0);
  const totalTokens = costRows.reduce((sum, row) => sum + Number(row.tokens ?? 0), 0);
  const totalLatencyMs = costRows.reduce((sum, row) => sum + Number(row.latency_ms ?? 0), 0);
  const denominator = judgments.length;

  return {
    run_id: manifest.run_id,
    cell: manifest.cell,
    repeat_index: manifest.repeat_index,
    status: 'completed',
    judgment_count: denominator,
    unique_answer_count: answerKeys.size,
    judge_count: judges.size,
    pass,
    partial,
    fail,
    pass_rate: pass / denominator,
    pass_partial_rate: (pass + partial) / denominator,
    audit_status: audit.status,
    anchor_rate: audit.anchor?.rate ?? null,
    lexical_validity: audit.anchor?.lexical_validity ?? null,
    entrypoint_coverage: audit.entrypoints?.coverage ?? null,
    cost: totalCost,
    tokens: totalTokens,
    latency_ms: totalLatencyMs,
  };
}

function cellSummary(runs) {
  const completed = runs.filter((run) => run.status === 'completed');
  const failed = runs.filter((run) => run.status !== 'completed');
  const passRates = completed.map((run) => run.pass_rate);
  const passPartialRates = completed.map((run) => run.pass_partial_rate);
  return {
    planned: runs.length,
    completed: completed.length,
    failed: failed.length,
    mean_pass_rate: mean(passRates),
    sd_pass_rate: sampleSd(passRates),
    mean_pass_partial_rate: mean(passPartialRates),
    mean_anchor_rate: mean(completed.map((run) => run.anchor_rate).filter(Number.isFinite)),
    mean_lexical_validity: mean(completed.map((run) => run.lexical_validity).filter(Number.isFinite)),
    mean_entrypoint_coverage: mean(completed.map((run) => run.entrypoint_coverage).filter(Number.isFinite)),
    total_cost: completed.reduce((sum, run) => sum + run.cost, 0),
    total_tokens: completed.reduce((sum, run) => sum + run.tokens, 0),
    total_latency_ms: completed.reduce((sum, run) => sum + run.latency_ms, 0),
  };
}

function contrastValues(cellMeans) {
  const A = cellMeans.A;
  const R0 = cellMeans.R0;
  const R1 = cellMeans.R1;
  const G0 = cellMeans.G0;
  const G1 = cellMeans.G1;
  return {
    gate_main_effect: ((R1 - R0) + (G1 - G0)) / 2,
    authoring_main_effect: ((G0 - R0) + (G1 - R1)) / 2,
    interaction: (G1 - G0) - (R1 - R0),
    g1_vs_a: G1 - A,
  };
}

function bootstrapContrasts(runsByCell, iterations, seed) {
  const rng = seededRng(seed);
  const draws = {
    gate_main_effect: [],
    authoring_main_effect: [],
    interaction: [],
    g1_vs_a: [],
  };

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const means = {};
    for (const cell of REQUIRED_CELLS) {
      const values = runsByCell[cell].map((run) => run.pass_rate);
      assert(values.length > 0, `cannot bootstrap cell ${cell} with no completed runs`);
      const sampled = [];
      for (let index = 0; index < values.length; index += 1) {
        sampled.push(values[Math.floor(rng() * values.length)]);
      }
      means[cell] = mean(sampled);
    }
    const contrasts = contrastValues(means);
    for (const [name, value] of Object.entries(contrasts)) draws[name].push(value);
  }

  return Object.fromEntries(
    Object.entries(draws).map(([name, values]) => {
      values.sort((a, b) => a - b);
      return [
        name,
        {
          estimate: mean(values),
          ci95: [quantile(values, 0.025), quantile(values, 0.975)],
          unit: 'proportion',
        },
      ];
    }),
  );
}

function markdownReport(analysis) {
  const lines = [
    '# Factorial Analysis',
    '',
    `Evidence class: **${analysis.evidence_class}**`,
    '',
  ];
  if (analysis.evidence_class === 'synthetic-pipeline-test') {
    lines.push('> Synthetic smoke data only. This output validates the execution and analysis pipeline; it is not research evidence.', '');
  }
  lines.push('| Cell | Planned | Completed | Failed | Mean PASS | PASS+PARTIAL |', '|---|---:|---:|---:|---:|---:|');
  for (const cell of REQUIRED_CELLS) {
    const summary = analysis.cells[cell];
    const fmt = (value) => (value === null ? '—' : `${(value * 100).toFixed(1)}%`);
    lines.push(`| ${cell} | ${summary.planned} | ${summary.completed} | ${summary.failed} | ${fmt(summary.mean_pass_rate)} | ${fmt(summary.mean_pass_partial_rate)} |`);
  }
  lines.push('', '## Run-level bootstrap contrasts', '');
  for (const [name, result] of Object.entries(analysis.contrasts)) {
    const estimate = result.point_estimate ?? result.estimate;
    lines.push(`- **${name}**: ${(estimate * 100).toFixed(1)} pp (95% bootstrap interval ${(result.ci95[0] * 100).toFixed(1)} to ${(result.ci95[1] * 100).toFixed(1)} pp)`);
  }
  lines.push('', 'The bootstrap is descriptive. Confirmatory interpretation requires the frozen production protocol, complete planned repeats, and the prespecified model or cluster-aware analysis.', '');
  return `${lines.join('\n')}\n`;
}

runMain(() => {
  const { positional, flags } = parseCli(process.argv.slice(2));
  assert(
    positional.length === 3 && typeof flags.get('output') === 'string',
    'usage: analyze.mjs <config.json> <freeze.json> <schedule.json> --output <analysis.json> [--markdown <analysis.md>] [--allow-smoke]',
    64,
  );
  const allowSmoke = flags.get('allow-smoke') === true;
  const validation = validateStudy(positional[0], { allowSmoke });
  const freezePath = resolve(positional[1]);
  const schedulePath = resolve(positional[2]);
  const freeze = readJson(freezePath);
  const schedule = readJson(schedulePath);
  const freezeHash = sha256File(freezePath);
  const scheduleHash = sha256File(schedulePath);
  assert(stableStringify(freeze) === stableStringify(validation.freeze), 'freeze does not match validated config');
  assert(schedule.config_sha256 === freeze.config_sha256, 'schedule config hash mismatch');

  const runs = listRunDirs(validation.outputRoot).map((runDir) =>
    aggregateRun(runDir, validation.config, freezeHash, scheduleHash),
  );
  const expectedIds = new Set(schedule.items.map((item) => item.run_id));
  assert(runs.every((run) => expectedIds.has(run.run_id)), 'results contain a run not present in the frozen schedule');

  const runsByCell = Object.fromEntries(REQUIRED_CELLS.map((cell) => [cell, []]));
  for (const run of runs) runsByCell[run.cell].push(run);
  for (const cell of REQUIRED_CELLS) {
    const planned = schedule.items.filter((item) => item.cell === cell).length;
    assert(runsByCell[cell].length === planned, `cell ${cell} has ${runsByCell[cell].length}/${planned} run manifests`);
  }

  const completedByCell = Object.fromEntries(
    REQUIRED_CELLS.map((cell) => [cell, runsByCell[cell].filter((run) => run.status === 'completed')]),
  );
  for (const cell of REQUIRED_CELLS) assert(completedByCell[cell].length > 0, `cell ${cell} has no completed runs`);

  const cellMeans = Object.fromEntries(
    REQUIRED_CELLS.map((cell) => [cell, mean(completedByCell[cell].map((run) => run.pass_rate))]),
  );
  const pointContrasts = contrastValues(cellMeans);
  const bootstrap = bootstrapContrasts(
    completedByCell,
    validation.config.design.bootstrap_iterations,
    `${validation.config.design.randomization_seed}:analysis`,
  );
  for (const [name, estimate] of Object.entries(pointContrasts)) bootstrap[name].point_estimate = estimate;

  const analysis = {
    schema_version: 'openwiki-factorial-analysis@1.0.0',
    evidence_class: freeze.evidence_class,
    experiment_id: validation.config.experiment_id,
    config_sha256: freeze.config_sha256,
    freeze_sha256: freezeHash,
    schedule_sha256: scheduleHash,
    run_count: runs.length,
    cells: Object.fromEntries(REQUIRED_CELLS.map((cell) => [cell, cellSummary(runsByCell[cell])])),
    contrasts: bootstrap,
    runs,
    interpretation_boundary:
      freeze.evidence_class === 'synthetic-pipeline-test'
        ? 'Synthetic smoke data validate infrastructure only and must not be cited as an experimental result.'
        : 'Confirmatory interpretation requires complete planned runs, protocol compliance, and prespecified inferential analysis.',
  };

  const output = resolve(flags.get('output'));
  writeJson(output, analysis);
  const markdown = flags.get('markdown');
  if (markdown) {
    const path = resolve(markdown);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdownReport(analysis), 'utf8');
  }
  console.log(stableStringify({ status: 'passed', evidence_class: analysis.evidence_class, run_count: analysis.run_count, output }).trimEnd());
  console.log('analysis: PASS');
});
