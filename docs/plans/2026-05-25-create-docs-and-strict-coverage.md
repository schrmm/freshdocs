# `/freshdocs:create-docs` + Strict Coverage — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/freshdocs:create-docs` and strict coverage detection so freshdocs surfaces *existence* as a first-class signal alongside *freshness*. After this lands, the audit will be honest about wildcard inflation, the gate will WARN on newly-added uncovered files, and `/freshdocs:create-docs` will provide a sweep + targeted authoring path.

**Architecture:** Same skill (`freshdocs`), three commands. Pure functional core: `coverage.ts` gains a wildcard-vs-explicit split; `detect-engine.ts` gains a per-commit `detectUncovered`; `audit.ts` gains an `uncovered` state list. Thin I/O shells (`audit-cli.ts`, `cli.ts`, `cli-main.ts`) wire the new signals. New slash command at `commands/create-docs.md` is LLM-driven and reads existing audit output — no new bins, no new runtime code-paths for creation.

**Tech Stack:** TypeScript, esbuild (cjs bundle), `node:test` + tsx, picomatch, yaml. No new dependencies.

**Reference spec:** `docs/specs/2026-05-24-create-docs-and-strict-coverage.md`.

---

## Task 1: Add the `isExplicitCover` predicate

**Files:**
- Modify: `src/coverage.ts`
- Test: `test/coverage.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/coverage.test.ts`:

```ts
import { isExplicitCover } from "../src/coverage.ts";

test("isExplicitCover: literal path is explicit", () => {
  assert.equal(isExplicitCover("src/audience.ts"), true);
});

test("isExplicitCover: brace expansion with no wildcard is explicit", () => {
  assert.equal(isExplicitCover("src/{audit-cli,audit}.ts"), true);
});

test("isExplicitCover: anything containing * is not explicit", () => {
  assert.equal(isExplicitCover("src/**"), false);
  assert.equal(isExplicitCover("src/*.ts"), false);
  assert.equal(isExplicitCover("src/internals/*.ts"), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- --test-name-pattern="isExplicitCover"`
Expected: 3 FAIL with `isExplicitCover is not a function` (or similar import error).

- [ ] **Step 3: Implement `isExplicitCover` in `src/coverage.ts`**

Add to the top of `src/coverage.ts` (between imports and the `CoverageReport` interface):

```ts
/** A `covers:` entry satisfies the existence axis only when it has no wildcards. */
export function isExplicitCover(cover: string): boolean {
  return !cover.includes("*");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- --test-name-pattern="isExplicitCover"`
Expected: 3 PASS.

- [ ] **Step 5: Full test suite still green**

Run: `pnpm test`
Expected: 73/73 pass (70 existing + 3 new). No failures.

- [ ] **Step 6: Commit**

```bash
git add src/coverage.ts test/coverage.test.ts
git commit -m "feat(coverage): add isExplicitCover predicate"
```

---

## Task 2: Split `coverageOf` into explicit / wildcard-only / uncovered

**Files:**
- Modify: `src/coverage.ts`
- Test: `test/coverage.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `test/coverage.test.ts`:

```ts
test("coverageOf: splits explicit, wildcard-only, uncovered", () => {
  const report = coverageOf(
    ["src/a.ts", "src/b.ts", "src/c.ts"],
    index(["src/a.ts"], ["src/**"]),
  );
  assert.equal(report.explicit, 1);          // a covered explicitly
  assert.equal(report.wildcardOnly, 2);      // b, c only via src/**
  assert.equal(report.uncovered, 0);
  assert.equal(report.total, 3);
  assert.deepEqual(report.explicitFiles, ["src/a.ts"]);
  assert.deepEqual(report.wildcardOnlyFiles, ["src/b.ts", "src/c.ts"]);
  assert.deepEqual(report.uncoveredFiles, []);
});

test("coverageOf: percent is explicit/total — the honest metric", () => {
  const report = coverageOf(
    ["src/a.ts", "src/b.ts", "src/c.ts"],
    index(["src/a.ts"], ["src/**"]),
  );
  assert.equal(report.percent, 33.3);
});

test("coverageOf: a file matched by both an explicit and a wildcard is explicit", () => {
  const report = coverageOf(["src/a.ts"], index(["src/a.ts"], ["src/**"]));
  assert.equal(report.explicit, 1);
  assert.equal(report.wildcardOnly, 0);
});

