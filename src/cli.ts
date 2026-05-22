#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { buildIndex } from "./docmeta-index.ts";
import { detect } from "./detect-engine.ts";
import { formatReport, type Report } from "./reporter.ts";

/** Compose the gate over an already-resolved change set. Pure of git/process. */
export function runGate(repoRoot: string, changedFiles: string[]): Report {
  const index = buildIndex(repoRoot);
  const findings = detect({ changedFiles, index });
  return formatReport(findings);
}

/** Files staged for the current commit (added/copied/modified/renamed). */
function gitStagedFiles(cwd: string): string[] {
  const out = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR"],
    { cwd, encoding: "utf8" },
  );
  return out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function main(): void {
  const cwd = process.cwd();
  const { exitCode, output } = runGate(cwd, gitStagedFiles(cwd));
  process.stdout.write(`${output}\n`);
  process.exit(exitCode);
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) main();
