# freshdocs Agent Guide

## Project Overview

freshdocs keeps documentation aligned with the codebase. It ships deterministic CLIs for doc drift and audit checks plus an agent skill that repairs findings.

## Build And Test

Use the Node package scripts:

```sh
npm run build
npm run typecheck
npm test
```

The build bundles the CLI entrypoints in `dist/`.

## Architecture Notes

Core detection logic lives in `src/detect-engine.ts`, `src/docmeta-index.ts`, `src/link-checker.ts`, `src/coverage.ts`, and `src/url-health.ts`. CLI entrypoints stay thin and delegate to pure modules where possible.

## Code Style

Prefer small, typed TypeScript modules with explicit data shapes. Keep filesystem and process access at the edges so core behavior remains easy to test.

## Testing Policy

Add or update Node test-runner tests in `test/` when behavior changes. Keep tests focused on observable CLI or module behavior.

## Agent Asset Layout

Canonical portable agent assets belong in this repository, not in a vendor-only folder:

- `SKILL.md` is the installable Agent Skill entrypoint for `skills.sh`.
- `.codex-plugin/plugin.json` makes the skill distributable as a Codex plugin.
- `commands/` contains reusable command prompt templates.
- `freshdocs-install-commands` installs command templates to `~/.agents/commands/freshdocs` by default. Use `--claude` only for the Claude Code slash-command adapter.

Vendor-specific folders are adapters only. Keep durable instructions here and in the skill.

## PR Or Commit Guidance

Run `npm test` before committing behavior changes. When code changes alter documented behavior, update affected docs and their docmeta.
