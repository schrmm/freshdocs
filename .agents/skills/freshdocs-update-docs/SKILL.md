---
name: freshdocs-update-docs
description: Reconcile documentation findings surfaced by the freshdocs gate or audit. Use when doc-gate failed, freshdocs-audit found drift, broken links, overdue reviews, macro staleness, or the user asks to update or repair docs. Does not author new coverage docs from scratch.
---

# freshdocs-update-docs

Repair existing documentation so it reflects the current codebase. This skill is the repair action in the freshdocs family:

- `freshdocs-doc-audit` reports documentation health and never edits files.
- `freshdocs-update-docs` repairs findings from the gate or audit.
- `freshdocs-create-docs` authors missing docs for uncovered source areas.

## Inputs

Run tooling first to get precise findings. Do not guess.

- Gate context: `doc-gate` against the staged change set or current diff.
- Audit context: `freshdocs-audit` for whole-repo findings.
- Repo policy: shared freshdocs defaults for ignored directories and code-surface prefixes.
- Non-behavior changes: `FRESHDOCS_NO_BEHAVIOR_CHANGE=1` downgrades drift findings to warnings, but broken links still fail.

Resolve bins in this order:

1. `doc-gate` / `freshdocs-audit` on PATH.
2. `node_modules/.bin/...`.
3. Project `.agents/skills/freshdocs-update-docs/dist`.
4. Project legacy `.agents/skills/freshdocs/dist`.
5. Global `~/.codex/skills/freshdocs-update-docs/dist`.
6. Global legacy `~/.codex/skills/freshdocs/dist`.
7. Global `~/.agents/skills/freshdocs-update-docs/dist`.
8. Global legacy `~/.agents/skills/freshdocs/dist`.

## Repair Loop

For each finding, in this order:

1. Drift: read the diff for covered files and the flagged doc. Update prose to match behavior. Be terse for `docs/agents/**`, `CLAUDE.md`, `AGENTS.md`, and `CONTEXT.md`; narrative is acceptable for human docs.
2. Broken internal links: update links to the clear successor target or remove only if the referent is truly gone and irrelevant.
3. Macro staleness: re-read the relevant orientation doc and update only the affected sections.
4. Overdue reviews: re-read the doc against current code. If accurate, bump `reviewed`; otherwise treat as drift.
5. External link health: replace with the new URL if findable; otherwise remove the dead link or note deprecation.

For repaired docs, update prose first, then update frontmatter:

- `synced`: current HEAD SHA when the doc covers code behavior.
- `reviewed`: today's date as `YYYY-MM-DD`.

## Boundaries

- Do not author missing module docs from scratch; route that to `freshdocs-create-docs`.
- Do not edit accepted ADRs. Route supersession work to `grill-with-docs`.
- Do not substantively rewrite `CONTEXT.md`; only make light corrections matching current code.
- Touch documentation outside the flagged set only for small, obvious consolidation fixes.

After repair, rerun `doc-gate` or `freshdocs-audit` to confirm the findings are resolved.
