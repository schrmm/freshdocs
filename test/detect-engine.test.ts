import { test } from "node:test";
import assert from "node:assert/strict";
import { detect, detectUncovered } from "../src/detect-engine.ts";
import type { DocIndex } from "../src/docmeta-index.ts";

function index(...entries: Array<{ path: string; audience: "agent" | "human"; covers: string[] }>): DocIndex {
  return {
    entries: entries.map((e) => ({ path: e.path, meta: { audience: e.audience, covers: e.covers } })),
    ungated: [],
  };
}

test("flags an agent doc as fail when a covered file changed and the doc was not touched", () => {
  const findings = detect({
    changedFiles: ["src/api/users.ts"],
    index: index({ path: "docs/agents/api.md", audience: "agent", covers: ["src/api/**"] }),
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.doc, "docs/agents/api.md");
  assert.equal(findings[0]!.kind, "drift");
  assert.equal(findings[0]!.severity, "fail");
});

test("does not flag when the doc itself is updated in the same change set", () => {
  const findings = detect({
    changedFiles: ["src/api/users.ts", "docs/agents/api.md"],
    index: index({ path: "docs/agents/api.md", audience: "agent", covers: ["src/api/**"] }),
  });
  assert.deepEqual(findings, []);
});

test("flags a human doc as warn", () => {
  const findings = detect({
    changedFiles: ["src/util.ts"],
    index: index({ path: "docs/guide.md", audience: "human", covers: ["src/util.ts"] }),
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.severity, "warn");
});

test("path-filter: no finding when no changed file matches any cover glob", () => {
  const findings = detect({
    changedFiles: ["README.md", "src/unrelated.ts"],
    index: index({ path: "docs/agents/api.md", audience: "agent", covers: ["src/api/**"] }),
  });
  assert.deepEqual(findings, []);
});

test("matches exact-path covers as well as globs", () => {
  const findings = detect({
    changedFiles: ["src/config/schema.py"],
    index: index({ path: "docs/agents/config.md", audience: "agent", covers: ["src/config/schema.py"] }),
  });
  assert.equal(findings.length, 1);
});

test("a doc with no covers (macro) is never drift-flagged", () => {
  const findings = detect({
    changedFiles: ["src/anything.ts"],
    index: index({ path: "docs/overview.md", audience: "human", covers: [] }),
  });
  assert.deepEqual(findings, []);
});

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
    newlyAddedFiles: ["config/foo.yml"],
    index: index({ path: "docs/agents/api.md", audience: "agent", covers: [] }),
  });
  assert.deepEqual(findings, []);
});

test("detectUncovered: flags newly-added scripts by default", () => {
  const findings = detectUncovered({
    newlyAddedFiles: ["scripts/migrate_agent_assets.py"],
    index: index({ path: "docs/agents/api.md", audience: "agent", covers: [] }),
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.doc, "scripts/migrate_agent_assets.py");
  assert.equal(findings[0]!.kind, "uncovered");
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
