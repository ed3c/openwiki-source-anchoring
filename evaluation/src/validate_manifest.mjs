#!/usr/bin/env node

import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";

const SCHEMA_VERSION = "openwiki-evaluation/v1";
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SHA40_RE = /^[0-9a-f]{40}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;
const PROVENANCE = new Set(["complete", "partial", "unknown"]);
const REQUIRED_PRIMARY_OUTCOME = "source_grounded_task_success";

function usage() {
  console.error(
    "usage: validate_manifest.mjs <manifest.json> [--root <directory>] [--check-paths]",
  );
}

function normalizeRelativePath(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  const normalized = value.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
  if (normalized === "" || normalized === ".") return null;
  if (isAbsolute(value) || normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    return null;
  }
  return normalized;
}

function overlaps(a, b) {
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function pushPath(errors, label, value, pathRecords, kind, owner) {
  const normalized = normalizeRelativePath(value);
  if (!normalized) {
    errors.push(`${label} must be a non-empty repository-relative path that does not escape the root`);
    return null;
  }
  pathRecords.push({ label, path: normalized, kind, owner });
  return normalized;
}

function validateGeneration(generation, label, errors, warnings) {
  const obj = asObject(generation);
  if (!obj) {
    errors.push(`${label}.generation must be an object`);
    return;
  }

  if (!PROVENANCE.has(obj.provenance)) {
    errors.push(`${label}.generation.provenance must be complete, partial, or unknown`);
  }

  const model = asObject(obj.model);
  if (!model) {
    errors.push(`${label}.generation.model must be an object`);
  } else {
    if (model.id !== null && typeof model.id !== "string") {
      errors.push(`${label}.generation.model.id must be a string or null`);
    }
    if (model.provider !== null && typeof model.provider !== "string") {
      errors.push(`${label}.generation.model.provider must be a string or null`);
    }
    if (typeof model.immutable !== "boolean") {
      errors.push(`${label}.generation.model.immutable must be boolean`);
    }
  }

  for (const field of ["prompt_sha256", "config_sha256"]) {
    const value = obj[field];
    if (value !== null && !SHA256_RE.test(value ?? "")) {
      errors.push(`${label}.generation.${field} must be a 64-character hexadecimal SHA-256 or null`);
    }
  }

  if (obj.provenance === "complete") {
    if (!model || !model.id || !model.provider || model.immutable !== true) {
      errors.push(`${label} claims complete provenance but lacks an immutable model id/provider`);
    }
    if (!SHA256_RE.test(obj.prompt_sha256 ?? "") || !SHA256_RE.test(obj.config_sha256 ?? "")) {
      errors.push(`${label} claims complete provenance but prompt/config hashes are incomplete`);
    }
  } else {
    warnings.push(`${label} generation provenance is ${obj.provenance}`);
  }
}

function validateManifest(manifest) {
  const errors = [];
  const warnings = [];
  const pathRecords = [];
  const outputIds = new Set();
  const repositoryIds = new Set();
  const splitPaths = new Set();

  const root = asObject(manifest);
  if (!root) {
    return { errors: ["manifest root must be an object"], warnings, pathRecords };
  }

  if (root.schema_version !== SCHEMA_VERSION) {
    errors.push(`schema_version must be ${SCHEMA_VERSION}`);
  }
  if (typeof root.study_id !== "string" || !ID_RE.test(root.study_id)) {
    errors.push("study_id must be a stable identifier using letters, numbers, dot, underscore, or hyphen");
  }
  if (root.experimental_unit !== "repository_generation_run") {
    errors.push("experimental_unit must be repository_generation_run; pages and claims are nested observations");
  }

  if (!Array.isArray(root.primary_outcomes) || !root.primary_outcomes.includes(REQUIRED_PRIMARY_OUTCOME)) {
    errors.push(`primary_outcomes must include ${REQUIRED_PRIMARY_OUTCOME}`);
  }

  if (!Array.isArray(root.repositories) || root.repositories.length === 0) {
    errors.push("repositories must be a non-empty array");
    return { errors, warnings, pathRecords };
  }

  for (const [repoIndex, repoValue] of root.repositories.entries()) {
    const label = `repositories[${repoIndex}]`;
    const repo = asObject(repoValue);
    if (!repo) {
      errors.push(`${label} must be an object`);
      continue;
    }

    if (typeof repo.id !== "string" || !ID_RE.test(repo.id)) {
      errors.push(`${label}.id must be a stable identifier`);
    } else if (repositoryIds.has(repo.id)) {
      errors.push(`duplicate repository id: ${repo.id}`);
    } else {
      repositoryIds.add(repo.id);
    }

    const source = asObject(repo.source);
    let sourcePath = null;
    if (!source) {
      errors.push(`${label}.source must be an object`);
    } else {
      if (typeof source.repository !== "string" || source.repository.trim() === "") {
        errors.push(`${label}.source.repository must be owner/name or a documented repository identifier`);
      }
      if (!SHA40_RE.test(source.commit ?? "")) {
        errors.push(`${label}.source.commit must be a 40-character hexadecimal SHA`);
      }
      sourcePath = pushPath(errors, `${label}.source.path`, source.path, pathRecords, "source", repo.id);
    }

    if (!Array.isArray(repo.openwiki_outputs) || repo.openwiki_outputs.length === 0) {
      errors.push(`${label}.openwiki_outputs must be a non-empty array`);
    } else {
      const localOutputPaths = [];
      for (const [outputIndex, outputValue] of repo.openwiki_outputs.entries()) {
        const outputLabel = `${label}.openwiki_outputs[${outputIndex}]`;
        const output = asObject(outputValue);
        if (!output) {
          errors.push(`${outputLabel} must be an object`);
          continue;
        }

        if (typeof output.id !== "string" || !ID_RE.test(output.id)) {
          errors.push(`${outputLabel}.id must be a stable identifier`);
        } else if (outputIds.has(output.id)) {
          errors.push(`duplicate openwiki output id: ${output.id}`);
        } else {
          outputIds.add(output.id);
        }

        for (const field of ["method", "run_id"]) {
          if (typeof output[field] !== "string" || output[field].trim() === "") {
            errors.push(`${outputLabel}.${field} must be a non-empty string`);
          }
        }

        const outputPath = pushPath(
          errors,
          `${outputLabel}.path`,
          output.path,
          pathRecords,
          "output",
          output.id ?? `${repo.id}:${outputIndex}`,
        );
        if (outputPath) {
          localOutputPaths.push({ label: outputLabel, path: outputPath });
          if (sourcePath && overlaps(sourcePath, outputPath)) {
            errors.push(`${outputLabel}.path overlaps source.path; isolate generated output from the source snapshot`);
          }
        }
        validateGeneration(output.generation, outputLabel, errors, warnings);
      }

      for (let i = 0; i < localOutputPaths.length; i += 1) {
        for (let j = i + 1; j < localOutputPaths.length; j += 1) {
          if (overlaps(localOutputPaths[i].path, localOutputPaths[j].path)) {
            errors.push(
              `openwiki output paths overlap: ${localOutputPaths[i].path} and ${localOutputPaths[j].path}`,
            );
          }
        }
      }
    }

    const evaluation = asObject(repo.evaluation);
    if (!evaluation) {
      errors.push(`${label}.evaluation must be an object`);
      continue;
    }

    const splits = asObject(evaluation.splits);
    if (!splits) {
      errors.push(`${label}.evaluation.splits must be an object`);
    } else {
      const localSplits = [];
      for (const splitName of ["development", "public", "holdout"]) {
        const split = asObject(splits[splitName]);
        if (!split) {
          errors.push(`${label}.evaluation.splits.${splitName} must be an object`);
          continue;
        }
        const splitPath = pushPath(
          errors,
          `${label}.evaluation.splits.${splitName}.path`,
          split.path,
          pathRecords,
          "split",
          `${repo.id}:${splitName}`,
        );
        if (typeof split.spent !== "boolean") {
          errors.push(`${label}.evaluation.splits.${splitName}.spent must be boolean`);
        }
        if (splitPath) {
          localSplits.push(splitPath);
          if (splitPaths.has(splitPath)) {
            errors.push(`evaluation split path reused across repositories: ${splitPath}`);
          }
          splitPaths.add(splitPath);
        }
      }
      if (new Set(localSplits).size !== localSplits.length) {
        errors.push(`${label} evaluation split paths must be distinct`);
      }
    }

    const tasks = asObject(evaluation.tasks);
    if (!tasks) {
      errors.push(`${label}.evaluation.tasks must be an object`);
    } else {
      for (const taskName of ["repository_qa", "navigation", "change_impact", "implementation"]) {
        pushPath(
          errors,
          `${label}.evaluation.tasks.${taskName}`,
          tasks[taskName],
          pathRecords,
          "task",
          `${repo.id}:${taskName}`,
        );
      }
    }

    const isolation = asObject(evaluation.isolation);
    if (!isolation) {
      errors.push(`${label}.evaluation.isolation must be an object`);
    } else {
      for (const role of ["source_only_task_author", "wiki_only_answerer", "blind_judge"]) {
        if (!Array.isArray(isolation[role]) || isolation[role].length === 0) {
          errors.push(`${label}.evaluation.isolation.${role} must be a non-empty array of forbidden roots`);
          continue;
        }
        for (const [rootIndex, rootValue] of isolation[role].entries()) {
          pushPath(
            errors,
            `${label}.evaluation.isolation.${role}[${rootIndex}]`,
            rootValue,
            pathRecords,
            "forbidden",
            `${repo.id}:${role}`,
          );
        }
      }
    }
  }

  return { errors, warnings, pathRecords };
}

function checkPaths(rootDirectory, pathRecords, errors) {
  const root = resolve(rootDirectory);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    errors.push(`root does not exist or is not a directory: ${root}`);
    return;
  }
  const rootReal = realpathSync(root);

  for (const record of pathRecords) {
    const candidate = resolve(root, record.path);
    const rel = relative(root, candidate);
    if (rel === "" || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) {
      errors.push(`${record.label} path escapes root: ${record.path}`);
      continue;
    }
    if (!existsSync(candidate)) {
      errors.push(`${record.label} path does not exist: ${record.path}`);
      continue;
    }
    const real = realpathSync(candidate);
    const realRel = relative(rootReal, real);
    if (realRel === "" && record.path !== ".") continue;
    if (realRel.startsWith(`..${sep}`) || realRel === ".." || isAbsolute(realRel)) {
      errors.push(`${record.label} resolves outside root through a symlink: ${record.path}`);
    }
  }
}

