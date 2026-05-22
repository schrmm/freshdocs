import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runGate } from "../src/cli.ts";

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "freshdocs-gate-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

test("runGate fails (exit 1) when staged code drifts from an agent doc", () => {
  const root = fixture({
    "docs/agents/api.md": "---\ncovers: [\"src/api/**\"]\nsynced: abc\n---\nguide",
  });
  try {
    const { exitCode, output } = runGate(root, ["src/api/users.ts"]);
    assert.equal(exitCode, 1);
    assert.match(output, /docs\/agents\/api\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runGate passes (exit 0) when the doc is updated alongside the code", () => {
  const root = fixture({
    "docs/agents/api.md": "---\ncovers: [\"src/api/**\"]\nsynced: abc\n---\nguide",
  });
  try {
    const { exitCode } = runGate(root, ["src/api/users.ts", "docs/agents/api.md"]);
    assert.equal(exitCode, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runGate fails when a changed doc has a broken internal link", () => {
  const root = fixture({
    "docs/a.md": "see [gone](./missing.md)",
    "docs/b.md": "ok",
  });
  try {
    const { exitCode, output } = runGate(root, ["docs/a.md"]);
    assert.equal(exitCode, 1);
    assert.match(output, /missing\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runGate passes when a changed doc's internal links resolve", () => {
  const root = fixture({
    "docs/a.md": "see [b](./b.md)",
    "docs/b.md": "# B",
  });
  try {
    const { exitCode } = runGate(root, ["docs/a.md"]);
    assert.equal(exitCode, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("runGate only link-checks changed docs, not untouched ones", () => {
  const root = fixture({
    "docs/a.md": "[gone](./missing.md)",
    "docs/b.md": "ok",
  });
  try {
    // commit touches b.md only; a.md's broken link must not be reported
    const { exitCode } = runGate(root, ["docs/b.md"]);
    assert.equal(exitCode, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
