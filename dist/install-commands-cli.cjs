#!/usr/bin/env node
"use strict";

// src/install-commands-cli.ts
var import_node_fs = require("node:fs");
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var pkgRoot = (0, import_node_path.dirname)(__dirname);
var source = (0, import_node_path.join)(pkgRoot, "commands");
var args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  process.stdout.write(`Usage: freshdocs-install-commands [--claude]

`);
  process.stdout.write(`Installs freshdocs command templates.
`);
  process.stdout.write(`  default   Install to ~/.agents/commands/freshdocs
`);
  process.stdout.write(`  --claude  Install Claude Code adapter commands to ~/.claude/commands/freshdocs
`);
  process.exit(0);
}
for (const arg of args) {
  if (arg !== "--claude") {
    process.stderr.write(`freshdocs: unknown option ${arg}
`);
    process.stderr.write(`Usage: freshdocs-install-commands [--claude]
`);
    process.exit(1);
  }
}
var target = args.has("--claude") ? (0, import_node_path.join)((0, import_node_os.homedir)(), ".claude", "commands", "freshdocs") : (0, import_node_path.join)((0, import_node_os.homedir)(), ".agents", "commands", "freshdocs");
function copyCommands(target2) {
  (0, import_node_fs.mkdirSync)(target2, { recursive: true });
  let copied2 = 0;
  for (const entry of (0, import_node_fs.readdirSync)(source, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    (0, import_node_fs.copyFileSync)((0, import_node_path.join)(source, entry.name), (0, import_node_path.join)(target2, entry.name));
    copied2 += 1;
  }
  return copied2;
}
var copied = copyCommands(target);
process.stdout.write(`freshdocs: installed ${copied} command template(s) into ${target}
`);
process.stdout.write(args.has("--claude") ? `  Claude Code exposes these as /freshdocs:<name> after reloading.
` : `  Agent-neutral templates installed. Use freshdocs through the installed skill where your agent supports skills.
`);