test("coverageOf: a file matched by no covers is uncovered", () => {
  const report = coverageOf(["src/a.ts"], index(["src/b.ts"]));
  assert.equal(report.explicit, 0);
  assert.equal(report.wildcardOnly, 0);
  assert.equal(report.uncovered, 1);
  assert.deepEqual(report.uncoveredFiles, ["src/a.ts"]);
});
```

Note: the existing test `"counts a file as covered when any cover glob matches it"` will fail because `report.covered` no longer exists. **Delete that test** and the `"a file matched by more than one glob is counted once"` test — both are subsumed by the new split-based tests.

- [ ] **Step 2: Run tests to verify the new ones fail and the old ones are gone**

Run: `pnpm test --test-name-pattern="coverageOf"`
Expected: new tests FAIL (`report.explicit is undefined` etc.); deleted tests no longer present.

- [ ] **Step 3: Rewrite `coverageOf` in `src/coverage.ts`**

Replace the existing `CoverageReport` interface and `coverageOf` function with:

```ts
export interface CoverageReport {
  total: number;
  explicit: number;
  wildcardOnly: number;
  uncovered: number;
  percent: number; // explicit / total — the honest metric
  explicitFiles: string[];
  wildcardOnlyFiles: string[];
  uncoveredFiles: string[];
}

/**
 * Split coverage of a code surface by whether each file is reached by an
 * explicit `covers:` entry, only by a wildcard, or not at all.
 *
 * `percent` is intentionally `explicit / total` — wildcards still flag drift
 * but no longer satisfy the existence question.
 */
export function coverageOf(codeFiles: string[], index: DocIndex): CoverageReport {
  if (codeFiles.length === 0) {
    return {
      total: 0,
      explicit: 0,
      wildcardOnly: 0,
      uncovered: 0,
      percent: 100,
      explicitFiles: [],
      wildcardOnlyFiles: [],
      uncoveredFiles: [],
    };
  }

  // Build explicit-set (literal paths only) and wildcard matchers separately.
  const explicitSet = new Set<string>();
  const wildcardGlobs: string[] = [];
  for (const entry of index.entries) {
    for (const cover of entry.meta.covers) {
      if (isExplicitCover(cover)) explicitSet.add(cover);
      else wildcardGlobs.push(cover);
    }
  }
  const wildcardMatch = wildcardGlobs.length > 0 ? picomatch(wildcardGlobs) : () => false;

  const explicitFiles: string[] = [];
  const wildcardOnlyFiles: string[] = [];
  const uncoveredFiles: string[] = [];
  for (const file of codeFiles) {
    if (explicitSet.has(file)) explicitFiles.push(file);
    else if (wildcardMatch(file)) wildcardOnlyFiles.push(file);
    else uncoveredFiles.push(file);
  }

  const percent = Math.round((explicitFiles.length / codeFiles.length) * 1000) / 10;
  return {
    total: codeFiles.length,
    explicit: explicitFiles.length,
    wildcardOnly: wildcardOnlyFiles.length,
    uncovered: uncoveredFiles.length,
    percent,
    explicitFiles,
    wildcardOnlyFiles,
    uncoveredFiles,
  };
}
```

- [ ] **Step 4: Run coverage tests to verify they pass**

Run: `pnpm test --test-name-pattern="coverageOf"`
Expected: 4 new tests PASS.

- [ ] **Step 5: Typecheck to find downstream breakage**

Run: `pnpm typecheck`
Expected: errors in `src/audit.ts` and `src/audit-cli.ts` because they reference the old `CoverageReport.covered` / `undocumented`. **Leave them broken** — Task 3 and Task 6 fix them.

- [ ] **Step 6: Commit (typecheck-broken; tests passing for the file we changed)**

Note: full test suite intentionally not run here because downstream `audit.test.ts` will fail until Task 6. Verify only `coverage.test.ts` is green:

Run: `pnpm test --test-name-pattern="coverage"`
Expected: all coverage tests pass.

```bash
git add src/coverage.ts test/coverage.test.ts
git commit -m "feat(coverage): split into explicit / wildcard-only / uncovered

