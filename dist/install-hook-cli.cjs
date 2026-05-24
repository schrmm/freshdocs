#!/usr/bin/env node
"use strict";

// src/install-hook-cli.ts
var import_node_fs = require("node:fs");
var import_node_child_process = require("node:child_process");
var import_node_path = require("node:path");
var FRESHDOCS_HOOK_MARKER = "freshdocs documentation gate (pre-commit)";
var force = process.argv.includes("--force");
var pkgRoot = (0, import_node_path.dirname)(__dirname);
var source = (0, import_node_path.join)(pkgRoot, "hooks", "pre-commit");
if (!(0, import_node_fs.existsSync)(source)) {
  process.stderr.write(`freshdocs: hook source not found at ${source}
`);
  process.exit(1);
}
var gitDir;
try {
  gitDir = (0, import_node_child_process.execFileSync)("git", ["rev-parse", "--git-dir"], { cwd: process.cwd(), encoding: "utf8" }).trim();
} catch {
  process.stderr.write("freshdocs: not a git repository (cwd has no .git)\n");
  process.exit(1);
}
var target = (0, import_node_path.resolve)(process.cwd(), gitDir, "hooks", "pre-commit");
if ((0, import_node_fs.existsSync)(target) && !force) {
  const existing = (0, import_node_fs.readFileSync)(target, "utf8");
  if (!existing.includes(FRESHDOCS_HOOK_MARKER)) {
    process.stderr.write(`freshdocs: ${target} already exists and is not a freshdocs hook.
`);
    process.stderr.write(`  Pass --force to overwrite, or merge manually.
`);
    process.exit(1);
  }
}
(0, import_node_fs.copyFileSync)(source, target);
try {
  (0, import_node_fs.chmodSync)(target, 493);
} catch {
}
process.stdout.write(`freshdocs: installed pre-commit hook at ${target}
`);
