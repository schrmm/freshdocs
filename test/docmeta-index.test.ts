import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDocmeta } from "../src/docmeta-index.ts";

test("parses well-formed frontmatter into a gated entry", () => {
  const content = [
    "---",
    "audience: agent",
    'covers: ["src/api/**", "src/config/schema.py"]',
    "synced: a1b2c3d",
    "reviewed: 2026-05-22",
    "review_interval: 90d",
    "---",
    "",
    "# API guide",
  ].join("\n");

  const result = parseDocmeta(content, "docs/agents/api.md");

  assert.equal(result.gated, true);
  assert.ok(result.gated);
  assert.deepEqual(result.entry.meta.covers, ["src/api/**", "src/config/schema.py"]);
  assert.equal(result.entry.meta.audience, "agent");
  assert.equal(result.entry.meta.synced, "a1b2c3d");
  assert.equal(result.entry.meta.reviewed, "2026-05-22");
  assert.equal(result.entry.meta.reviewInterval, "90d");
  assert.equal(result.entry.path, "docs/agents/api.md");
});

test("infers agent audience for docs/agents/ when unspecified", () => {
  const content = "---\ncovers: [\"src/x.ts\"]\n---\nbody";
  const result = parseDocmeta(content, "docs/agents/x.md");
  assert.ok(result.gated);
  assert.equal(result.entry.meta.audience, "agent");
});

test("infers human audience for docs/ when unspecified", () => {
  const content = "---\ncovers: [\"src/x.ts\"]\n---\nbody";
  const result = parseDocmeta(content, "docs/guide.md");
  assert.ok(result.gated);
  assert.equal(result.entry.meta.audience, "human");
});

test("treats agent-context files (CLAUDE.md/AGENTS.md/CONTEXT.md) as agent", () => {
  const content = "---\ncovers: []\n---\nbody";
  for (const path of ["CLAUDE.md", "AGENTS.md", "CONTEXT.md", "src/AGENTS.md"]) {
    const result = parseDocmeta(content, path);
    assert.ok(result.gated, `${path} should be gated`);
    assert.equal(result.entry.meta.audience, "agent", `${path} should be agent`);
  }
});

test("explicit audience overrides path inference", () => {
  const content = "---\naudience: human\ncovers: []\n---\nbody";
  const result = parseDocmeta(content, "docs/agents/x.md");
  assert.ok(result.gated);
  assert.equal(result.entry.meta.audience, "human");
});

test("un-gates a doc with no frontmatter", () => {
  const result = parseDocmeta("# just a heading\n\nno frontmatter here", "docs/x.md");
  assert.equal(result.gated, false);
  assert.ok(!result.gated && /no docmeta/.test(result.reason));
});

test("un-gates a doc with malformed frontmatter", () => {
  const content = "---\naudience: [unclosed\n  bad: : :\n---\nbody";
  const result = parseDocmeta(content, "docs/x.md");
  assert.equal(result.gated, false);
  assert.ok(!result.gated && /malformed/.test(result.reason));
});

test("defaults covers to empty array when absent (macro doc)", () => {
  const content = "---\nreviewed: 2026-05-22\nreview_interval: 60d\n---\nbody";
  const result = parseDocmeta(content, "docs/overview.md");
  assert.ok(result.gated);
  assert.deepEqual(result.entry.meta.covers, []);
});
