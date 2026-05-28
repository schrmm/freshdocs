---
description: Reconcile documentation flagged by the freshdocs gate or audit. Updates prose, fixes links, bumps frontmatter, routes deep CONTEXT.md / ADR work to grill-with-docs.
audience: agent
covers: ["src/cli.ts", "src/cli-main.ts", "src/bump-frontmatter.ts"]
synced: a38d607c1ddd506aada1c1bb4b340a3b1018eead
reviewed: 2026-05-27
review_interval: 30d
---

Use the `freshdocs-update-docs` skill to repair documentation discrepancies for this repo.

1. Activate the `freshdocs-update-docs` skill (read its SKILL.md) before doing anything else.
2. Gather the current findings:
   - Run `doc-gate` against the staged change set (or the diff being prepared). Capture its `Finding[]`.
   - If the user invoked this command outside a commit context, run `freshdocs-audit` instead and use its report.
   - Bin resolution for both: try `doc-gate` / `freshdocs-audit` on PATH first; fall back to `node_modules/.bin/...`; then project `.agents/skills/freshdocs-update-docs/dist`; then global `~/.codex/skills/freshdocs-update-docs/dist`; then global `~/.agents/skills/freshdocs-update-docs/dist`.
   - Repo shape and code-surface defaults come from freshdocs' shared repo policy; only reconcile findings the tool reports.
   - If the user explicitly marks the change non-behavioral, `FRESHDOCS_NO_BEHAVIOR_CHANGE=1` downgrades drift findings to warnings in the pre-commit hook. Manual gate runs can use `doc-gate --no-behavior-change`. Broken links still fail.
3. Walk every finding in the order defined by the skill (drift → broken links → macro staleness → overdue reviews → external links).
4. For each repaired doc: edit prose first, then call `bumpFrontmatter(content, { synced: <current HEAD SHA>, reviewed: <today's date YYYY-MM-DD> })` and write the file.
5. Do **not** edit accepted ADRs or do substantive `CONTEXT.md` rewrites — hand those to `grill-with-docs`.
6. After repair, re-run `doc-gate` / `freshdocs-audit` to confirm the previously-flagged items now pass. Surface any remaining ones to the user.
7. Stage the reconciled docs (do not commit on the user's behalf unless they asked).
