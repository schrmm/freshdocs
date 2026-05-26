---
audience: agent
covers: ["src/reporter.ts"]
synced: b99a2f4d417555178bb8c1f0652d052e4dcc46dc
reviewed: 2026-05-26
review_interval: 30d
---

# Reporter

Pure render layer for the gate. Takes the composed `Finding[]` and an optional nudge count, returns `{ exitCode, output }`. No I/O, no business logic — just formatting and the fail/warn → exit-code mapping.

## API

```ts
function formatReport(findings: Finding[], opts?: ReportOptions): Report;
interface ReportOptions { ungatedCount?: number; noBehaviorChange?: boolean }
interface Report { exitCode: number; output: string }
```

Consumed by `cli.ts` (the gate's composition root). The audit CLI does its own rendering — `formatReport` is gate-only.

## Behaviour

**No findings:**
```
freshdocs: docs up to date — no issues detected.
```
Exit code: `0`.

**Findings present:**
```
freshdocs: documentation issues detected
✗ FAIL  docs/agents/foo.md — covers file changed without doc update
⚠ WARN  src/new.ts — new source file with no explicit doc coverage
```
Markers: `✗ FAIL` for `severity: "fail"`, `⚠ WARN` for `severity: "warn"`. Format: `<marker>  <finding.doc> — <finding.reason>`.

Exit code:
- Any `severity: "fail"` finding → `1`.
- All `warn` → `0` (gate does not block on warnings).

## The ungated nudge

`opts.ungatedCount` is the count of repo docs missing `docmeta:` frontmatter — surfaced by the audit's `buildIndex(...).ungated`. When non-zero:

```
note: 4 un-gated docs have no docmeta — run freshdocs-audit --init to bootstrap.
```

Appended *after* the headline (clean case) or *after* the findings list (issues case). Singular/plural toggle on the count (`1` → "doc has", others → "docs have").

`ungatedCount` of `undefined`, `0`, or omitted → no nudge.

## Non-behavior override note

When `opts.noBehaviorChange` is true, the report appends:

```
note: non-behavior-change override active — drift findings are warnings; link failures still block.
```

The reporter only prints the note. The caller is responsible for downgrading drift findings before rendering.

## Gotchas

- **Order of severities is preserved.** Findings are rendered in the order they're passed in; the reporter does not sort. The caller composes (`detect` → internal-link checks → structural → uncovered) and that's the printed order.
- **Exit code is decided here, not in `cli.ts`.** Anything else that wants to gate on findings should call `formatReport` rather than re-implementing the fail-vs-warn check.
- **Pure function.** No side effects, no `process.exit`. Caller writes `output` to stdout and exits with `exitCode`.
