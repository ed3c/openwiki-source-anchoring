#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import {
  StudyError,
  assert,
  normalizeVerdict,
  parseCli,
  readJson,
  readJsonl,
  runMain,
  sha256File,
  sha256Tree,
  stableStringify,
  writeJson,
} from './lib.mjs';
import { validateStudy } from './validate-study.mjs';

function fileRef(root, path) {
  return {
    path: relative(root, path).replaceAll('\\', '/'),
    sha256: sha256File(path),
    bytes: statSync(path).size,
  };
}

function treeRef(root, path) {
  return {
    path: relative(root, path).replaceAll('\\', '/'),
    sha256: sha256Tree(path),
  };
}

function runCommand(spec, options) {
  const { cwd, env, stdoutPath, stderrPath, extraArgs = [] } = options;
  const result = spawnSync(spec.command, [...spec.args, ...extraArgs], {
    cwd,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  writeFileSync(stdoutPath, result.stdout ?? '', 'utf8');
  writeFileSync(stderrPath, result.stderr ?? '', 'utf8');
  if (result.error) return { status: 127, message: result.error.message };
  return {
    status: result.status ?? 1,
    message: result.signal ? `terminated by ${result.signal}` : null,
  };
}

function ensureFile(path, label) {
  assert(existsSync(path) && lstatSync(path).isFile(), `${label} was not produced: ${path}`);
}

function ensureDirectory(path, label) {
  assert(existsSync(path) && lstatSync(path).isDirectory(), `${label} was not produced: ${path}`);
}

function validateRawRows(runId, config, answersPath, judgmentsPath) {
  const answers = readJsonl(answersPath);
  const judgments = readJsonl(judgmentsPath);
  assert(answers.length > 0, `${runId}: answers.jsonl is empty`);
  assert(judgments.length > 0, `${runId}: judgments.jsonl is empty`);

  const answerKeys = new Set();
  const repeatsByQuestion = new Map();
  for (const row of answers) {
    assert(row.run_id === runId, `${runId}: answer row has wrong run_id`);
    assert(typeof row.question_id === 'string' && row.question_id.length > 0, `${runId}: answer question_id is required`);
    assert(Number.isInteger(row.answer_repeat) && row.answer_repeat >= 1, `${runId}: answer_repeat must be a positive integer`);
    assert(typeof row.answer === 'string', `${runId}: answer must be a string`);
    const key = `${row.question_id}\0${row.answer_repeat}`;
    assert(!answerKeys.has(key), `${runId}: duplicate answer for ${row.question_id} repeat ${row.answer_repeat}`);
    answerKeys.add(key);
    if (!repeatsByQuestion.has(row.question_id)) repeatsByQuestion.set(row.question_id, new Set());
    repeatsByQuestion.get(row.question_id).add(row.answer_repeat);
  }
  for (const [question, repeats] of repeatsByQuestion) {
    assert(repeats.size >= config.design.answer_repeats, `${runId}: ${question} has ${repeats.size} answer repeats; expected ${config.design.answer_repeats}`);
  }

  const judgeIds = new Set();
  const judgmentKeys = new Set();
  for (const row of judgments) {
    assert(row.run_id === runId, `${runId}: judgment row has wrong run_id`);
    assert(typeof row.question_id === 'string' && row.question_id.length > 0, `${runId}: judgment question_id is required`);
    assert(Number.isInteger(row.answer_repeat) && row.answer_repeat >= 1, `${runId}: judgment answer_repeat must be a positive integer`);
    assert(typeof row.judge_id === 'string' && row.judge_id.length > 0, `${runId}: judge_id is required`);
    normalizeVerdict(row.verdict);
    const answerKey = `${row.question_id}\0${row.answer_repeat}`;
    assert(answerKeys.has(answerKey), `${runId}: judgment references missing answer ${answerKey}`);
    const key = `${answerKey}\0${row.judge_id}`;
    assert(!judgmentKeys.has(key), `${runId}: duplicate judgment ${key}`);
    judgmentKeys.add(key);
    judgeIds.add(row.judge_id);
  }
  assert(judgeIds.size >= config.design.judges, `${runId}: found ${judgeIds.size} judges; expected ${config.design.judges}`);
  for (const key of answerKeys) {
    const count = [...judgmentKeys].filter((judgmentKey) => judgmentKey.startsWith(`${key}\0`)).length;
    assert(count >= config.design.judges, `${runId}: ${key} has ${count} judgments; expected ${config.design.judges}`);
  }
}

function emptyFile(path) {
  if (!existsSync(path)) writeFileSync(path, '', 'utf8');
}

function makeFailure(stage, status, message) {
  return { stage, exit_code: status, message: message ?? `${stage} adapter exited ${status}` };
}

function executeRun(context, item) {
  const { config, configPath, outputRoot, freezePath, freeze, scheduleHash, resume } = context;
  const configDir = dirname(configPath);
  const runDir = resolve(outputRoot, item.run_id);
  const manifestPath = resolve(runDir, 'manifest.json');

  if (existsSync(manifestPath) && resume) {
    const existing = readJson(manifestPath);
    if (existing.status === 'completed') return { run_id: item.run_id, status: 'skipped-completed' };
  }
  assert(!existsSync(runDir) || resume, `run directory already exists: ${runDir}; use --resume or remove it`);
  if (existsSync(runDir)) rmSync(runDir, { recursive: true, force: true });

  mkdirSync(resolve(runDir, 'raw'), { recursive: true });
  mkdirSync(resolve(runDir, 'prompts'), { recursive: true });
  const wikiDir = resolve(runDir, 'wiki');
  const answersPath = resolve(runDir, 'answers.jsonl');
  const judgmentsPath = resolve(runDir, 'judgments.jsonl');
  const provenancePath = resolve(runDir, 'provenance.json');
  const auditPath = resolve(runDir, 'audit.json');
  const costPath = resolve(runDir, 'cost.jsonl');
  const errorPath = resolve(runDir, 'errors.jsonl');

  for (const prompt of config.prompts) {
    const source = resolve(configDir, prompt.path);
    cpSync(source, resolve(runDir, 'prompts', `${prompt.role}.md`));
  }

  const baseEnv = {
    ...process.env,
    OW_EXPERIMENT_ID: config.experiment_id,
    OW_EVIDENCE_CLASS: freeze.evidence_class,
    OW_RUN_ID: item.run_id,
    OW_CELL: item.cell,
    OW_REPEAT_INDEX: String(item.repeat_index),
    OW_RUN_DIR: runDir,
    OW_WIKI_DIR: wikiDir,
    OW_TARGET_DIR: resolve(configDir, config.target.checkout_path),
    OW_QUESTION_BANK: resolve(configDir, config.question_bank.path),
    OW_SPLIT_MANIFEST: resolve(configDir, config.question_bank.split_manifest_path),
    OW_ANSWERS_PATH: answersPath,
    OW_JUDGMENTS_PATH: judgmentsPath,
    OW_COST_LOG: costPath,
    OW_ERROR_LOG: errorPath,
    OW_ANSWER_REPEATS: String(config.design.answer_repeats),
    OW_JUDGES: String(config.design.judges),
    OW_CONFIG_PATH: configPath,
    OW_FREEZE_PATH: freezePath,
  };

  let failure = null;
  for (const stage of ['authoring', 'answering', 'judging']) {
    const stdoutPath = resolve(runDir, 'raw', `${stage}.stdout.log`);
    const stderrPath = resolve(runDir, 'raw', `${stage}.stderr.log`);
    if (failure) {
      emptyFile(stdoutPath);
      emptyFile(stderrPath);
      continue;
    }
    const result = runCommand(config.adapters[stage], {
      cwd: configDir,
      env: { ...baseEnv, OW_STAGE: stage },
      stdoutPath,
      stderrPath,
    });
    if (result.status !== 0) failure = makeFailure(stage, result.status, result.message);
  }

  let auditReceipt = null;
  const auditStdout = resolve(runDir, 'raw', 'audit.stdout.log');
  const auditStderr = resolve(runDir, 'raw', 'audit.stderr.log');
  if (!failure) {
    try {
      ensureDirectory(wikiDir, `${item.run_id} wiki`);
      ensureFile(answersPath, `${item.run_id} answers`);
      ensureFile(judgmentsPath, `${item.run_id} judgments`);
      validateRawRows(item.run_id, config, answersPath, judgmentsPath);

      const auditArgs = [wikiDir, resolve(configDir, config.target.checkout_path)];
      if (Array.isArray(config.audit.exclude) && config.audit.exclude.length > 0) {
        auditArgs.push('--exclude', config.audit.exclude.join(','));
      }
      const auditResult = runCommand(config.audit, {
        cwd: configDir,
        env: { ...baseEnv, OW_STAGE: 'audit' },
        stdoutPath: auditStdout,
        stderrPath: auditStderr,
        extraArgs: auditArgs,
      });
      assert([0, 2].includes(auditResult.status), `${item.run_id}: audit exited ${auditResult.status}; complete receipts require exit 0 or 2`);
      auditReceipt = JSON.parse(readFileSync(auditStdout, 'utf8'));
      assert(auditReceipt.complete === true, `${item.run_id}: audit receipt is incomplete`);
      assert(['passed', 'failed'].includes(auditReceipt.status), `${item.run_id}: unsupported audit status`);
      writeJson(auditPath, auditReceipt);
    } catch (error) {
      failure = makeFailure('validation-or-audit', error instanceof StudyError ? error.exitCode : 1, error instanceof Error ? error.message : String(error));
      emptyFile(auditStdout);
      emptyFile(auditStderr);
    }
  } else {
    emptyFile(auditStdout);
    emptyFile(auditStderr);
  }

  emptyFile(answersPath);
  emptyFile(judgmentsPath);
  emptyFile(costPath);
  emptyFile(errorPath);
  if (!existsSync(wikiDir)) mkdirSync(wikiDir, { recursive: true });
  if (!existsSync(auditPath)) {
    writeJson(auditPath, {
      schema_version: 'wiki-anchor-audit@v4',
      complete: false,
      status: 'incomplete',
      failures: [failure?.message ?? 'run failed before audit'],
    });
  }

  const provenance = {
    schema_version: 'openwiki-factorial-provenance@2.0.0',
    evidence_class: freeze.evidence_class,
    experiment_id: config.experiment_id,
    run_id: item.run_id,
    cell: item.cell,
    repeat_index: item.repeat_index,
    config_sha256: freeze.config_sha256,
    freeze_sha256: sha256File(freezePath),
    schedule_sha256: scheduleHash,
    protocol: freeze.protocol,
    target: freeze.target,
    prompts: freeze.prompts,
    models: config.models,
    adapter_commands: config.adapters,
    audit_command: config.audit,
    deviations: failure ? [`run failed at ${failure.stage}`] : [],
  };
  writeJson(provenancePath, provenance);

  const manifest = {
    schema_version: 'openwiki-factorial-run@2.0.0',
    evidence_class: freeze.evidence_class,
    run_id: item.run_id,
    cell: item.cell,
    repeat_index: item.repeat_index,
    target_commit: config.target.commit_sha,
    protocol_commit: config.protocol.commit_sha,
    freeze_sha256: sha256File(freezePath),
    schedule_sha256: scheduleHash,
    provenance_path: relative(runDir, provenancePath).replaceAll('\\', '/'),
    artifacts: {
      wiki_tree: treeRef(runDir, wikiDir),
      answers: fileRef(runDir, answersPath),
      judgments: fileRef(runDir, judgmentsPath),
      prompts_tree: treeRef(runDir, resolve(runDir, 'prompts')),
      adapter_logs: treeRef(runDir, resolve(runDir, 'raw')),
      cost_log: fileRef(runDir, costPath),
      error_log: fileRef(runDir, errorPath),
    },
    audit_receipt: {
      path: relative(runDir, auditPath).replaceAll('\\', '/'),
      sha256: sha256File(auditPath),
      complete: auditReceipt?.complete === true,
      status: auditReceipt?.status ?? 'incomplete',
    },
    status: failure ? 'failed' : 'completed',
    failure,
    linked_failed_run_id: null,
    deviations: provenance.deviations,
  };
  writeJson(manifestPath, manifest);
  return { run_id: item.run_id, status: manifest.status, failure };
}

runMain(() => {
  const { positional, flags } = parseCli(process.argv.slice(2));
  assert(
    positional.length === 3,
    'usage: run-study.mjs <config.json> <freeze.json> <schedule.json> [--allow-smoke] [--resume] [--only <run-id>]',
    64,
  );

  const allowSmoke = flags.get('allow-smoke') === true;
  const validation = validateStudy(positional[0], { allowSmoke });
  const freezePath = resolve(positional[1]);
  const schedulePath = resolve(positional[2]);
  const freeze = readJson(freezePath);
  const schedule = readJson(schedulePath);
  assert(stableStringify(freeze) === stableStringify(validation.freeze), 'freeze does not match the current validated config');
  assert(schedule.config_sha256 === freeze.config_sha256, 'schedule config hash does not match freeze');
  assert(schedule.evidence_class === freeze.evidence_class, 'schedule evidence class does not match freeze');
  const scheduleHash = sha256File(schedulePath);
  mkdirSync(validation.outputRoot, { recursive: true });

  const only = flags.get('only');
  const items = only ? schedule.items.filter((item) => item.run_id === only) : schedule.items;
  assert(items.length > 0, only ? `run id not found in schedule: ${only}` : 'schedule contains no runs');

  const results = [];
  for (const item of items) {
    results.push(
      executeRun(
        {
          ...validation,
          freezePath,
          freeze,
          scheduleHash,
          resume: flags.get('resume') === true,
        },
        item,
      ),
    );
  }

  const failures = results.filter((result) => result.status === 'failed');
  console.log(stableStringify({ status: failures.length === 0 ? 'passed' : 'failed', runs: results }).trimEnd());
  if (failures.length > 0) throw new StudyError(`${failures.length} run(s) failed`, 2);
  console.log('study execution: PASS');
});
