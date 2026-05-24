import { test } from "node:test";
import assert from "node:assert/strict";
import { bumpFrontmatter } from "../src/bump-frontmatter.ts";

const sample = [
  "---",
  "audience: agent",
  'covers: ["src/a.ts"]',
  "synced: old123",
  "reviewed: 2026-01-01",
  "---",
  "",
  "# Body kept",
].join("\n");

test("updates existing synced and reviewed fields, preserves body", () => {
  const out = bumpFrontmatter(sample, { synced: "newabc", reviewed: "2026-05-23" });
  assert.match(out, /^synced: newabc$/m);
  assert.match(out, /^reviewed: 2026-05-23$/m);
  assert.match(out, /# Body kept/);
});

test("preserves unrelated frontmatter fields untouched", () => {
  const out = bumpFrontmatter(sample, { synced: "newabc", reviewed: "2026-05-23" });
  assert.match(out, /^audience: agent$/m);
  assert.match(out, /^covers: \["src\/a\.ts"\]$/m);
});

test("inserts missing fields before the closing fence", () => {
  const content = [
    "---",
    "audience: agent",
    'covers: ["src/a.ts"]',
    "---",
    "",
    "body",
  ].join("\n");
  const out = bumpFrontmatter(content, { synced: "abc", reviewed: "2026-05-23" });
  assert.match(out, /^synced: abc$/m);
  assert.match(out, /^reviewed: 2026-05-23$/m);
  // closing fence still present and body intact
  const fences = out.match(/^---$/gm);
  assert.equal(fences?.length, 2);
  assert.match(out, /\nbody$/);
});

test("returns input unchanged when there is no frontmatter", () => {
  const content = "# Just a heading\n\nno frontmatter here";
  assert.equal(bumpFrontmatter(content, { synced: "x", reviewed: "y" }), content);
});

test("updates only the requested fields when only one is given", () => {
  const out = bumpFrontmatter(sample, { synced: "newabc" });
  assert.match(out, /^synced: newabc$/m);
  assert.match(out, /^reviewed: 2026-01-01$/m); // unchanged
});
