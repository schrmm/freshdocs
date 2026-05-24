import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFrontmatter } from "../src/write-frontmatter.ts";
import { parseDocmeta } from "../src/docmeta-index.ts";

test("prepends a frontmatter block to a doc that has none", () => {
  const out = writeFrontmatter("# Hello\n\nbody", {
    audience: "agent",
    covers: ["src/a.ts"],
    reviewInterval: "30d",
  });
  assert.match(out, /^---\n/);
  // body is preserved verbatim after the closing fence + blank line
  assert.ok(out.endsWith("# Hello\n\nbody"));
});

test("written frontmatter round-trips through parseDocmeta", () => {
  const out = writeFrontmatter("body", {
    audience: "agent",
    covers: ["src/x.ts", "src/y.ts"],
    reviewInterval: "30d",
  });
  const parsed = parseDocmeta(out, "docs/agents/x.md");
  assert.ok(parsed.gated);
  assert.equal(parsed.entry.meta.audience, "agent");
  assert.deepEqual(parsed.entry.meta.covers, ["src/x.ts", "src/y.ts"]);
  assert.equal(parsed.entry.meta.reviewInterval, "30d");
});

test("returns input unchanged when frontmatter is already present", () => {
  const input = "---\naudience: agent\n---\nbody";
  assert.equal(writeFrontmatter(input, { audience: "human", covers: [] }), input);
});

test("omits optional fields that were not supplied", () => {
  const out = writeFrontmatter("body", { audience: "human", covers: [] });
  assert.doesNotMatch(out, /^reviewed:/m);
  assert.doesNotMatch(out, /^review_interval:/m);
  assert.doesNotMatch(out, /^synced:/m);
});
