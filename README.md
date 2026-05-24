# freshdocs

Keep project documentation reflecting the current state of the codebase.

freshdocs is a portable [Agent Skills](https://www.skills.sh) package that systematically finds the discrepancies that make docs lie — docs-vs-code drift, broken links, fragmented duplication, coverage gaps, macro-doc staleness — and drives them to resolution.

**Detect cheap, repair smart.** A deterministic gate (`doc-gate`, no LLM) fails loud at commit/PR; a read-only audit (`freshdocs-audit`) snapshots the whole repo; an LLM-assisted skill repairs flagged docs on demand via `/update-docs`. One skill + two bundled scripts; works in Claude Code, Pi, Cursor, and any host that reads the Agent Skills standard.

## Install

```sh
# As an Agent Skill (recommended for Claude Code / Pi / Cursor / etc.):
npx skills add schrmm/freshdocs

# As an npm package (gives you doc-gate and freshdocs-audit on PATH):
npm install -g github:schrmm/freshdocs
# or
pnpm add -g github:schrmm/freshdocs
```

The npm install runs a `prepare` script that bundles the two bins with esbuild — no follow-up build step.

### Wire the commit gate

```sh
# In any repo where you want freshdocs to gate commits:
cp node_modules/freshdocs/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

Or set `git config core.hooksPath node_modules/freshdocs/hooks` to use the bundled hook directly.

## What it detects

| Class | Signal | Where it fires |
|---|---|---|
| Docs-vs-code drift | A `covers` glob matched a changed file and the doc wasn't updated | Gate (commit/PR) |
| Broken internal links | Relative paths or heading anchors that don't resolve | Gate (changed docs) + Audit (all docs) |
| Macro staleness | Repo shape changed (top-level dirs / package.json scripts or bin) | Gate |
| Coverage gaps | Code files not covered by any doc's `covers` | Audit |
| Overdue reviews | `reviewed + review_interval < today` | Audit |
| External link health | HTTP HEAD → GET fallback to avoid false-broken on sites that block HEAD | Audit |

Agent-facing docs (`docs/agents/**`, `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`) **fail** the gate. Human docs (`docs/**`) **warn**. Macro stale, contradiction, and external-link findings are advisory.

## The `docmeta` convention

The only annotation burden — one frontmatter block on docs you want gated:

```yaml
---
audience: agent          # inferred from path; overridable
covers: ["src/api/**", "src/config/schema.py"]   # globs this doc describes (omit for macro docs)
synced: <git-SHA>        # last time confirmed-accurate
reviewed: 2026-05-23     # last review date
review_interval: 90d     # default 30d agent / 90d human / 60d macro
---
```

Docs without `docmeta` are simply un-gated; the gate prints a one-time nudge pointing to `--init`.

```sh
freshdocs-audit --init           # preview proposals
freshdocs-audit --init --apply   # write conservative docmeta to un-annotated docs
```

## Slash commands

`commands/` ships two templates for Claude Code (and any host with .md slash commands):

- **`/doc-audit`** — read-only whole-repo health report.
- **`/update-docs`** — invokes the `freshdocs` skill to reconcile flagged docs.

The skill itself (`SKILL.md`) is the judgment layer. It is automatically loaded by hosts that follow the Agent Skills standard when matching the description.

## What freshdocs replaces — and what it doesn't

**Replaces (retire these):**
- `doc-sync` — its DRY methodology is the core of the `freshdocs` skill.
- `update-docs` (command) — becomes `/update-docs`.
- `claude-md-improver` — CLAUDE.md / AGENTS.md / CONTEXT.md are now gated agent-context docs.
- `revise-claude-md` — session-learning capture folds into `/update-docs` (light context-file updates inline).

**Cooperates with (keep these):**
- `grill-with-docs` — owns `CONTEXT.md` authoring and ADRs. freshdocs flags ADR contradictions but never edits accepted ADRs; deep CONTEXT rewrites are handed off.
- `to-prd` — PRDs flow through `to-prd` to the tracker; freshdocs reads the tracker config but doesn't author PRDs.

### Migration in one go

1. `npx skills add schrmm/freshdocs` in each repo (or globally per host).
2. Uninstall / archive the four replaced skills/commands.
3. Run `freshdocs-audit --init --apply` to bootstrap `docmeta` on existing docs.
4. Install the pre-commit hook (`cp node_modules/freshdocs/hooks/pre-commit .git/hooks/`).
5. Commit. The next failed gate is your migration-complete signal.

## Architecture

Four deep modules behind a thin CLI:
- `docmeta-index` — frontmatter parser + repo walker → `DocIndex`
- `structural-fingerprint` — `(topLevel, scripts, bin)` hash + diff
- `detect-engine` — pure drift/severity/path-filter
- `url-health` — external URL HEAD→GET classifier with an injectable fetcher

Plus pure finding-producers (`link-checker`, `coverage`) and pure helpers (`bump-frontmatter`, `write-frontmatter`, `init-docmeta`). 70 behavior-only tests.

See `docs/specs/2026-05-22-freshdocs-design.md` for the full design rationale, and the issue tracker for the seven implementation slices that built it.

## License

MIT.
