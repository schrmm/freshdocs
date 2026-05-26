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

/** Files staged for the current commit with git status A (newly created). */
function gitNewlyAddedFiles(cwd: string): string[] {
  const out = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=A"],
    { cwd, encoding: "utf8" },
  );
  return out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

const cwd = process.cwd();
const { exitCode, output } = runGate(cwd, gitStagedFiles(cwd), {
  newlyAddedFiles: gitNewlyAddedFiles(cwd),
  noBehaviorChange: process.argv.includes("--no-behavior-change") || process.env.FRESHDOCS_NO_BEHAVIOR_CHANGE === "1",
});
process.stdout.write(`${output}\n`);
process.exit(exitCode);
