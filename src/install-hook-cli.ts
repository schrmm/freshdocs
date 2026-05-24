#!/usr/bin/env node
import { chmodSync, copyFileSync, existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const FRESHDOCS_HOOK_MARKER = "freshdocs documentation gate (pre-commit)";
const force = process.argv.includes("--force");

const pkgRoot = dirname(__dirname);
const source = join(pkgRoot, "hooks", "pre-commit");

if (!existsSync(source)) {
  process.stderr.write(`freshdocs: hook source not found at ${source}\n`);
  process.exit(1);
}

let gitDir: string;
try {
  gitDir = execFileSync("git", ["rev-parse", "--git-dir"], { cwd: process.cwd(), encoding: "utf8" }).trim();
} catch {
  process.stderr.write("freshdocs: not a git repository (cwd has no .git)\n");
  process.exit(1);
}

const target = resolve(process.cwd(), gitDir, "hooks", "pre-commit");

if (existsSync(target) && !force) {
  const existing = readFileSync(target, "utf8");
  if (!existing.includes(FRESHDOCS_HOOK_MARKER)) {
    process.stderr.write(`freshdocs: ${target} already exists and is not a freshdocs hook.\n`);
    process.stderr.write(`  Pass --force to overwrite, or merge manually.\n`);
    process.exit(1);
  }
}

copyFileSync(source, target);
try { chmodSync(target, 0o755); } catch { /* Windows; no-op */ }

process.stdout.write(`freshdocs: installed pre-commit hook at ${target}\n`);
