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

**Detect cheap, repair smart.** A deterministic gate (`doc-gate`, no LLM) fails loud at commit/PR; a read-only audit (`freshdocs-audit`) snapshots the whole repo; an LLM-assisted skill repairs flagged docs on demand via `/freshdocs:update-docs`. One skill + two bundled scripts; works in Claude Code, Pi, Cursor, and any host that reads the Agent Skills standard.

## Install

```sh
npx skills add schrmm/freshdocs
```

That is the whole install path. `skills.sh` will ask which agent harness and scope to use; choose Codex when installing for Codex. The installed skill includes the pre-built `dist/` CLIs, so no global npm install is required.

For non-interactive Codex setup:

```sh
npx skills add schrmm/freshdocs --agent codex --yes
```

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

Codex does not load arbitrary third-party slash commands from those templates. Use `/skills` or mention `$freshdocs` after installing the skill. The package also includes `.codex-plugin/plugin.json`, so freshdocs can be distributed as a Codex plugin rather than only as a loose skill.

The hook itself resolves `doc-gate` at runtime in this order: PATH → `node_modules/.bin/` → project `.agents/skills/freshdocs/dist/cli-main.cjs` → global `~/.codex/skills/freshdocs/dist/cli-main.cjs` → global `~/.agents/skills/freshdocs/dist/cli-main.cjs` via `node`. The first one that exists wins.

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
5. /freshdocs:doc-audit                   # see the honest gap
6. /freshdocs:create-docs                 # sweep: cluster → approve → draft → review
7. /freshdocs:update-docs                 # repair any pre-existing drift
8. git add . && git commit                # gate should pass
```

### B. Steady-state commit loop (the heartbeat)

```
1. Edit code → git add → git commit
2. Pre-commit hook runs doc-gate:
   ├─ Clean                   → commit lands
   ├─ Drift / broken-link     → BLOCKS  → /freshdocs:update-docs → re-commit
   ├─ Uncovered (new file)    → WARN    → commit lands; /freshdocs:create-docs <path> when ready
   └─ Macro-stale             → WARN    → commit lands; review when convenient
```

For explicitly non-behavioral code changes, set `FRESHDOCS_NO_BEHAVIOR_CHANGE=1` for the commit. This downgrades drift findings to warnings only; broken links still block. The same mode is available for manual checks with `doc-gate --no-behavior-change`.

### C. Periodic health-check (safety net)

```
1. /freshdocs:doc-audit
2. Read sections:
   - Explicit coverage % — gap visible
   - Overdue reviews     → /freshdocs:update-docs
   - Uncovered (state)   → /freshdocs:create-docs
   - Broken external     → /freshdocs:update-docs
   - Macro-stale         → /freshdocs:update-docs
```

### Decision table — "when to use which"

| Situation | First command |
|---|---|
| Fresh repo / starting adoption | `/freshdocs:doc-audit` → `/freshdocs:create-docs` (sweep) |
| Commit blocked by gate | `/freshdocs:update-docs` |
| Commit warned: new uncovered file | `/freshdocs:create-docs <path>` |
| Want to document a specific module now | `/freshdocs:create-docs <path>` |
| Quarterly review / pre-release | `/freshdocs:doc-audit` → dispatch |
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

`commands/` ships three templates for Claude Code (and any host with `.md` command templates). They are also mirrored under `.agents/commands/freshdocs` for agent-neutral consumers:

- **`/freshdocs:doc-audit`** — read-only whole-repo health report.
- **`/freshdocs:update-docs`** — invokes the `freshdocs` skill to reconcile flagged docs.
- **`/freshdocs:create-docs`** — drafts missing docs from audit coverage gaps.

The skill itself (`SKILL.md`) is the judgment layer. It is automatically loaded by hosts that follow the Agent Skills standard when matching the description. Codex discovers installed skills in `.agents/skills` and can receive freshdocs as a Codex plugin through `.codex-plugin/plugin.json`.

## What freshdocs replaces — and what it doesn't

**Replaces (retire these):**
- `doc-sync` — its DRY methodology is the core of the `freshdocs` skill.
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

See `docs/specs/2026-05-22-freshdocs-design.md` for the full design rationale, and the issue tracker for the seven implementation slices that built it.

## License

MIT.
