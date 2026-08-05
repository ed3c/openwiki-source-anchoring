#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assert, readJson, runMain, stableStringify, writeJson } from './lib.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));

function run(script, args) {
  const result = spawnSync(process.execPath, [resolve(scriptDir, script), ...args], {
    cwd: scriptDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  assert(result.status === 0, `${script} exited ${result.status}`);
}

runMain(() => {
  const temp = mkdtempSync(resolve(tmpdir(), 'openwiki-factorial-smoke-'));
  try {
    const sourceConfigPath = resolve(scriptDir, 'fixtures/smoke-config.json');
    const sourceConfigDir = dirname(sourceConfigPath);
    const config = readJson(sourceConfigPath);
    config.protocol.path = resolve(sourceConfigDir, config.protocol.path);
    config.target.checkout_path = resolve(sourceConfigDir, config.target.checkout_path);
    config.question_bank.path = resolve(sourceConfigDir, config.question_bank.path);
    config.question_bank.split_manifest_path = resolve(
      sourceConfigDir,
      config.question_bank.split_manifest_path,
    );
    config.prompts = config.prompts.map((prompt) => ({
      ...prompt,
      path: resolve(sourceConfigDir, prompt.path),
    }));
    for (const stage of ['authoring', 'answering', 'judging']) {
      config.adapters[stage] = {
        command: process.execPath,
        args: config.adapters[stage].args.map((arg) =>
          /\.(mjs|js|sh|ts)$/.test(arg) ? resolve(sourceConfigDir, arg) : arg,
        ),
      };
    }
    config.audit = {
      ...config.audit,
      command: process.execPath,
      args: config.audit.args.map((arg) =>
        /\.(mjs|js|sh|ts)$/.test(arg) ? resolve(sourceConfigDir, arg) : arg,
      ),
    };
    config.output_root = resolve(temp, 'results');

    const configPath = resolve(temp, 'smoke-config.json');
    const freezePath = resolve(temp, 'freeze.json');
    const schedulePath = resolve(temp, 'schedule.json');
    const analysisPath = resolve(temp, 'analysis.json');
    const markdownPath = resolve(temp, 'analysis.md');
    writeJson(configPath, config);

    run('validate-study.mjs', [configPath, '--allow-smoke', '--write-freeze', freezePath]);
    run('randomize.mjs', [configPath, '--allow-smoke', '--output', schedulePath]);
    run('run-study.mjs', [configPath, freezePath, schedulePath, '--allow-smoke']);
    run('analyze.mjs', [
      configPath,
      freezePath,
      schedulePath,
      '--allow-smoke',
      '--output',
      analysisPath,
      '--markdown',
      markdownPath,
    ]);

    const analysis = JSON.parse(readFileSync(analysisPath, 'utf8'));
    assert(analysis.evidence_class === 'synthetic-pipeline-test', 'smoke analysis must remain synthetic');
    assert(analysis.run_count === 5, `expected five synthetic runs, observed ${analysis.run_count}`);
    for (const cell of ['A', 'R0', 'R1', 'G0', 'G1']) {
      assert(analysis.cells[cell].completed === 1, `${cell} synthetic run did not complete`);
      assert(analysis.cells[cell].failed === 0, `${cell} synthetic run failed`);
    }
    console.log(
      stableStringify({
        status: 'passed',
        evidence_class: analysis.evidence_class,
        run_count: analysis.run_count,
        note: 'synthetic pipeline validation only; not an experimental result',
      }).trimEnd(),
    );
    console.log('factorial infrastructure: PASS (synthetic smoke only; no research result)');
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
