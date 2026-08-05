#!/usr/bin/env node
import { dirname, resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  assert,
  parseCli,
  readJson,
  runMain,
  seededRng,
  stableStringify,
  writeJson,
} from './lib.mjs';

function inverseNormal(p) {
  assert(p > 0 && p < 1, 'inverseNormal requires 0 < p < 1');
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const low = 0.02425;
  const high = 1 - low;
  if (p < low) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= high) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function normal(rng) {
  const u1 = Math.max(Number.EPSILON, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function simulateAtN(config, n, critical, rng) {
  const means = {
    A: config.baseline_pass_rate,
    R0: config.baseline_pass_rate,
    R1: config.baseline_pass_rate + config.gate_effect_pp / 100,
    G0: config.baseline_pass_rate + config.authoring_effect_pp / 100,
    G1:
      config.baseline_pass_rate +
      config.gate_effect_pp / 100 +
      config.authoring_effect_pp / 100 +
      config.interaction_effect_pp / 100,
  };
  const sd = config.run_sd_pp / 100;
  const hits = { gate_main_effect: 0, authoring_main_effect: 0, interaction: 0, g1_vs_a: 0 };

  for (let simulation = 0; simulation < config.simulations; simulation += 1) {
    const cell = {};
    for (const name of ['A', 'R0', 'R1', 'G0', 'G1']) {
      const values = [];
      for (let index = 0; index < n; index += 1) {
        values.push(Math.min(1, Math.max(0, means[name] + normal(rng) * sd)));
      }
      cell[name] = average(values);
    }

    const estimates = {
      gate_main_effect: ((cell.R1 - cell.R0) + (cell.G1 - cell.G0)) / 2,
      authoring_main_effect: ((cell.G0 - cell.R0) + (cell.G1 - cell.R1)) / 2,
      interaction: (cell.G1 - cell.G0) - (cell.R1 - cell.R0),
      g1_vs_a: cell.G1 - cell.A,
    };
    const standardErrors = {
      gate_main_effect: sd / Math.sqrt(n),
      authoring_main_effect: sd / Math.sqrt(n),
      interaction: (2 * sd) / Math.sqrt(n),
      g1_vs_a: (Math.sqrt(2) * sd) / Math.sqrt(n),
    };
    for (const name of Object.keys(hits)) {
      if (Math.abs(estimates[name] / standardErrors[name]) >= critical) hits[name] += 1;
    }
  }

  return Object.fromEntries(Object.entries(hits).map(([name, value]) => [name, value / config.simulations]));
}

function markdown(result) {
  const lines = [
    '# Planning Simulation',
    '',
    '> Planning assumptions only. These values are not observed experiment results and do not estimate real model variance.',
    '',
    '| Repeats/cell | Gate power | Authoring power | Interaction power | G1 vs A power |',
    '|---:|---:|---:|---:|---:|',
  ];
  for (const row of result.scenarios) {
    const pct = (value) => `${(value * 100).toFixed(1)}%`;
    lines.push(`| ${row.repeats_per_cell} | ${pct(row.power.gate_main_effect)} | ${pct(row.power.authoring_main_effect)} | ${pct(row.power.interaction)} | ${pct(row.power.g1_vs_a)} |`);
  }
  lines.push('', `Recommended repeats per cell under these assumptions: **${result.recommended_repeats_per_cell ?? 'none within range'}**`, '');
  return `${lines.join('\n')}\n`;
}

runMain(() => {
  const { positional, flags } = parseCli(process.argv.slice(2));
  assert(
    positional.length === 1 && typeof flags.get('output') === 'string',
    'usage: plan-repeats.mjs <planning-assumptions.json> --output <planning.json> [--markdown <planning.md>]',
    64,
  );
  const config = readJson(resolve(positional[0]));
  assert(config.schema_version === 'openwiki-factorial-planning@1.0.0', 'unsupported planning schema');
  for (const key of ['baseline_pass_rate', 'gate_effect_pp', 'authoring_effect_pp', 'interaction_effect_pp', 'run_sd_pp', 'alpha', 'target_power']) {
    assert(typeof config[key] === 'number' && Number.isFinite(config[key]), `${key} must be numeric`);
  }
  assert(config.baseline_pass_rate > 0 && config.baseline_pass_rate < 1, 'baseline_pass_rate must be in (0,1)');
  assert(config.run_sd_pp > 0, 'run_sd_pp must be positive');
  assert(config.alpha > 0 && config.alpha < 0.2, 'alpha must be in (0,0.2)');
  assert(config.target_power > 0.5 && config.target_power < 1, 'target_power must be in (0.5,1)');
  assert(Number.isInteger(config.min_repeats_per_cell) && config.min_repeats_per_cell >= 2, 'min_repeats_per_cell must be >=2');
  assert(Number.isInteger(config.max_repeats_per_cell) && config.max_repeats_per_cell >= config.min_repeats_per_cell, 'max_repeats_per_cell is invalid');
  assert(Number.isInteger(config.simulations) && config.simulations >= 1000, 'simulations must be >=1000');
  assert(typeof config.seed === 'string' && config.seed.length >= 16, 'seed must be at least 16 characters');

  const critical = inverseNormal(1 - config.alpha / 2);
  const rng = seededRng(config.seed);
  const scenarios = [];
  let recommended = null;
  for (let n = config.min_repeats_per_cell; n <= config.max_repeats_per_cell; n += 1) {
    const power = simulateAtN(config, n, critical, rng);
    scenarios.push({ repeats_per_cell: n, power });
    if (
      recommended === null &&
      power.gate_main_effect >= config.target_power &&
      power.authoring_main_effect >= config.target_power &&
      power.interaction >= config.target_power
    ) {
      recommended = n;
    }
  }

  const result = {
    schema_version: 'openwiki-factorial-planning-result@1.0.0',
    evidence_class: 'planning-assumptions-only',
    assumptions: config,
    critical_z: critical,
    recommended_repeats_per_cell: recommended,
    scenarios,
    limitation:
      'Clipped-normal run-level simulation with assumed effects and SD. Replace assumptions with pilot or external evidence before freezing production sample size.',
  };
  const output = resolve(flags.get('output'));
  writeJson(output, result);
  if (flags.get('markdown')) {
    const path = resolve(flags.get('markdown'));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, markdown(result), 'utf8');
  }
  console.log(stableStringify({ status: 'passed', output, recommended_repeats_per_cell: recommended }).trimEnd());
  console.log('planning simulation: PASS (assumptions only)');
});
