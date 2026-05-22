#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { buildIndex } from "./docmeta-index.ts";
import { detect } from "./detect-engine.ts";
import { checkInternalLinks, type DocFile } from "./link-checker.ts";
import { formatReport, type Report } from "./reporter.ts";

const IGNORED_DIRS = new Set(["node_modules", "dist", ".git"]);

/** Every file in the repo as repo-relative POSIX paths. */
function listFiles(repoRoot: string): Set<string> {
  const files = new Set<string>();
  const walk = (dir: string): void => {
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      if (dirent.isDirectory()) {
        if (!IGNORED_DIRS.has(dirent.name)) walk(join(dir, dirent.name));
      } else if (dirent.isFile()) {
        const rel = join(dir, dirent.name).slice(repoRoot.length + 1).split(sep).join("/");
        files.add(rel);
      }
    }
  };
  walk(repoRoot);
  return files;
}

/** Compose the gate over an already-resolved change set. */
export function runGate(repoRoot: string, changedFiles: string[]): Report {
  const index = buildIndex(repoRoot);
  const existingFiles = listFiles(repoRoot);

  const changedDocs: DocFile[] = changedFiles
    .filter((f) => f.endsWith(".md") && existingFiles.has(f))
    .map((f) => ({ path: f, content: readFileSync(join(repoRoot, ...f.split("/")), "utf8") }));

  const findings = [
    ...detect({ changedFiles, index }),
    ...checkInternalLinks(changedDocs, existingFiles),
  ];
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