function main(argv) {
  const manifestPath = argv[0];
  if (!manifestPath) {
    usage();
    return 64;
  }

  let rootDirectory = dirname(resolve(manifestPath));
  let checkPathFlag = false;
  for (let i = 1; i < argv.length; i += 1) {
    if (argv[i] === "--check-paths") {
      checkPathFlag = true;
    } else if (argv[i] === "--root" && argv[i + 1]) {
      rootDirectory = argv[i + 1];
      i += 1;
    } else {
      usage();
      return 64;
    }
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    console.log(JSON.stringify({
      schema_version: "openwiki-evaluation-manifest-audit/v1",
      status: "failed",
      errors: [`cannot parse manifest: ${error.message}`],
      warnings: [],
    }, null, 2));
    return 2;
  }

  const result = validateManifest(manifest);
  if (checkPathFlag) checkPaths(rootDirectory, result.pathRecords, result.errors);

  console.log(JSON.stringify({
    schema_version: "openwiki-evaluation-manifest-audit/v1",
    status: result.errors.length === 0 ? "passed" : "failed",
    check_paths: checkPathFlag,
    root: resolve(rootDirectory),
    repository_count: Array.isArray(manifest.repositories) ? manifest.repositories.length : 0,
    output_count: Array.isArray(manifest.repositories)
      ? manifest.repositories.reduce(
          (sum, repo) => sum + (Array.isArray(repo?.openwiki_outputs) ? repo.openwiki_outputs.length : 0),
          0,
        )
      : 0,
    errors: result.errors,
    warnings: result.warnings,
  }, null, 2));

  return result.errors.length === 0 ? 0 : 2;
}

process.exit(main(process.argv.slice(2)));