Wildcards still flag drift but no longer satisfy existence. percent is
explicit/total — the honest metric. Downstream consumers (audit, audit-cli)
will be repaired in subsequent tasks; typecheck currently red."
```

---

## Task 3: Repair `audit.ts` and `audit-cli.ts` for the new `CoverageReport`

**Files:**
- Modify: `src/audit.ts`
- Modify: `src/audit-cli.ts`
- Test: `test/audit.test.ts`

- [ ] **Step 1: Read current audit.ts to find references to old CoverageReport shape**

Run: `grep -n "covered\|undocumented" src/audit.ts src/audit-cli.ts`

Expected: a few references in audit-cli.ts's `render()` function (the coverage section).

- [ ] **Step 2: Update audit-cli.ts render to print the new shape**

In `src/audit-cli.ts`, locate this block (around lines 37–45):

```ts
lines.push(`Coverage: ${report.coverage.covered}/${report.coverage.total} (${report.coverage.percent}%)`);
if (report.coverage.undocumented.length > 0) {
  lines.push(`  undocumented (${report.coverage.undocumented.length}):`);
  for (const p of report.coverage.undocumented.slice(0, 20)) lines.push(`    - ${p}`);
  if (report.coverage.undocumented.length > 20) {
    lines.push(`    ... and ${report.coverage.undocumented.length - 20} more`);
  }
}
```

Replace with:

```ts
const c = report.coverage;
lines.push(`Coverage:`);
lines.push(`  Explicitly documented: ${c.explicit}/${c.total} (${c.percent}%)`);
lines.push(`  Wildcard-only:         ${c.wildcardOnly}/${c.total}`);
lines.push(`  Uncovered:             ${c.uncovered}/${c.total}`);
if (c.wildcardOnlyFiles.length > 0) {
  lines.push("");
  lines.push(`  wildcard-only (${c.wildcardOnlyFiles.length}):`);
  for (const p of c.wildcardOnlyFiles.slice(0, 20)) lines.push(`    - ${p}`);
  if (c.wildcardOnlyFiles.length > 20) {
    lines.push(`    ... and ${c.wildcardOnlyFiles.length - 20} more`);
  }
}
if (c.uncoveredFiles.length > 0) {
  lines.push("");
  lines.push(`  uncovered (${c.uncoveredFiles.length}):`);
  for (const p of c.uncoveredFiles.slice(0, 20)) lines.push(`    - ${p}`);
  if (c.uncoveredFiles.length > 20) {
    lines.push(`    ... and ${c.uncoveredFiles.length - 20} more`);
  }
}
```

- [ ] **Step 3: Update audit.ts tests if they assert on old shape**

Read `test/audit.test.ts`. Find any assertion like `report.coverage.covered` or `report.coverage.undocumented`. Update to use `explicit`, `explicitFiles`, `wildcardOnly`, `uncovered`, `uncoveredFiles`, `wildcardOnlyFiles`. Don't change the *intent* of the tests — translate the assertion to the new shape.

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: clean (no errors).

- [ ] **Step 5: Run full test suite**

Run: `pnpm test`
Expected: all tests pass (73+ — the originals minus the two we removed in Task 2 plus the four new ones).

- [ ] **Step 6: Smoke test against this repo**

Run: `pnpm build && node dist/audit-cli.cjs`

Expected output starts roughly like:

```
freshdocs audit

Coverage:
  Explicitly documented: 3/18 (16.7%)
  Wildcard-only:         15/18
  Uncovered:             0/18

  wildcard-only (15):
    - src/audience.ts
    ...
```

The previously-reported "16/16 (100%)" is now honestly split — README's `src/**` no longer satisfies existence.

- [ ] **Step 7: Commit**

```bash
git add src/audit-cli.ts src/audit.ts test/audit.test.ts dist/
git commit -m "feat(audit): render explicit/wildcard-only/uncovered coverage split"
```

---

## Task 4: Extend `Finding.kind` to include `"uncovered"`

**Files:**
- Modify: `src/detect-engine.ts`
- Modify: `src/reporter.ts`

- [ ] **Step 1: Update the Finding interface in `src/detect-engine.ts`**

Locate (around line 6):

```ts
export interface Finding {
  doc: string;
  kind: "drift" | "broken-link" | "macro-stale";
  severity: Severity;
  reason: string;
}
```

Replace with:

```ts
export interface Finding {
  /** For drift/broken-link/macro-stale this is a doc path. For uncovered it is the file lacking docs. */
  doc: string;
  kind: "drift" | "broken-link" | "macro-stale" | "uncovered";
  severity: Severity;
  reason: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: clean (the union is just being extended).

- [ ] **Step 3: Run existing tests to confirm no regression**

Run: `pnpm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/detect-engine.ts
git commit -m "feat(detect): extend Finding.kind with 'uncovered'

For uncovered findings the `doc` field carries the file path that
lacks documentation, not a doc path. Documented inline."
```

---

## Task 5: Implement `detectUncovered` (pure, per-commit)

**Files:**
- Modify: `src/detect-engine.ts`
- Create: (new test cases in) `test/detect-engine.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `test/detect-engine.test.ts`:

```ts
import { detectUncovered } from "../src/detect-engine.ts";

