---
audience: agent
covers: []
reviewed: 2026-05-27
review_interval: 30d
---

# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, if present.
- **`docs/adr/`** for ADRs that touch the area you're about to work in.

If any of these files don't exist, proceed silently. Don't flag their absence or suggest creating them upfront. The producer skill (`grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo:

```text
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

## Use the glossary's vocabulary

When output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept isn't in the glossary yet, either reconsider the invented language or note the gap for `grill-with-docs`.

## Flag ADR conflicts

If output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> Contradicts ADR-0007 (event-sourced orders), but worth reopening because...
