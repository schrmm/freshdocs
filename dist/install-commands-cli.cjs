#!/usr/bin/env node
"use strict";

// src/install-commands-cli.ts
var import_node_fs = require("node:fs");
var import_node_os = require("node:os");
var import_node_path = require("node:path");
var pkgRoot = (0, import_node_path.dirname)(__dirname);
var source = (0, import_node_path.join)(pkgRoot, "commands");
var target = (0, import_node_path.join)((0, import_node_os.homedir)(), ".claude", "commands", "freshdocs");
(0, import_node_fs.mkdirSync)(target, { recursive: true });
var copied = 0;
for (const entry of (0, import_node_fs.readdirSync)(source, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
  (0, import_node_fs.copyFileSync)((0, import_node_path.join)(source, entry.name), (0, import_node_path.join)(target, entry.name));
  copied += 1;
}
process.stdout.write(`freshdocs: installed ${copied} slash command(s) into ${target}
`);
process.stdout.write(`  available as /freshdocs:<name> after reloading your agent host
`);
