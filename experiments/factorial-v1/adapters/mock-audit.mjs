#!/usr/bin/env node
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const wiki = resolve(process.argv[2] ?? '');
const target = resolve(process.argv[3] ?? '');
if (!existsSync(wiki) || !lstatSync(wiki).isDirectory() || !existsSync(target) || !lstatSync(target).isDirectory()) {
  console.error('mock audit usage error');
  process.exit(64);
}
const page = readFileSync(resolve(wiki, 'page.md'), 'utf8');
const valid = page.includes('REPRODUCTION_EVIDENCE') && existsSync(resolve(target, 'source.py'));
console.log(
  JSON.stringify(
    {
      schema_version: 'wiki-anchor-audit@v4',
      complete: true,
      status: valid ? 'passed' : 'failed',
      pages: 1,
      anchor: { total: 2, invalid: valid ? 0 : 1, malformed: 0, rate: 1, lexical_validity: valid ? 1 : 0 },
      claims: { c1_shaped: 2, anchored: 2, inferred: 0, verifiable_share: 1 },
      entrypoints: { total: 1, uncovered: 0, coverage: 1, uncovered_paths: [] },
      invalid_anchors: [],
      unanchored_claims: [],
      failures: valid ? [] : ['synthetic mock audit failed'],
    },
    null,
    2,
  ),
);
process.exit(valid ? 0 : 2);
