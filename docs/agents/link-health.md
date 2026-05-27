---
audience: agent
covers: ["src/link-checker.ts", "src/url-health.ts"]
synced: 9b65e4676494a1b603aa844f907ba0ff1537884f
reviewed: 2026-05-27
review_interval: 30d
---

# Link health

The link-health layer has two responsibilities: pure internal markdown link validation, and externally injected URL health classification for audits. Commit gates only use internal links; external URL checks stay on the audit path so network behavior never blocks a commit.

## Internal links (`src/link-checker.ts`)

```ts
interface DocFile { path: string; content: string }
function checkInternalLinks(docs: DocFile[], existingFiles: Set<string>): Finding[];
function externalUrlsFrom(docs: DocFile[]): string[];
```

`checkInternalLinks` scans inline markdown links in each supplied doc:

- External targets are ignored by this function. A target is external when it has a URI scheme (`https:`, `mailto:`) or is protocol-relative (`//example.com`).
- Same-doc anchors (`[#heading]`) are checked against heading slugs from the current doc.
- Relative file targets are resolved from the linking doc's directory with POSIX paths.
- Relative links fail when the normalized target path is absent from `existingFiles`.
- Cross-doc anchors are checked when the target document content is present in the supplied `docs` array.

Findings are always:

```ts
{ doc, kind: "broken-link", severity: "fail", reason }
```

The caller decides whether that failure blocks. In the commit gate, broken internal links block even when `FRESHDOCS_NO_BEHAVIOR_CHANGE=1` is active.

## Heading slugs

Heading anchors use a small GitHub-like slugger:

1. Trim heading text.
2. Lowercase.
3. Remove characters outside word, whitespace, and hyphen.
4. Collapse whitespace to `-`.

This is deliberately simple and deterministic. If a future renderer-specific slug rule matters, change the slugger and its tests together.

## External URL extraction

`externalUrlsFrom` reuses the markdown link scan and returns unique external URLs for audit use:

- `mailto:` links are skipped.
- Hash fragments are stripped before deduplication.
- Output order follows first discovery order through the docs.

It does not fetch anything. It only extracts candidates for `urlHealth`.

## URL health (`src/url-health.ts`)

```ts
type FetchResult = { status: number } | null;
type Fetcher = (url: string) => Promise<FetchResult>;
interface LinkStatus { url: string; ok: boolean; status?: number; reason?: string }
function urlHealth(urls: string[], opts: { fetch: Fetcher }): Promise<LinkStatus[]>;
```

`urlHealth` classifies unique URLs with an injected fetcher:

- `2xx` and `3xx` statuses are healthy.
- `4xx`, `5xx`, and other statuses are broken with `reason: "HTTP <status>"`.
- `null` means the fetcher could not reach the URL and becomes `reason: "network failed (unreachable)"`.

The module does not implement HEAD/GET behavior itself. That belongs to the audit composition layer, which supplies the fetcher. Keeping fetch injection here makes tests deterministic and avoids real network calls in unit tests.

## Gotchas

- **Inline links only.** Reference-style markdown links are not parsed in v1.
- **POSIX paths are required.** `DocFile.path` and `existingFiles` should use `/` separators, matching the rest of freshdocs' repo model.
- **External health is advisory.** Broken external URLs appear in audit output, not as commit-gate blockers.
