# freshdocs

Keep project documentation reflecting the current state of the codebase.

freshdocs is a portable [Agent Skills](https://www.skills.sh) package that systematically finds the discrepancies that make docs lie — docs-vs-code drift, docs-vs-docs contradictions, consolidation/DRY needs, coverage gaps, macro-doc staleness, and dead links — and drives them to resolution.

**Detect cheap, repair smart:** a deterministic gate (`doc-gate`, no LLM) fails loud at commit/PR and on a scheduled CI sweep; LLM-assisted repair runs only on demand via `/doc-audit` and `/update-docs`. One skill + one gate script, with thin shims for Pi, Claude Code, and CI.

## Install

```sh
npx skills add schrmm/freshdocs
```

## Status

Pre-implementation. See the design spec: [`docs/specs/2026-05-22-freshdocs-design.md`](docs/specs/2026-05-22-freshdocs-design.md).

## What it replaces

Consolidates `doc-sync`, `update-docs`, `claude-md-improver`, and `revise-claude-md` into one workflow. Cooperates with — does not replace — `grill-with-docs`, `CONTEXT.md`, `docs/adr/`, and `to-prd`.