test("detectUncovered: flags a newly-added src file with no explicit cover", () => {
  const findings = detectUncovered({
    newlyAddedFiles: ["src/api/widget.ts"],
    index: index({ path: "docs/agents/api.md", audience: "agent", covers: ["src/**"] }),
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.kind, "uncovered");
  assert.equal(findings[0]!.doc, "src/api/widget.ts");
  assert.equal(findings[0]!.severity, "warn");
});

test("detectUncovered: does NOT flag when an explicit cover lists the file", () => {
  const findings = detectUncovered({
    newlyAddedFiles: ["src/api/widget.ts"],
    index: index({ path: "docs/agents/api.md", audience: "agent", covers: ["src/api/widget.ts"] }),
  });
  assert.deepEqual(findings, []);
});

test("detectUncovered: ignores files outside code prefixes", () => {
  const findings = detectUncovered({
    newlyAddedFiles: ["scripts/release.sh", "config/foo.yml"],
    index: index({ path: "docs/agents/api.md", audience: "agent", covers: [] }),
  });
  assert.deepEqual(findings, []);
});

test("detectUncovered: ignores markdown files (docs themselves)", () => {
  const findings = detectUncovered({
    newlyAddedFiles: ["src/notes.md"],
    index: index({ path: "docs/agents/api.md", audience: "agent", covers: [] }),
  });
  assert.deepEqual(findings, []);
});

test("detectUncovered: honors a custom codePrefixes override", () => {
  const findings = detectUncovered({
    newlyAddedFiles: ["custom/foo.ts"],
    index: index({ path: "docs/agents/x.md", audience: "agent", covers: [] }),
    codePrefixes: ["custom/"],
  });
  assert.equal(findings.length, 1);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test --test-name-pattern="detectUncovered"`
Expected: 5 FAIL with `detectUncovered is not a function`.

- [ ] **Step 3: Implement `detectUncovered` in `src/detect-engine.ts`**

Add to the bottom of `src/detect-engine.ts`:

```ts
import { isExplicitCover } from "./coverage.ts";

export const DEFAULT_CODE_PREFIXES = ["src/", "lib/", "app/", "packages/"] as const;

export interface UncoveredInput {
  /** Files newly created (git status A) in this commit / staged set. */
  newlyAddedFiles: string[];
  index: DocIndex;
  /** Override the default code-surface prefixes. */
  codePrefixes?: readonly string[];
}

/**
 * Per-commit existence detector. Fires WARN for every newly-added source file
 * that no doc lists explicitly. Wildcards do not satisfy this check —
 * `src/**` keeps drift wired, but doesn't pre-satisfy existence for new files.
 */
export function detectUncovered({
  newlyAddedFiles,
  index,
  codePrefixes = DEFAULT_CODE_PREFIXES,
}: UncoveredInput): Finding[] {
  const explicitSet = new Set<string>();
  for (const entry of index.entries) {
    for (const cover of entry.meta.covers) {
      if (isExplicitCover(cover)) explicitSet.add(cover);
    }
  }

  const findings: Finding[] = [];
  for (const file of newlyAddedFiles) {
    if (file.endsWith(".md")) continue;
    if (!codePrefixes.some((p) => file.startsWith(p))) continue;
    if (explicitSet.has(file)) continue;
    findings.push({
      doc: file,
      kind: "uncovered",
      severity: "warn",
      reason: "new source file with no explicit doc coverage",
    });
  }
  return findings;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test --test-name-pattern="detectUncovered"`
Expected: 5 PASS.

- [ ] **Step 5: Full test suite still green**

Run: `pnpm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/detect-engine.ts test/detect-engine.test.ts
git commit -m "feat(detect): add detectUncovered for per-commit existence WARN"
```

---

## Task 6: Add `uncovered` state list to `AuditReport`

**Files:**
- Modify: `src/audit.ts`
- Test: `test/audit.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/audit.test.ts`:

```ts
test("runAudit: uncovered field lists files no doc reaches explicitly", async () => {
  // Use a tmp dir or in-memory setup matching how audit.test.ts already does it.
  // The assertion: report.uncovered === report.coverage.uncoveredFiles (delegation).
  // If audit.test.ts builds via the actual filesystem, the test reuses that fixture
  // and asserts uncovered list is exactly the uncoveredFiles list from coverage.
  const report = await runAudit(fixtureRoot, { fetch: async () => null });
  assert.deepEqual(report.uncovered, report.coverage.uncoveredFiles);
});
```

> **Note:** the exact fixture wiring depends on how `audit.test.ts` already sets up `runAudit`. Read the existing tests in `test/audit.test.ts` first and follow the same fixture pattern. The substantive assertion is that `report.uncovered` equals `report.coverage.uncoveredFiles`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --test-name-pattern="uncovered field"`
Expected: FAIL — `report.uncovered` is undefined.

- [ ] **Step 3: Extend `AuditReport` and `runAudit` in `src/audit.ts`**

In `src/audit.ts`, locate the `AuditReport` interface:

```ts
export interface AuditReport {
  coverage: CoverageReport;
  overdue: OverdueDoc[];
  brokenLinks: Finding[];
  externalLinks: LinkStatus[];
}
```

Add `uncovered` field:

```ts
export interface AuditReport {
  coverage: CoverageReport;
  overdue: OverdueDoc[];
  brokenLinks: Finding[];
  externalLinks: LinkStatus[];
  /** Files in the code surface that no doc lists explicitly. Mirrors coverage.uncoveredFiles. */
  uncovered: string[];
}
```

And in the return statement of `runAudit`, add the field:

```ts
return { coverage, overdue, brokenLinks, externalLinks, uncovered: coverage.uncoveredFiles };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test --test-name-pattern="uncovered field"`
Expected: PASS.

- [ ] **Step 5: Full test suite green**

Run: `pnpm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/audit.ts test/audit.test.ts
git commit -m "feat(audit): expose uncovered file list on AuditReport"
```

---

## Task 7: `gitNewlyAddedFiles` helper in `cli-main.ts`

**Files:**
- Modify: `src/cli-main.ts`

- [ ] **Step 1: Add the new helper**

In `src/cli-main.ts`, just below the existing `gitStagedFiles` function, add:

```ts
/** Files staged for the current commit with git status A (newly created). */
function gitNewlyAddedFiles(cwd: string): string[] {
  const out = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=A"],
    { cwd, encoding: "utf8" },
  );
  return out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}
```

- [ ] **Step 2: Update the main block to pass newly-added files to `runGate`**

In `src/cli-main.ts`, change the main block from:

```ts
const cwd = process.cwd();
const { exitCode, output } = runGate(cwd, gitStagedFiles(cwd));
process.stdout.write(`${output}\n`);
process.exit(exitCode);
```

To:

```ts
const cwd = process.cwd();
const { exitCode, output } = runGate(cwd, gitStagedFiles(cwd), {
  newlyAddedFiles: gitNewlyAddedFiles(cwd),
});
process.stdout.write(`${output}\n`);
process.exit(exitCode);
```

Note: `runGate` will be updated in Task 8 to accept the new option. Typecheck will be red until then.

- [ ] **Step 3: Typecheck (expected red)**

Run: `pnpm typecheck`
Expected: error in `cli-main.ts` — `runGate` doesn't accept `newlyAddedFiles` yet.

- [ ] **Step 4: Commit (build-broken; will be fixed in next task)**

```bash
git add src/cli-main.ts
git commit -m "feat(gate): collect git-status-A files for uncovered detection

cli-main.ts now passes a `newlyAddedFiles` list to runGate alongside
the existing staged-files list. runGate will consume it in the next
commit; typecheck currently red."
```

---

## Task 8: Wire `detectUncovered` into `runGate`

**Files:**
- Modify: `src/cli.ts`
- Test: `test/run-gate.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/run-gate.test.ts` (or wherever runGate is tested). The test should set up a small fixture repo where:
- A new file `src/foo.ts` is in `newlyAddedFiles`
- No doc has explicit cover for `src/foo.ts`
- Expected: `runGate` output contains an uncovered WARN line for `src/foo.ts`.

Sketch:

```ts
test("runGate: uncovered WARN for newly-added src file with no explicit cover", () => {
  const report = runGate(fixtureRoot, [], {
    previousFingerprint: null,
    newlyAddedFiles: ["src/foo.ts"],
  });
  assert.match(report.output, /⚠ WARN\s+src\/foo\.ts — new source file with no explicit doc coverage/);
  // WARN doesn't fail the gate.
  assert.equal(report.exitCode, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test --test-name-pattern="uncovered WARN"`
Expected: FAIL — `newlyAddedFiles` is not a recognized GateOptions key.

- [ ] **Step 3: Update `GateOptions` and `runGate` in `src/cli.ts`**

In `src/cli.ts`, extend `GateOptions`:

```ts
export interface GateOptions {
  /** Override the previous fingerprint (null = structural check disabled). Default reads git HEAD. */
  previousFingerprint?: Fingerprint | null;
  /** Files newly created (git status A) in this change set. Default: empty (no uncovered check). */
  newlyAddedFiles?: string[];
}
```

Then update `runGate` to call `detectUncovered` and compose its findings:

Add at the top of `cli.ts`:

```ts
import { detect, detectUncovered } from "./detect-engine.ts";
```

(Replace the existing `import { detect } ...` line.)

Inside `runGate`, after the `structural` array is built and before the `findings = [...]` composition:

```ts
const uncovered = (opts.newlyAddedFiles && opts.newlyAddedFiles.length > 0)
  ? detectUncovered({ newlyAddedFiles: opts.newlyAddedFiles, index })
  : [];
```

Then update the findings composition to include it:

```ts
const findings = [
  ...detect({ changedFiles, index }),
  ...checkInternalLinks(changedDocs, existingFiles),
  ...structural,
  ...uncovered,
];
```

- [ ] **Step 4: Run gate tests to verify they pass**

Run: `pnpm test --test-name-pattern="runGate"`
Expected: all pass including the new uncovered case.

- [ ] **Step 5: Full test suite + typecheck**

Run: `pnpm typecheck && pnpm test`
Expected: typecheck clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts test/run-gate.test.ts
git commit -m "feat(gate): wire detectUncovered into runGate composition"
```

---

## Task 9: Audit CLI renders uncovered findings inline

**Files:**
- Modify: `src/audit-cli.ts`

(Coverage already shows uncovered files. This step ensures the "External links" section is preceded by a clean "Uncovered:" status line for the audit's TOP-OF-REPORT view, mirroring how brokenLinks/overdue/etc are surfaced.)

- [ ] **Step 1: Decide whether the report needs an explicit "Uncovered:" section beyond what coverage already shows**

Look at the current `render()` function output. The coverage section now lists uncovered files. **No extra section is needed** — the coverage block IS the uncovered status. This task is therefore a no-op for the rendering code itself, but used as a checkpoint to:

- Re-build dist
- Run a fresh smoke audit on this repo
- Confirm the report reads well end-to-end

- [ ] **Step 2: Build and smoke**

Run:
```bash
pnpm build
node dist/audit-cli.cjs
```

Expected: a clean report with the three coverage numbers, no broken sections, the previously-flagged URL either healthy or flagged (depending on network).

- [ ] **Step 3: Commit only if `dist/` actually changed**

```bash
git add dist/
git diff --cached --stat
# if no real changes, abort: git reset
# else:
git commit -m "build: rebuild dist after audit-cli + cli + detect-engine changes"
```

---

## Task 10: Update `SKILL.md` with the Creation loop + decision table

**Files:**
- Modify: `SKILL.md`

- [ ] **Step 1: Add a "Creation loop" section to `SKILL.md`**

Insert AFTER the existing "## The repair loop" section, BEFORE "## DRY and consolidation methodology":

```markdown
## The creation loop

When `/freshdocs:create-docs` is invoked (sweep or targeted), follow this loop:

1. **Audit first.** Run `freshdocs-audit` to get the `uncovered` and `wildcardOnly` lists. Sweep mode operates on these; targeted mode operates on the user-supplied path.

2. **Sweep mode: cluster semantically.** Read the source of each uncovered/wildcard-only file. Group files that belong to one cohesive subject into a single proposed doc (`docs/agents/<name>.md`). Do NOT propose one doc per file — the result must be navigable.

3. **Present the cluster proposal to the user.** Show the grouping and let them edit it before any prose is drafted.

4. **Draft per group, code-first.** For each approved group:
   - Read every source file in the group.
   - Draft a concise reference doc: purpose, public API, how it's invoked, gotchas. Lean toward terse over verbose — agent docs are reference material.
   - Mark anything you can't confidently infer from code as `[CLARIFY: ...]` inline. Never invent prose.
   - Write the file to `docs/agents/<name>.md` with full docmeta (audience: agent, covers: <literal paths>, synced: <HEAD SHA>, reviewed: <today YYYY-MM-DD>, review_interval: 30d).

5. **Review per file.** Surface the draft to the user; accept their edits before the next group.

6. **Hand off to grill-with-docs when you'd otherwise invent domain language.** If drafting requires more than ~2 unknown business / workflow / terminology terms, STOP and surface: "This doc needs domain language before I can draft confidently. Invoke `grill-with-docs` first?" Never invent terminology.

7. **Workflow / orientation docs are targeted-mode only in v1.** If sweep mode encounters a workflow doc candidate, note it but do not draft. The user invokes `/freshdocs:create-docs docs/workflows/<name>.md` explicitly.
```

- [ ] **Step 2: Add the decision table to `SKILL.md`**

Insert at the end of `SKILL.md`, after the "## What this skill does NOT do" section:

```markdown
## When to use which command

| Situation | First command |
|---|---|
| Fresh repo / starting adoption | `/freshdocs:doc-audit` → `/freshdocs:create-docs` (sweep) |
| Commit blocked by gate | `/freshdocs:update-docs` |
| Commit warned: new uncovered file | `/freshdocs:create-docs <path>` |
| Want to document a specific module now | `/freshdocs:create-docs <path>` |
| Quarterly review / pre-release | `/freshdocs:doc-audit` → dispatch |
| Doc contradicts accepted ADR | hand off to `grill-with-docs` (superseding ADR) |
| New CONTEXT.md / domain language needed | hand off to `grill-with-docs` |
```

- [ ] **Step 3: Bump SKILL.md's docmeta**

Update SKILL.md's frontmatter `reviewed:` to today's date and `synced:` to the current main HEAD SHA.

Run: `git rev-parse HEAD` — note the SHA.

Update the frontmatter:

```yaml
synced: <HEAD-SHA-FROM-ABOVE>
reviewed: <TODAY-YYYY-MM-DD>
```

- [ ] **Step 4: Commit**

```bash
git add SKILL.md
git commit -m "docs(skill): add creation loop + decision table"
```

---

## Task 11: Create `commands/create-docs.md`

**Files:**
- Create: `commands/create-docs.md`

- [ ] **Step 1: Write the new slash command file**

Create `commands/create-docs.md` with:

```markdown
---
description: Author missing per-module / workflow / orientation docs. Sweep mode walks all uncovered findings; targeted mode authors a specific unit. Hands off to grill-with-docs for domain-language territory.
audience: agent
covers: ["src/audit-cli.ts", "src/audit.ts", "src/coverage.ts", "src/detect-engine.ts"]
synced: <HEAD-SHA>
reviewed: <TODAY>
review_interval: 30d
---

You are authoring missing documentation for this repo.

1. Activate the `freshdocs` skill (read its SKILL.md) before doing anything else. The creation loop is documented there.

2. Determine the mode:
   - **No argument** → sweep mode. Walk every uncovered / wildcard-only finding from the audit.
   - **Argument is a source path or glob** → targeted mode for that unit; the doc location is inferred (`docs/agents/<name>.md`).
   - **Argument is a doc path** → scaffold at that path. For `docs/workflows/<name>.md` and `docs/overview.md`, scaffold a structured outline and ask the user to fill the prose.

3. **Audit first.** Run `freshdocs-audit` and capture `uncovered` + `wildcardOnly` lists, plus full file paths.
   - Bin resolution: try `freshdocs-audit` on PATH; fall back to `node_modules/.bin/freshdocs-audit`; final fallback `node .agents/skills/freshdocs/dist/audit-cli.cjs`.

4. **Sweep mode: cluster and propose.**
   - Read every source file in the uncovered + wildcard-only sets.
   - Propose a per-module clustering. Files that share purpose go into one doc; one-doc-per-file is rarely right.
   - Surface the proposal to the user as a table: doc path → files it'll cover. Ask for approval / edits before drafting anything.

5. **Draft each approved group.**
   - Read every source file in the group.
   - Author a concise reference doc (purpose, public API, invocation, gotchas).
   - Inline `[CLARIFY: ...]` markers for anything you can't infer from code; never invent prose.
   - Write to `docs/agents/<name>.md` with full docmeta:
     ```yaml
     ---
     audience: agent
     covers: [<literal file paths>]
     synced: <current HEAD SHA>
     reviewed: <today YYYY-MM-DD>
     review_interval: 30d
     ---
     ```

6. **Review per file.** Show the draft to the user. Accept their edits. Save. Move to the next group.

7. **Hand off to `grill-with-docs`** the moment drafting would require >2 unknown domain terms. Do not silently invent terminology. Surface: "This doc needs domain language. Invoke `grill-with-docs` first?"

8. **Do not edit accepted ADRs or do substantive CONTEXT.md rewrites** — same as `/freshdocs:update-docs`.

9. **After every draft, stage** the new doc(s) (do not commit on the user's behalf unless they asked).

10. **Re-run `freshdocs-audit`** at the end. Confirm the `uncovered` list shrank by what you authored. Surface any remaining gaps.
```

Replace `<HEAD-SHA>` with the current main HEAD SHA (`git rev-parse HEAD`) and `<TODAY>` with today's date.

- [ ] **Step 2: Verify the file parses cleanly**

Run: `pnpm build && node dist/audit-cli.cjs --init`
Expected: the new command file doesn't break anything; audit still works.

- [ ] **Step 3: Commit**

```bash
git add commands/create-docs.md
git commit -m "feat(commands): add /freshdocs:create-docs slash command

Sweep + targeted modes. Cluster-first authoring. grill-with-docs handoff
when domain language is needed. Docs land at docs/agents/<name>.md with
full docmeta."
```

---

## Task 12: README updates (detect table + recipes + decision table)

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update "What it detects" table**

In `README.md`, locate the table that starts with `| Class | Signal | Where it fires |`. Add a new row before the "External link health" row:

```markdown
| Uncovered (new) | A newly-added source file has no doc listing it explicitly | Gate (per-commit, WARN) + Audit (state) |
```

And update the "Coverage gaps" row to reflect the explicit vs wildcard split:

```markdown
| Coverage gaps | Code files reached only by wildcard `covers:` or not at all (explicit literal paths satisfy the existence axis) | Audit |
```

- [ ] **Step 2: Add the three workflow recipes**

Insert AFTER the `## What it detects` section, BEFORE `## The 'docmeta' convention`:

```markdown
## Workflow recipes

### A. Onboarding sweep (primary entry, fresh repo)

\`\`\`
1. npx skills add schrmm/freshdocs       # vendors skill + bins
2. freshdocs-install-commands             # one-time, global slash commands
3. freshdocs-install-hook                 # per-repo, wire pre-commit
4. freshdocs-audit --init --apply         # bootstrap empty docmeta blocks
5. /freshdocs:doc-audit                   # see the honest gap
6. /freshdocs:create-docs                 # sweep: cluster → approve → draft → review
7. /freshdocs:update-docs                 # repair any pre-existing drift
8. git add . && git commit                # gate should pass
\`\`\`

### B. Steady-state commit loop (the heartbeat)

\`\`\`
1. Edit code → git add → git commit
2. Pre-commit hook runs doc-gate:
   ├─ Clean                   → commit lands
   ├─ Drift / broken-link     → BLOCKS  → /freshdocs:update-docs → re-commit
   ├─ Uncovered (new file)    → WARN    → commit lands; /freshdocs:create-docs <path> when ready
   └─ Macro-stale             → WARN    → commit lands; review when convenient
\`\`\`

### C. Periodic health-check (safety net)

\`\`\`
1. /freshdocs:doc-audit
2. Read sections:
   - Explicit coverage % — gap visible
   - Overdue reviews     → /freshdocs:update-docs
   - Uncovered (state)   → /freshdocs:create-docs
   - Broken external     → /freshdocs:update-docs
   - Macro-stale         → /freshdocs:update-docs
\`\`\`

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
```

(Note: the backslash-escaped triple-backticks above are the markdown literal — when written into README.md, use plain triple-backticks.)

- [ ] **Step 3: Update README's `synced:` to current main HEAD**

Run: `git rev-parse HEAD`

Update README's docmeta frontmatter `synced:` to that SHA and `reviewed:` to today.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): document uncovered finding + three workflow recipes"
```

---

## Task 13: Dogfooding pass — re-audit + sample sweep on this repo

**Files:**
- (None — this is verification.)

- [ ] **Step 1: Re-run audit and capture honest coverage numbers**

Run: `pnpm build && node dist/audit-cli.cjs > /tmp/audit-after.txt && cat /tmp/audit-after.txt`

Expected: coverage section shows ~3/18 explicit (the modules SKILL.md and commands explicitly list — `cli.ts`, `cli-main.ts`, `audit.ts`, `audit-cli.ts`, `coverage.ts`, `detect-engine.ts`, `structural-fingerprint.ts`, `link-checker.ts`, `url-health.ts`, `bump-frontmatter.ts` — the exact count depends on how many we listed in covers). The rest wildcard-only via README's `src/**`.

This is the "honest baseline" for the freshdocs repo. **Do not write per-module docs in this task** — that's a separate dogfooding session using `/freshdocs:create-docs` once it's wired.

- [ ] **Step 2: Verify gate is clean**

Run: `node dist/cli-main.cjs`

Expected: `freshdocs: docs up to date — no issues detected.` (no `uncovered` WARN because no src files are newly-added in this branch).

- [ ] **Step 3: Verify install-commands resync picks up the new command**

Run: `node dist/install-commands-cli.cjs`

Expected: `freshdocs: installed 3 slash command(s) into ~/.claude/commands/freshdocs` (count went from 2 to 3).

Reload Claude Code (or start a new session) — `/freshdocs:create-docs` should now appear in the available skills list alongside `/freshdocs:doc-audit` and `/freshdocs:update-docs`.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin <branch-name>
gh pr create --title "feat: /freshdocs:create-docs + strict coverage" --body "$(cat <<'EOF'
## Summary

Implements docs/specs/2026-05-24-create-docs-and-strict-coverage.md:
- Strict coverage: explicit vs wildcard-only vs uncovered, with `percent = explicit/total` as the honest metric.
- New `uncovered` Finding.kind. Audit-state always; gate per-commit WARN for git-status-A files under code prefixes.
- New /freshdocs:create-docs slash command (sweep + targeted modes).
- SKILL.md + README updated with creation loop, decision table, three workflow recipes.

## Verification

- All previous tests pass; new tests cover the predicate, the split coverage report, detectUncovered, and runGate composition.
- Re-audit on this repo: 16/16 (100%) → ~3/18 explicit (honest), the rest wildcard-only via README's src/**.
- Gate clean (no uncovered findings because no newly-added src files in this PR).

## Test plan

- [x] Tests pass + build clean
- [x] Audit reports honest split coverage
- [x] Gate clean
- [x] /freshdocs:create-docs visible after install-commands resync
EOF
)"
```

- [ ] **Step 5: Squash-merge, sync main**

After the PR is approved and merged:

```bash
gh pr merge --squash --delete-branch
git checkout main
git pull --ff-only
```

---

## Self-review checklist

After execution, verify:

1. **Spec coverage:** Every section of the v2 spec has at least one task.
   - Strict coverage redefinition → Tasks 1, 2, 3 ✓
   - `uncovered` finding kind → Tasks 4, 5 ✓
   - Audit-state uncovered list → Task 6 ✓
   - Gate per-commit uncovered → Tasks 7, 8 ✓
   - `/freshdocs:create-docs` command → Task 11 ✓
   - SKILL.md creation loop + decision table → Task 10 ✓
   - README workflow recipes + decision table → Task 12 ✓
   - Dogfooding migration on this repo → Task 13 ✓

2. **No placeholders in tasks** — every step shows actual code or actual command output expectations.

3. **Type consistency:**
   - `isExplicitCover` (Task 1) used in Task 2 (`coverageOf`) and Task 5 (`detectUncovered`).
   - `Finding.kind` extended in Task 4, consumed in Task 5 (`detectUncovered`), Task 8 (gate composition).
   - `CoverageReport` rewritten in Task 2, consumed in Task 3 (rendering), Task 6 (audit).
   - `GateOptions.newlyAddedFiles` defined in Task 8, populated by Task 7 (`cli-main.ts`).

4. **Frequent commits** — every task ends with a commit. Tasks 7 and 8 are split because Task 7 leaves typecheck red on purpose (deliberate two-commit handoff documented in commit message).
