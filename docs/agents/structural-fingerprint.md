---
audience: agent
covers: ["src/structural-fingerprint.ts"]
synced: 9b65e4676494a1b603aa844f907ba0ff1537884f
reviewed: 2026-05-27
review_interval: 30d
---

# Structural fingerprint

Structural fingerprints detect repo-shape changes that can make orientation or macro docs stale even when no specific `covers` glob maps to the changed file. The module is pure: callers provide the shape snapshots and changed files, and it returns deterministic changes or findings.

## Fingerprint shape

```ts
interface FingerprintInput {
  topLevel: string[];
  scripts: string[];
  bin: string[];
}

type Fingerprint = FingerprintInput;
```

The three tracked categories are:

- `topLevel`: top-level directory names in the repo.
- `scripts`: declared task names, typically `package.json#scripts` keys.
- `bin`: declared executable names, typically `package.json#bin` keys.

The shape is intentionally coarse. It answers "did the repo orientation change enough that macro docs might be stale?" rather than modeling every file.

## Normalize and hash

```ts
function computeFingerprint(input: FingerprintInput): Fingerprint;
function fingerprintHash(fp: Fingerprint): string;
```

`computeFingerprint` sorts and deduplicates each category. `fingerprintHash` JSON-stringifies the normalized shape, so equal repo shapes hash the same regardless of input order.

The hash is not cryptographic. It is a stable comparison token for freshdocs' own gate and tests.

## Diffing

```ts
type StructuralChange =
  | { kind: "dir-added"; name: string }
  | { kind: "dir-removed"; name: string }
  | { kind: "script-added"; name: string }
  | { kind: "script-removed"; name: string }
  | { kind: "bin-added"; name: string }
  | { kind: "bin-removed"; name: string };

function diffFingerprints(prev: Fingerprint, curr: Fingerprint): StructuralChange[];
```

`diffFingerprints` emits add/remove changes per category. Change order is deterministic: top-level dirs first, scripts second, bins third; additions before removals within each category.

## Macro findings

```ts
function macroFindings(
  changes: StructuralChange[],
  macroDocs: string[],
  changedFiles: string[],
): Finding[];
```

Macro docs are docs with no `covers` entries. When the repo shape changed, every macro doc that was not changed in the same change set gets a warning:

```ts
{
  doc,
  kind: "macro-stale",
  severity: "warn",
  reason: "repo structure changed (...); review this orientation doc"
}
```

If there are no structural changes, no findings are emitted. If a macro doc was edited in the same change set, it is treated as already reviewed for that commit and skipped.

## Gotchas

- **Warnings only.** Macro staleness should prompt review, not block a commit.
- **No I/O here.** Reading top-level dirs or `package.json` belongs to the composition layer.
- **Macro docs are identified upstream.** This module only receives the `macroDocs` list; it does not inspect docmeta.
