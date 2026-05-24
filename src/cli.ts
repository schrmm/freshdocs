#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { buildIndex } from "./docmeta-index.ts";
import { detect } from "./detect-engine.ts";
import { checkInternalLinks, type DocFile } from "./link-checker.ts";
import { formatReport, type Report } from "./reporter.ts";
import { IGNORED_DIRS, listFiles } from "./repo-files.ts";
import {
  computeFingerprint,
  diffFingerprints,
  macroFindings,
  type Fingerprint,
} from "./structural-fingerprint.ts";

const MACRO_PATTERNS = [
  /^README\.md$/i,
  /^docs\/overview[^/]*\.md$/i,
  /^docs\/workflows[^/]*\.md$/i,
];
const isMacroDoc = (path: string): boolean => MACRO_PATTERNS.some((re) => re.test(path));

function readShape(repoRoot: string): Fingerprint {
  const topLevel: string[] = [];
  for (const dirent of readdirSync(repoRoot, { withFileTypes: true })) {
    if (dirent.isDirectory() && !IGNORED_DIRS.has(dirent.name) && !dirent.name.startsWith(".")) {
      topLevel.push(dirent.name);
    }
  }
  let scripts: string[] = [];
  let bin: string[] = [];
  try {
    const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
    if (pkg && typeof pkg.scripts === "object") scripts = Object.keys(pkg.scripts);
    if (typeof pkg.bin === "string") bin = [pkg.name ?? "bin"];
    else if (pkg && typeof pkg.bin === "object") bin = Object.keys(pkg.bin);
  } catch {
    /* no package.json or unreadable — leave empty */
  }
  return computeFingerprint({ topLevel, scripts, bin });
}

function readHeadShape(repoRoot: string): Fingerprint | null {
  try {
    const tree = execFileSync("git", ["ls-tree", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const topLevel: string[] = [];
    for (const line of tree.split(/\r?\n/)) {
      const match = line.match(/^\d+\s+(\w+)\s+\S+\s+(.+)$/);
      if (match && match[1] === "tree") topLevel.push(match[2]!);
    }
    let scripts: string[] = [];
    let bin: string[] = [];
    try {
      const pkgRaw = execFileSync("git", ["show", "HEAD:package.json"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const pkg = JSON.parse(pkgRaw);
      if (pkg && typeof pkg.scripts === "object") scripts = Object.keys(pkg.scripts);
      if (typeof pkg.bin === "string") bin = [pkg.name ?? "bin"];
      else if (pkg && typeof pkg.bin === "object") bin = Object.keys(pkg.bin);
    } catch {
      /* no package.json at HEAD */
    }
    return computeFingerprint({ topLevel, scripts, bin });
  } catch {
    return null; // not a git repo, or no HEAD yet
  }
}

export interface GateOptions {
  /** Override the previous fingerprint (null = structural check disabled). Default reads git HEAD. */
  previousFingerprint?: Fingerprint | null;
}

/** Compose the gate over an already-resolved change set. */
export function runGate(repoRoot: string, changedFiles: string[], opts: GateOptions = {}): Report {
  const index = buildIndex(repoRoot);
  const existingFiles = listFiles(repoRoot);

  const changedDocs: DocFile[] = changedFiles
    .filter((f) => f.endsWith(".md") && existingFiles.has(f))
    .map((f) => ({ path: f, content: readFileSync(join(repoRoot, ...f.split("/")), "utf8") }));

  const prev = opts.previousFingerprint === undefined ? readHeadShape(repoRoot) : opts.previousFingerprint;
  const structural = prev
    ? macroFindings(
        diffFingerprints(prev, readShape(repoRoot)),
        [...existingFiles].filter(isMacroDoc),
        changedFiles,
      )
    : [];

  const findings = [
    ...detect({ changedFiles, index }),
    ...checkInternalLinks(changedDocs, existingFiles),
    ...structural,
  ];
  return formatReport(findings, { ungatedCount: index.ungated.length });
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
