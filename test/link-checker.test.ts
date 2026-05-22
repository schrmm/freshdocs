import { test } from "node:test";
import assert from "node:assert/strict";
import { checkInternalLinks } from "../src/link-checker.ts";

test("no finding for a relative link whose target exists", () => {
  const findings = checkInternalLinks(
    [{ path: "docs/a.md", content: "see [b](./b.md)" }],
    new Set(["docs/a.md", "docs/b.md"]),
  );
  assert.deepEqual(findings, []);
});

test("flags a broken relative path as a failing finding", () => {
  const findings = checkInternalLinks(
    [{ path: "docs/a.md", content: "see [gone](./missing.md)" }],
    new Set(["docs/a.md"]),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.doc, "docs/a.md");
  assert.equal(findings[0]!.kind, "broken-link");
  assert.equal(findings[0]!.severity, "fail");
  assert.match(findings[0]!.reason, /missing\.md/);
});

test("resolves links relative to the linking doc's directory", () => {
  const findings = checkInternalLinks(
    [{ path: "docs/guides/a.md", content: "[up](../b.md)" }],
    new Set(["docs/guides/a.md", "docs/b.md"]),
  );
  assert.deepEqual(findings, []);
});

test("flags a broken same-doc anchor", () => {
  const findings = checkInternalLinks(
    [{ path: "docs/a.md", content: "# Title\n\njump to [there](#nope)" }],
    new Set(["docs/a.md"]),
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.kind, "broken-link");
  assert.match(findings[0]!.reason, /#nope/);
});

test("accepts a valid same-doc anchor matching a heading slug", () => {
  const findings = checkInternalLinks(
    [{ path: "docs/a.md", content: "# Getting Started\n\n[go](#getting-started)" }],
    new Set(["docs/a.md"]),
  );
  assert.deepEqual(findings, []);
});

test("ignores external links (http/https/mailto)", () => {
  const findings = checkInternalLinks(
    [{ path: "docs/a.md", content: "[x](https://e.com) [m](mailto:a@b.c) [p](http://e.com/p)" }],
    new Set(["docs/a.md"]),
  );
  assert.deepEqual(findings, []);
});

test("validates an anchor in another existing doc", () => {
  const findings = checkInternalLinks(
    [
      { path: "docs/a.md", content: "[x](./b.md#missing)" },
      { path: "docs/b.md", content: "# Real Heading" },
    ],
    new Set(["docs/a.md", "docs/b.md"]),
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0]!.reason, /#missing/);
});
