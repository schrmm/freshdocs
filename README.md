---
audience: human
covers: ["src/**"]
synced: b99a2f4d417555178bb8c1f0652d052e4dcc46dc
reviewed: 2026-05-26
review_interval: 60d
---

# freshdocs

[![skills.sh](https://skills.sh/b/schrmm/freshdocs)](https://skills.sh/schrmm/freshdocs)

Keep project documentation reflecting the current state of the codebase.

freshdocs is a portable [Agent Skills](https://www.skills.sh) package that systematically finds the discrepancies that make docs lie — docs-vs-code drift, broken links, fragmented duplication, coverage gaps, macro-doc staleness — and drives them to resolution.

**Detect cheap, repair smart.** A deterministic gate (`doc-gate`, no LLM) fails loud at commit/PR; a read-only audit (`freshdocs-audit`) snapshots the whole repo; three focused agent skills audit, repair, and author missing docs. One `skills.sh` install vendors the skills and bundled CLIs for Claude Code, Codex, Pi, Cursor, and any host that reads the Agent Skills standard.

## Install

```sh
npx skills add schrmm/freshdocs
```

That is the whole install path. `skills.sh` will ask which agent harness and scope to use; choose Codex when installing for Codex. The package installs three coordinated skills, each with the pre-built `dist/` CLIs included, so no global npm install is required:

- `freshdocs-doc-audit`
- `freshdocs-update-docs`
- `freshdocs-create-docs`

In Codex, freshdocs appears as selectable skills, not as slash commands. Start a new Codex session if it was installed while Codex was already running, then use `/skills` or invoke `$freshdocs-doc-audit`, `$freshdocs-update-docs`, or `$freshdocs-create-docs`.

Optional: install as an npm package only if you want `doc-gate` and `freshdocs-audit` directly on PATH everywhere:

```sh
npm install -g github:schrmm/freshdocs
```

### Wire it up

Two install bins; run from inside the target repo:

```sh
# Install the pre-commit gate into this repo's .git/hooks/:
freshdocs-install-hook

# Install portable command templates into ~/.agents/commands/freshdocs/:
freshdocs-install-commands

# Optional Claude Code slash-command adapter:
freshdocs-install-commands --claude
```

`freshdocs-install-hook` refuses to clobber a non-freshdocs `pre-commit` hook; pass `--force` to override. `freshdocs-install-commands` installs the agent-neutral command templates by default; pass `--claude` only when you want the Claude Code slash-command adapter. Both bins resolve their source files (`hooks/pre-commit`, `commands/*.md`) from wherever freshdocs is installed — works for both `npx skills add` and `npm i -g github:` layouts.

Codex does not load arbitrary third-party slash commands from those templates. The `/freshdocs:doc-audit`, `/freshdocs:update-docs`, and `/freshdocs:create-docs` templates are adapters for hosts that support Markdown command templates, such as Claude Code. In Codex, use `/skills` or mention the corresponding skill by name; restart Codex or start a new session if the skills were installed while Codex was already running.

The hook itself resolves `doc-gate` at runtime in this order: PATH → `node_modules/.bin/` → project `.agents/skills/freshdocs-update-docs/dist/cli-main.cjs` → global `~/.codex/skills/freshdocs-update-docs/dist/cli-main.cjs` → global `~/.agents/skills/freshdocs-update-docs/dist/cli-main.cjs` → legacy `freshdocs` skill dist in project, Codex global, or portable global locations via `node`. The first one that exists wins.

## What it detects

| Class | Signal | Where it fires |
|---|---|---|
| Docs-vs-code drift | A `covers` glob matched a changed file and the doc wasn't updated | Gate (commit/PR) |
| Broken internal links | Relative paths or heading anchors that don't resolve | Gate (changed docs) + Audit (all docs) |
| Macro staleness | Repo shape changed (top-level dirs / package.json scripts or bin) | Gate |
| Coverage gaps | Code files reached only by wildcard `covers:` or not at all (explicit literal paths satisfy the existence axis) | Audit |
| Uncovered (new) | A newly-added source file has no doc listing it explicitly | Gate (per-commit, WARN) + Audit (state) |
| Overdue reviews | `reviewed + review_interval < today` | Audit |
| External link health | HTTP HEAD → GET fallback to avoid false-broken on sites that block HEAD | Audit |

Agent-facing docs (`docs/agents/**`, `CLAUDE.md`, `AGENTS.md`, `CONTEXT.md`) **fail** the gate. Human docs (`docs/**`) **warn**. Macro stale, contradiction, and external-link findings are advisory.

## Workflow recipes

### A. Onboarding sweep (primary entry, fresh repo)

```
1. npx skills add schrmm/freshdocs
2. freshdocs-install-commands             # one-time, global command templates
3. freshdocs-install-hook                 # per-repo, wire pre-commit
4. freshdocs-audit --init --apply         # bootstrap empty docmeta blocks
5. $freshdocs-doc-audit                   # see the honest gap
6. $freshdocs-create-docs                 # sweep: cluster → approve → draft → review
7. $freshdocs-update-docs                 # repair any pre-existing drift
8. git add . && git commit                # gate should pass
```

### B. Steady-state commit loop (the heartbeat)

```
1. Edit code → git add → git commit
2. Pre-commit hook runs doc-gate:
   ├─ Clean                   → commit lands
   ├─ Drift / broken-link     → BLOCKS  → $freshdocs-update-docs → re-commit
   ├─ Uncovered (new file)    → WARN    → commit lands; $freshdocs-create-docs <path> when ready
   └─ Macro-stale             → WARN    → commit lands; review when convenient
```

For explicitly non-behavioral code changes, set `FRESHDOCS_NO_BEHAVIOR_CHANGE=1` for the commit. This downgrades drift findings to warnings only; broken links still block. The same mode is available for manual checks with `doc-gate --no-behavior-change`.

### C. Periodic health-check (safety net)

```
1. $freshdocs-doc-audit
2. Read sections:
   - Explicit coverage % — gap visible
   - Overdue reviews     → $freshdocs-update-docs
   - Uncovered (state)   → $freshdocs-create-docs
   - Broken external     → $freshdocs-update-docs
   - Macro-stale         → $freshdocs-update-docs
```

### Decision table — "when to use which"

| Situation | First skill or command |
|---|---|
| Fresh repo / starting adoption | `freshdocs-doc-audit` → `freshdocs-create-docs` (sweep) |
| Commit blocked by gate | `freshdocs-update-docs` |
| Commit warned: new uncovered file | `freshdocs-create-docs <path>` |
| Want to document a specific module now | `freshdocs-create-docs <path>` |
| Quarterly review / pre-release | `freshdocs-doc-audit` → dispatch |
| Doc contradicts accepted ADR | hand off to `grill-with-docs` (superseding ADR) |
| New CONTEXT.md / domain language needed | hand off to `grill-with-docs` |

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

`commands/` ships three adapter templates for Claude Code (and any host with `.md` command templates). They are also mirrored under `.agents/commands/freshdocs` for agent-neutral consumers:

- **`/freshdocs:doc-audit`** — invokes `freshdocs-doc-audit`.
- **`/freshdocs:update-docs`** — invokes `freshdocs-update-docs`.
- **`/freshdocs:create-docs`** — invokes `freshdocs-create-docs`.

The skills themselves are the judgment layer. They are automatically loaded by hosts that follow the Agent Skills standard when matching their descriptions.

## What freshdocs replaces — and what it doesn't

**Replaces (retire these):**
- `doc-sync` — its DRY methodology is the core of the freshdocs skill family.
- `update-docs` (command) — becomes `/freshdocs:update-docs`.
- `claude-md-improver` — CLAUDE.md / AGENTS.md / CONTEXT.md are now gated agent-context docs.
- `revise-claude-md` — session-learning capture folds into `/freshdocs:update-docs` (light context-file updates inline).

**Cooperates with (keep these):**
- `grill-with-docs` — owns `CONTEXT.md` authoring and ADRs. freshdocs flags ADR contradictions but never edits accepted ADRs; deep CONTEXT rewrites are handed off.
- `to-prd` — PRDs flow through `to-prd` to the tracker; freshdocs reads the tracker config but doesn't author PRDs.

### Migration in one go

1. `npx skills add schrmm/freshdocs` in each repo (or globally per host).
2. Uninstall / archive the four replaced skills/commands.
3. Run `freshdocs-audit --init --apply` to bootstrap `docmeta` on existing docs.
4. Run `freshdocs-install-hook` (per repo) and `freshdocs-install-commands` (once per host).
5. Commit. The next failed gate is your migration-complete signal.

## Architecture

Four deep modules behind a thin CLI:
- `docmeta-index` — frontmatter parser + repo walker → `DocIndex`
- `structural-fingerprint` — `(topLevel, scripts, bin)` hash + diff
- `detect-engine` — pure drift/severity/path-filter
- `url-health` — external URL HEAD→GET classifier with an injectable fetcher

Plus pure finding-producers (`link-checker`, `coverage`) and pure helpers (`bump-frontmatter`, `write-frontmatter`, `init-docmeta`). 70 behavior-only tests.

Shared repo-shape defaults live in `repo-policy`: ignored directories (`node_modules`, `dist`, `.git`, `.agents`) and the conventional code-surface prefixes (`src/`, `lib/`, `app/`, `packages/`). There is no required config file in v1; those defaults are deliberately boring and hardcoded.

Publishable skill packages live under `skills/freshdocs-*`, following the Matt Pocock-style source layout. Installed skills land under the target harness's active skill directory such as `.agents/skills` or `~/.agents/skills`; the source repo does not track publishable skills under its own `.agents/skills`, so Codex does not double-load them while developing freshdocs.

See `docs/specs/2026-05-22-freshdocs-design.md` for the full design rationale, and the issue tracker for the seven implementation slices that built it.

## License

MIT.
