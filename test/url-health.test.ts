import { test } from "node:test";
import assert from "node:assert/strict";
import { urlHealth, type Fetcher } from "../src/url-health.ts";

function staticFetcher(map: Record<string, number | null>): Fetcher {
  return async (url: string) => {
    const status = map[url];
    if (status === undefined) throw new Error(`unexpected url: ${url}`);
    return status === null ? null : { status };
  };
}

test("classifies 2xx and 3xx responses as healthy", async () => {
  const results = await urlHealth(["https://a.example", "https://b.example"], {
    fetch: staticFetcher({ "https://a.example": 200, "https://b.example": 301 }),
  });
  assert.ok(results.every((r) => r.ok));
});

test("classifies 4xx and 5xx as broken", async () => {
  const results = await urlHealth(["https://a.example", "https://b.example"], {
    fetch: staticFetcher({ "https://a.example": 404, "https://b.example": 500 }),
  });
  assert.equal(results.find((r) => r.url === "https://a.example")!.ok, false);
  assert.equal(results.find((r) => r.url === "https://b.example")!.ok, false);
});

test("classifies network failures (fetcher returns null) as broken", async () => {
  const results = await urlHealth(["https://gone.example"], {
    fetch: staticFetcher({ "https://gone.example": null }),
  });
  assert.equal(results[0]!.ok, false);
  assert.match(results[0]!.reason!, /network|unreachable|failed/i);
});

test("deduplicates the input URL list", async () => {
  let calls = 0;
  const results = await urlHealth(["https://x.example", "https://x.example"], {
    fetch: async () => {
      calls += 1;
      return { status: 200 };
    },
  });
  assert.equal(calls, 1);
  assert.equal(results.length, 1);
});
