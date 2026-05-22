import { test } from "node:test";
import assert from "node:assert/strict";
import { formatReport } from "../src/reporter.ts";
import type { Finding } from "../src/detect-engine.ts";

const fail: Finding = { doc: "docs/agents/api.md", kind: "drift", severity: "fail", reason: "covered file changed without doc update: src/api/x.ts" };
const warn: Finding = { doc: "docs/guide.md", kind: "drift", severity: "warn", reason: "covered file changed without doc update: src/util.ts" };

test("exit code 1 when any finding is a failure", () => {
  const { exitCode } = formatReport([fail, warn]);
  assert.equal(exitCode, 1);
});

test("exit code 0 when only warnings", () => {
  const { exitCode } = formatReport([warn]);
  assert.equal(exitCode, 0);
});

test("exit code 0 and clean message when no findings", () => {
  const { exitCode, output } = formatReport([]);
  assert.equal(exitCode, 0);
  assert.match(output, /no documentation drift|clean|up to date/i);
});

test("output names each flagged doc and its severity", () => {
  const { output } = formatReport([fail, warn]);
  assert.match(output, /docs\/agents\/api\.md/);
  assert.match(output, /docs\/guide\.md/);
  assert.match(output, /fail/i);
  assert.match(output, /warn/i);
});
