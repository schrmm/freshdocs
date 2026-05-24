#!/usr/bin/env node
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const pkgRoot = dirname(__dirname);
const source = join(pkgRoot, "commands");
const target = join(homedir(), ".claude", "commands", "freshdocs");

mkdirSync(target, { recursive: true });

let copied = 0;
for (const entry of readdirSync(source, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
  copyFileSync(join(source, entry.name), join(target, entry.name));
  copied += 1;
}

process.stdout.write(`freshdocs: installed ${copied} slash command(s) into ${target}\n`);
process.stdout.write(`  available as /freshdocs:<name> after reloading your agent host\n`);
