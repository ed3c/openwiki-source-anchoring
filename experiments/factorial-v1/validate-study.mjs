#!/usr/bin/env node
import { existsSync, lstatSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assert,
  isHex,
  parseCli,
  readJson,
  resolveFromFile,
  runMain,
  sha256File,
  sha256Tree,
  stableStringify,
  writeJson,
} from './lib.mjs';

const REQUIRED_CELLS = ['A', 'R0', 'R1', 'G0', 'G1'];
const MUTABLE_MODEL_ALIASES = /^(latest|preview|sonnet|opus|haiku|pro|flash|gpt-[0-9.]+|claude-(sonnet|opus|haiku)|gemini-[0-9.]+-(pro|flash))$/i;

function assertFile(path, label) {
  assert(existsSync(path), `${label} does not exist: ${path}`);
  assert(lstatSync(path).isFile(), `${label} is not a file: ${path}`);
}

function assertDirectory(path, label) {
  assert(existsSync(path), `${label} does not exist: ${path}`);
  assert(lstatSync(path).isDirectory(), `${label} is not a directory: ${path}`);
}

function validateCommand(configPath, spec, label) {
  assert(spec && typeof spec === 'object', `${label} adapter must be an object`);
  assert(typeof spec.command === 'string' && spec.command.length > 0, `${label}.command is required`);
  assert(Array.isArray(spec.args), `${label}.args must be an array`);
  for (const arg of spec.args) assert(typeof arg === 'string', `${label}.args must contain strings`);

  for (const arg of spec.args) {
    if (!/\.(mjs|js|sh|ts)$/.test(arg)) continue;
    const candidate = resolveFromFile(configPath, arg);
    assertFile(candidate, `${label} adapter script`);
  }
}

function validateModel(model, label, mode) {
  assert(model && typeof model === 'object', `${label} model config is required`);
  assert(typeof model.provider === 'string' && model.provider.length > 0, `${label}.provider is required`);
  assert(typeof model.model_id === 'string' && model.model_id.length > 0, `${label}.model_id is required`);
  assert(model.immutable === true, `${label}.immutable must be true`);
  assert(typeof model.runtime_version === 'string' && model.runtime_version.length > 0, `${label}.runtime_version is required`);
  assert(model.parameters && typeof model.parameters === 'object', `${label}.parameters is required`);

  for (const key of ['temperature', 'top_p', 'max_output_tokens', 'seed_supported']) {
    assert(Object.hasOwn(model.parameters, key), `${label}.parameters.${key} is required`);
  }
  assert(typeof model.parameters.seed_supported === 'boolean', `${label}.parameters.seed_supported must be boolean`);
  if (model.parameters.seed_supported) {
    assert(model.parameters.seed !== null && model.parameters.seed !== undefined, `${label}.parameters.seed is required when supported`);
  }

  if (mode === 'production') {
    assert(!MUTABLE_MODEL_ALIASES.test(model.model_id), `${label}.model_id looks mutable or family-level: ${model.model_id}`);
    assert(model.provider !== 'deterministic-mock', `${label} cannot use deterministic-mock in production mode`);
  }
}

function validateHash(path, expected, label) {
  assert(typeof expected === 'string' && /^[0-9a-f]{64}$/.test(expected), `${label}.sha256 must be 64 lowercase hex characters`);
  const observed = sha256File(path);
  assert(observed === expected, `${label} hash mismatch: expected ${expected}, observed ${observed}`);
  return observed;
}

