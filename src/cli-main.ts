#!/usr/bin/env node
import { gitStagedFiles, runGate } from "./cli.ts";

const cwd = process.cwd();
const { exitCode, output } = runGate(cwd, gitStagedFiles(cwd));
process.stdout.write(`${output}\n`);
process.exit(exitCode);
