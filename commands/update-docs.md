---
description: Reconcile documentation flagged by the freshdocs gate or audit. Updates prose, fixes links, bumps frontmatter, routes deep CONTEXT.md / ADR work to grill-with-docs.
---

You are repairing documentation discrepancies for this repo.

1. Activate the `freshdocs` skill (read its SKILL.md) before doing anything else.
2. Gather the current findings:
   - Run `doc-gate` against the staged change set (or the diff being prepared). Capture its `Finding[]`.
   - If the user invoked this command outside a commit context, run `freshdocs-audit` instead and use its report.
   - Bin resolution for both: try `doc-gate` / `freshdocs-audit` on PATH first; fall back to `node_modules/.bin/...`; final fallback `node .agents/skills/freshdocs/dist/cli-main.cjs` (or `audit-cli.cjs`) when freshdocs was installed via `npx skills add`.
3. Walk every finding in the order defined by the skill (drift → broken links → macro staleness → overdue reviews → external links).
4. For each repaired doc: edit prose first, then call `bumpFrontmatter(content, { synced: <current HEAD SHA>, reviewed: <today's date YYYY-MM-DD> })` and write the file.
5. Do **not** edit accepted ADRs or do substantive `CONTEXT.md` rewrites — hand those to `grill-with-docs`.
6. After repair, re-run `doc-gate` / `freshdocs-audit` to confirm the previously-flagged items now pass. Surface any remaining ones to the user.
7. Stage the reconciled docs (do not commit on the user's behalf unless they asked).
