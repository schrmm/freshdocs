import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeFingerprint,
  fingerprintHash,
  diffFingerprints,
  macroFindings,
} from "../src/structural-fingerprint.ts";

test("computeFingerprint sorts and dedupes each category", () => {
  const fp = computeFingerprint({
    topLevel: ["src", "docs", "src"],
    scripts: ["test", "build", "build"],
    bin: ["doc-gate"],
  });
  assert.deepEqual(fp.topLevel, ["docs", "src"]);
  assert.deepEqual(fp.scripts, ["build", "test"]);
  assert.deepEqual(fp.bin, ["doc-gate"]);
});

test("fingerprintHash is identical for the same shape regardless of input order", () => {
  const a = computeFingerprint({ topLevel: ["src", "docs"], scripts: ["a", "b"], bin: [] });
  const b = computeFingerprint({ topLevel: ["docs", "src"], scripts: ["b", "a"], bin: [] });
  assert.equal(fingerprintHash(a), fingerprintHash(b));
});

test("fingerprintHash differs when the shape changes", () => {
  const a = computeFingerprint({ topLevel: ["src"], scripts: [], bin: [] });
  const b = computeFingerprint({ topLevel: ["src", "services"], scripts: [], bin: [] });
  assert.notEqual(fingerprintHash(a), fingerprintHash(b));
});

test("diffFingerprints reports an added top-level dir", () => {
  const prev = computeFingerprint({ topLevel: ["src"], scripts: [], bin: [] });
  const curr = computeFingerprint({ topLevel: ["src", "services"], scripts: [], bin: [] });
  const changes = diffFingerprints(prev, curr);
  assert.ok(changes.some((c) => c.kind === "dir-added" && c.name === "services"));
});

test("diffFingerprints reports a removed script", () => {
  const prev = computeFingerprint({ topLevel: [], scripts: ["build", "test"], bin: [] });
  const curr = computeFingerprint({ topLevel: [], scripts: ["build"], bin: [] });
  const changes = diffFingerprints(prev, curr);
  assert.ok(changes.some((c) => c.kind === "script-removed" && c.name === "test"));
});

test("macroFindings warns on untouched macro docs when structure changed", () => {
  const changes = [{ kind: "dir-added", name: "services" } as const];
  const findings = macroFindings(changes, ["README.md", "docs/overview.md"], ["src/x.ts"]);
  assert.equal(findings.length, 2);
  assert.ok(findings.every((f) => f.kind === "macro-stale" && f.severity === "warn"));
});

test("macroFindings emits nothing when structure is unchanged", () => {
  assert.deepEqual(macroFindings([], ["README.md"], ["README.md"]), []);
});

test("macroFindings skips a macro doc updated in the same commit", () => {
  const changes = [{ kind: "dir-added", name: "services" } as const];
  const findings = macroFindings(changes, ["README.md", "docs/overview.md"], ["README.md"]);
  assert.deepEqual(findings.map((f) => f.doc), ["docs/overview.md"]);
});
