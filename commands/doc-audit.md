---
description: Run the read-only freshdocs audit and report documentation health (coverage, overdue reviews, broken internal links, external link health). Makes no changes.
---

Run the documentation health audit for this repo.

1. Invoke the audit. Resolve the bin in this order:
   - `freshdocs-audit` on PATH (global npm install), OR
   - `node_modules/.bin/freshdocs-audit` (local npm install), OR
   - `node .agents/skills/freshdocs/dist/audit-cli.cjs` (vendored by `npx skills add`).
   It accepts no arguments and operates on the current working directory.
2. Present the report grouped by section:
   - **Coverage** — `covered/total (percent%)`, plus the top undocumented files.
   - **Overdue reviews** — docs past their `review_interval`.
   - **Broken internal links** — across every doc, not just changed ones.
   - **External links** — broken URLs (HEAD → GET fallback already applied).
3. This command is **read-only**. Do not propose or apply fixes here. To repair findings, invoke `/update-docs`.
4. If any section is large (e.g., dozens of undocumented files), summarize and offer to dive into a specific category rather than dumping everything.
