#!/usr/bin/env node
import { resolve } from 'node:path';
import {
  assert,
  parseCli,
  runMain,
  sha256Text,
  shuffled,
  stableStringify,
  writeJson,
} from './lib.mjs';
import { validateStudy } from './validate-study.mjs';

export function buildSchedule(config, freeze) {
  const items = [];
  for (const cell of config.design.cells) {
    for (let repeatIndex = 1; repeatIndex <= config.design.repeats_per_cell; repeatIndex += 1) {
      const suffix = sha256Text(`${config.design.randomization_seed}\0${cell}\0${repeatIndex}`).slice(0, 10);
      items.push({
        cell,
        repeat_index: repeatIndex,
        run_id: `${cell.toLowerCase()}-r${String(repeatIndex).padStart(2, '0')}-${suffix}`,
      });
    }
  }

  const randomized = shuffled(items, config.design.randomization_seed).map((item, index) => ({
    order: index + 1,
    ...item,
  }));

  return {
    schema_version: 'openwiki-factorial-schedule@1.0.0',
    evidence_class: freeze.evidence_class,
    experiment_id: config.experiment_id,
    config_sha256: freeze.config_sha256,
    protocol_commit: freeze.protocol.commit_sha,
    randomization_seed_sha256: sha256Text(config.design.randomization_seed),
    planned_runs: randomized.length,
    items: randomized,
  };
}

runMain(() => {
  const { positional, flags } = parseCli(process.argv.slice(2));
  assert(
    positional.length === 1 && typeof flags.get('output') === 'string',
    'usage: randomize.mjs <config.json> --output <schedule.json> [--allow-smoke]',
    64,
  );
  const { config, freeze } = validateStudy(positional[0], {
    allowSmoke: flags.get('allow-smoke') === true,
  });
  const schedule = buildSchedule(config, freeze);
  const output = resolve(flags.get('output'));
  writeJson(output, schedule);
  console.log(stableStringify({ status: 'passed', output, planned_runs: schedule.planned_runs }).trimEnd());
  console.log('randomization: PASS');
});
