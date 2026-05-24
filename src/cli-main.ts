#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { runGate } from "./cli.ts";

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

const cwd = process.cwd();
const { exitCode, output } = runGate(cwd, gitStagedFiles(cwd));
process.stdout.write(`${output}\n`);
process.exit(exitCode);
