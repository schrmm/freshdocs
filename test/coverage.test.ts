import { test } from "node:test";
import assert from "node:assert/strict";
import { coverageOf, isExplicitCover } from "../src/coverage.ts";
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


test("percent is rounded to one decimal", () => {
  const report = coverageOf(
    ["src/a.ts", "src/b.ts", "src/c.ts"],
    index(["src/a.ts"]),
  );
  assert.equal(report.percent, 33.3);
});


test("empty file list returns 0/0 and 100% (no undocumented surface)", () => {
  const report = coverageOf([], index(["src/a.ts"]));
  assert.equal(report.total, 0);
  assert.equal(report.explicit, 0);
  assert.equal(report.wildcardOnly, 0);
  assert.equal(report.uncovered, 0);
  assert.equal(report.percent, 100);
  assert.deepEqual(report.uncoveredFiles, []);
});

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