export function validateStudy(configPath, options = {}) {
  const absoluteConfig = resolve(configPath);
  assertFile(absoluteConfig, 'study config');
  const config = readJson(absoluteConfig);
  const allowSmoke = options.allowSmoke === true;

  assert(config.schema_version === 'openwiki-factorial-study@1.0.0', 'unsupported study schema_version');
  assert(['production', 'smoke'].includes(config.mode), 'mode must be production or smoke');
  if (config.mode === 'smoke') assert(allowSmoke, 'smoke config requires --allow-smoke');
  assert(config.experiment_id === 'factorial-v1', 'experiment_id must be factorial-v1');

  assert(config.protocol && typeof config.protocol === 'object', 'protocol config is required');
  const protocolPath = resolveFromFile(absoluteConfig, config.protocol.path);
  assertFile(protocolPath, 'protocol');
  assert(isHex(config.protocol.commit_sha, 40), 'protocol.commit_sha must be a 40-character lowercase SHA');
  const protocolHash = validateHash(protocolPath, config.protocol.sha256, 'protocol');

  assert(config.target && typeof config.target === 'object', 'target config is required');
  assert(typeof config.target.repository === 'string' && config.target.repository.length > 0, 'target.repository is required');
  const targetPath = resolveFromFile(absoluteConfig, config.target.checkout_path);
  assertDirectory(targetPath, 'target checkout');
  assert(isHex(config.target.commit_sha, 40), 'target.commit_sha must be a 40-character lowercase SHA');
  const targetTreeHash = sha256Tree(targetPath);
  if (config.target.tree_sha256 !== null && config.target.tree_sha256 !== undefined) {
    assert(config.target.tree_sha256 === targetTreeHash, `target tree hash mismatch: expected ${config.target.tree_sha256}, observed ${targetTreeHash}`);
  }

  assert(config.question_bank && typeof config.question_bank === 'object', 'question_bank config is required');
  const questionPath = resolveFromFile(absoluteConfig, config.question_bank.path);
  const splitPath = resolveFromFile(absoluteConfig, config.question_bank.split_manifest_path);
  assertFile(questionPath, 'question bank');
  assertFile(splitPath, 'question split manifest');
  const questionHash = validateHash(questionPath, config.question_bank.sha256, 'question_bank');
  const splitHash = validateHash(splitPath, config.question_bank.split_manifest_sha256, 'question_bank split manifest');

  assert(Array.isArray(config.prompts) && config.prompts.length >= 3, 'prompts must contain authoring, answerer, and judge inputs');
  const promptRecords = config.prompts.map((prompt, index) => {
    assert(prompt && typeof prompt === 'object', `prompts[${index}] must be an object`);
    assert(typeof prompt.role === 'string' && prompt.role.length > 0, `prompts[${index}].role is required`);
    const path = resolveFromFile(absoluteConfig, prompt.path);
    assertFile(path, `prompt ${prompt.role}`);
    return {
      role: prompt.role,
      path: relative(dirname(absoluteConfig), path).replaceAll('\\', '/'),
      sha256: validateHash(path, prompt.sha256, `prompt ${prompt.role}`),
    };
  });
  assert(new Set(promptRecords.map((record) => record.role)).size === promptRecords.length, 'prompt roles must be unique');

  assert(config.models && typeof config.models === 'object', 'models config is required');
  for (const role of ['authoring', 'answerer', 'judge']) validateModel(config.models[role], `models.${role}`, config.mode);

  assert(config.design && typeof config.design === 'object', 'design config is required');
  assert(Array.isArray(config.design.cells), 'design.cells must be an array');
  assert(JSON.stringify([...config.design.cells].sort()) === JSON.stringify([...REQUIRED_CELLS].sort()), 'design.cells must contain A, R0, R1, G0, and G1 exactly once');
  const minimumRepeats = config.mode === 'production' ? 5 : 1;
  const minimumAnswers = config.mode === 'production' ? 3 : 1;
  const minimumJudges = config.mode === 'production' ? 2 : 1;
  assert(Number.isInteger(config.design.repeats_per_cell) && config.design.repeats_per_cell >= minimumRepeats, `design.repeats_per_cell must be >= ${minimumRepeats}`);
  assert(Number.isInteger(config.design.answer_repeats) && config.design.answer_repeats >= minimumAnswers, `design.answer_repeats must be >= ${minimumAnswers}`);
  assert(Number.isInteger(config.design.judges) && config.design.judges >= minimumJudges, `design.judges must be >= ${minimumJudges}`);
  assert(typeof config.design.equivalence_margin_pp === 'number' && config.design.equivalence_margin_pp > 0 && config.design.equivalence_margin_pp <= 20, 'design.equivalence_margin_pp must be in (0, 20]');
  assert(typeof config.design.randomization_seed === 'string' && config.design.randomization_seed.length >= 16, 'design.randomization_seed must be at least 16 characters');
  assert(Number.isInteger(config.design.bootstrap_iterations) && config.design.bootstrap_iterations >= 100, 'design.bootstrap_iterations must be an integer >= 100');

  assert(config.adapters && typeof config.adapters === 'object', 'adapters config is required');
  for (const stage of ['authoring', 'answering', 'judging']) validateCommand(absoluteConfig, config.adapters[stage], `adapters.${stage}`);
  validateCommand(absoluteConfig, config.audit, 'audit');

  assert(typeof config.output_root === 'string' && config.output_root.length > 0, 'output_root is required');
  const outputRoot = resolveFromFile(absoluteConfig, config.output_root);

  const configHash = sha256File(absoluteConfig);
  const freeze = {
    schema_version: 'openwiki-factorial-freeze@1.0.0',
    evidence_class: config.mode === 'smoke' ? 'synthetic-pipeline-test' : 'prospective-experiment',
    experiment_id: config.experiment_id,
    config_path: basename(absoluteConfig),
    config_sha256: configHash,
    protocol: {
      path: relative(dirname(absoluteConfig), protocolPath).replaceAll('\\', '/'),
      commit_sha: config.protocol.commit_sha,
      sha256: protocolHash,
    },
    target: {
      repository: config.target.repository,
      commit_sha: config.target.commit_sha,
      tree_sha256: targetTreeHash,
    },
    question_bank: {
      path: relative(dirname(absoluteConfig), questionPath).replaceAll('\\', '/'),
      sha256: questionHash,
      split_manifest_path: relative(dirname(absoluteConfig), splitPath).replaceAll('\\', '/'),
      split_manifest_sha256: splitHash,
    },
    prompts: promptRecords,
    models: config.models,
    design: config.design,
    analysis_code: Object.fromEntries(
      ['lib.mjs', 'validate-study.mjs', 'randomize.mjs', 'run-study.mjs', 'analyze.mjs', 'plan-repeats.mjs'].map((name) => {
        const path = resolve(dirname(fileURLToPath(import.meta.url)), name);
        return [name, existsSync(path) ? sha256File(path) : null];
      }),
    ),
  };

  return { config, configPath: absoluteConfig, outputRoot, freeze };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMain(() => {
    const { positional, flags } = parseCli(process.argv.slice(2));
    assert(positional.length === 1, 'usage: validate-study.mjs <config.json> [--allow-smoke] [--write-freeze <path>]', 64);
    const result = validateStudy(positional[0], { allowSmoke: flags.get('allow-smoke') === true });
    const output = flags.get('write-freeze');
    if (output) writeJson(resolve(output), result.freeze);
    console.log(
      stableStringify({
        status: 'passed',
        evidence_class: result.freeze.evidence_class,
        config_sha256: result.freeze.config_sha256,
        target_tree_sha256: result.freeze.target.tree_sha256,
        output_root: result.outputRoot,
      }).trimEnd(),
    );
    console.log('study validation: PASS');
  });
}
