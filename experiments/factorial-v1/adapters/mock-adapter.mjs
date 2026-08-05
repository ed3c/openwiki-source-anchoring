#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const stage = process.argv[2] ?? process.env.OW_STAGE;
const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing ${name}`);
  return value;
};
const runId = required('OW_RUN_ID');
const cell = required('OW_CELL');
const wikiDir = required('OW_WIKI_DIR');
const answersPath = required('OW_ANSWERS_PATH');
const judgmentsPath = required('OW_JUDGMENTS_PATH');
const costPath = required('OW_COST_LOG');
const questionBankPath = required('OW_QUESTION_BANK');
const answerRepeats = Number(required('OW_ANSWER_REPEATS'));
const judges = Number(required('OW_JUDGES'));

function appendJsonl(path, row) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(row)}\n`, { encoding: 'utf8', flag: 'a' });
}

if (stage === 'authoring') {
  mkdirSync(wikiDir, { recursive: true });
  writeFileSync(
    resolve(wikiDir, 'page.md'),
    '`source.py` returns the frozen evidence string. (src: source.py `return "REPRODUCTION_EVIDENCE"`)\n\n' +
      'Running `source.py` prints the result through its `__main__` entrypoint. (src: source.py `print(answer())`)\n',
    'utf8',
  );
  appendJsonl(costPath, { stage, provider: 'deterministic-mock', model_id: 'mock-v1.0.0', tokens: 0, cost: 0, latency_ms: 1 });
} else if (stage === 'answering') {
  const questions = JSON.parse(readFileSync(questionBankPath, 'utf8'));
  writeFileSync(answersPath, '', 'utf8');
  for (const question of questions) {
    for (let repeat = 1; repeat <= answerRepeats; repeat += 1) {
      appendJsonl(answersPath, {
        run_id: runId,
        question_id: question.id,
        answer_repeat: repeat,
        answer: `${cell}:${question.id}:synthetic answer ${repeat}`,
      });
    }
  }
  appendJsonl(costPath, { stage, provider: 'deterministic-mock', model_id: 'mock-v1.0.0', tokens: 0, cost: 0, latency_ms: 1 });
} else if (stage === 'judging') {
  const answers = readFileSync(answersPath, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  writeFileSync(judgmentsPath, '', 'utf8');
  const passBudget = { A: 1, R0: 2, R1: 3, G0: 2, G1: 4 }[cell] ?? 0;
  let index = 0;
  for (const answer of answers) {
    for (let judge = 1; judge <= judges; judge += 1) {
      index += 1;
      let verdict = 'FAIL';
      if (index <= passBudget) verdict = 'PASS';
      else if (index === passBudget + 1) verdict = 'PARTIAL';
      appendJsonl(judgmentsPath, {
        run_id: runId,
        question_id: answer.question_id,
        answer_repeat: answer.answer_repeat,
        judge_id: `mock-judge-${judge}`,
        verdict,
      });
    }
  }
  appendJsonl(costPath, { stage, provider: 'deterministic-mock', model_id: 'mock-v1.0.0', tokens: 0, cost: 0, latency_ms: 1 });
} else {
  throw new Error(`unsupported mock stage: ${stage}`);
}
