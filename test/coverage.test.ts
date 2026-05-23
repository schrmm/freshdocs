import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageOf } from "../src/coverage.ts";
import type { DocIndex } from "../src/docmeta-index.ts";

function index(...covers: string[][]): DocIndex {
  return {
    entries: covers.map((c, i) => ({
      path: `docs/agents/d${i}.md`,
      meta: { audience: "agent", covers: c },
    })),
    ungated: [],
  };
}

test("counts a file as covered when any cover glob matches it", () => {
  const report = coverageOf(["src/a.ts", "src/b.ts"], index(["src/a.ts"]));
  assert.equal(report.covered, 1);
  assert.equal(report.total, 2);
  assert.deepEqual(report.undocumented, ["src/b.ts"]);
});

test("percent is rounded to one decimal", () => {
  const report = coverageOf(
    ["src/a.ts", "src/b.ts", "src/c.ts"],
    index(["src/a.ts"]),
  );
  assert.equal(report.percent, 33.3);
});

test("a file matched by more than one glob is counted once", () => {
  const report = coverageOf(["src/a.ts"], index(["src/**"], ["src/a.ts"]));
  assert.equal(report.covered, 1);
  assert.equal(report.total, 1);
  assert.equal(report.percent, 100);
});

test("empty file list returns 0/0 and 100% (no undocumented surface)", () => {
  const report = coverageOf([], index(["src/a.ts"]));
  assert.equal(report.total, 0);
  assert.equal(report.covered, 0);
  assert.equal(report.percent, 100);
  assert.deepEqual(report.undocumented, []);
});
