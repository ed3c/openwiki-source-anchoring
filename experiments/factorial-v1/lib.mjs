import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

export class StudyError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = 'StudyError';
    this.exitCode = exitCode;
  }
}

export function assert(condition, message, exitCode = 2) {
  if (!condition) throw new StudyError(message, exitCode);
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new StudyError(`cannot parse JSON ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function readJsonl(path) {
  const text = readFileSync(path, 'utf8');
  const rows = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (line.trim() === '') continue;
    try {
      rows.push(JSON.parse(line));
    } catch (error) {
      throw new StudyError(
        `cannot parse JSONL ${path}:${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  return rows;
}

export function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function stableStringify(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stableStringify(value), 'utf8');
}

export function sha256Text(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function collectFiles(root, options = {}) {
  const { ignore = new Set(['.git', 'node_modules']) } = options;
  const files = [];
  const visit = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      if (ignore.has(name)) continue;
      const path = join(dir, name);
      const stat = lstatSync(path);
      if (stat.isSymbolicLink()) throw new StudyError(`symlink is not allowed in frozen input tree: ${path}`);
      if (stat.isDirectory()) visit(path);
      else if (stat.isFile()) files.push(path);
    }
  };
  visit(root);
  return files;
}

export function sha256Tree(root) {
  const absolute = resolve(root);
  assert(existsSync(absolute) && lstatSync(absolute).isDirectory(), `tree does not exist: ${absolute}`);
  const hash = createHash('sha256');
  for (const path of collectFiles(absolute)) {
    const rel = relative(absolute, path).replaceAll('\\', '/');
    hash.update(rel);
    hash.update('\0');
    hash.update(sha256File(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function resolveFromFile(configPath, candidate) {
  assert(typeof candidate === 'string' && candidate.length > 0, `invalid relative path in ${configPath}`);
  return resolve(dirname(configPath), candidate);
}

export function ensureInside(root, candidate, label = 'path') {
  const base = resolve(root);
  const path = resolve(candidate);
  const rel = relative(base, path);
  assert(rel !== '' && !rel.startsWith('..') && !isAbsolute(rel), `${label} escapes root: ${candidate}`);
  return path;
}

export function isHex(value, length) {
  return typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`).test(value);
}

export function seededRng(seed) {
  const digest = createHash('sha256').update(String(seed)).digest();
  let state = digest.readUInt32LE(0) || 0x6d2b79f5;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled(items, seed) {
  const out = [...items];
  const rng = seededRng(seed);
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rng() * (index + 1));
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

export function mean(values) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sampleSd(values) {
  if (values.length < 2) return null;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}

export function quantile(sortedValues, probability) {
  if (sortedValues.length === 0) return null;
  const position = (sortedValues.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  const weight = position - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

export function normalizeVerdict(value) {
  const verdict = String(value ?? '').trim().toUpperCase();
  assert(['PASS', 'PARTIAL', 'FAIL'].includes(verdict), `unsupported verdict: ${value}`);
  return verdict;
}

export function parseCli(argv) {
  const positional = [];
  const flags = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positional.push(token);
      continue;
    }
    const key = token.slice(2);
    if (['allow-smoke', 'resume'].includes(key)) {
      flags.set(key, true);
      continue;
    }
    const value = argv[++index];
    assert(value !== undefined, `missing value for --${key}`, 64);
    flags.set(key, value);
  }
  return { positional, flags };
}

export function runMain(fn) {
  Promise.resolve()
    .then(fn)
    .catch((error) => {
      if (error instanceof StudyError) {
        console.error(error.message);
        process.exit(error.exitCode);
      }
      console.error(error instanceof Error ? error.stack ?? error.message : String(error));
      process.exit(1);
    });
}
