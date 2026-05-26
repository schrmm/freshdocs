#!/usr/bin/env node
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const pkgRoot = dirname(__dirname);
const source = join(pkgRoot, "commands");
const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  process.stdout.write(`Usage: freshdocs-install-commands [--claude]\n\n`);
  process.stdout.write(`Installs freshdocs command templates.\n`);
  process.stdout.write(`  default   Install to ~/.agents/commands/freshdocs\n`);
  process.stdout.write(`  --claude  Install Claude Code adapter commands to ~/.claude/commands/freshdocs\n`);
  process.exit(0);
}

for (const arg of args) {
  if (arg !== "--claude") {
    process.stderr.write(`freshdocs: unknown option ${arg}\n`);
    process.stderr.write(`Usage: freshdocs-install-commands [--claude]\n`);
    process.exit(1);
  }
}

const target = args.has("--claude")
  ? join(homedir(), ".claude", "commands", "freshdocs")
  : join(homedir(), ".agents", "commands", "freshdocs");

function copyCommands(target: string): number {
  mkdirSync(target, { recursive: true });

  let copied = 0;
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    copyFileSync(join(source, entry.name), join(target, entry.name));
    copied += 1;
  }

  return copied;
}

const copied = copyCommands(target);
process.stdout.write(`freshdocs: installed ${copied} command template(s) into ${target}\n`);
process.stdout.write(args.has("--claude")
  ? `  Claude Code exposes these as /freshdocs:<name> after reloading.\n`
  : `  Agent-neutral templates installed. Use freshdocs through the installed skill where your agent supports skills.\n`);
