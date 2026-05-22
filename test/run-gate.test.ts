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
