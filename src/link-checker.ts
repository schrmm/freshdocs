import { posix } from "node:path";
import type { Finding } from "./detect-engine.ts";

export interface DocFile {
  path: string;
  content: string;
}

// Inline markdown link target: [text](target) or [text](target "title")
const LINK_RE = /\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
// A scheme (http:, mailto:) or protocol-relative // means external.
const EXTERNAL = /^[a-z][a-z0-9+.-]*:|^\/\//i;
const HEADING_RE = /^#{1,6}\s+(.+?)\s*#*$/gm;

function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function headingSlugs(content: string): Set<string> {
  const slugs = new Set<string>();
  for (const m of content.matchAll(HEADING_RE)) slugs.add(slug(m[1]!));
  return slugs;
}

function splitAnchor(target: string): [path: string, anchor: string | undefined] {
  const hash = target.indexOf("#");
  if (hash === -1) return [target, undefined];
  return [target.slice(0, hash), target.slice(hash + 1)];
}

function brokenLink(doc: string, reason: string): Finding {
  return { doc, kind: "broken-link", severity: "fail", reason };
}

/**
 * Pure check of internal markdown links. External links (http/https/mailto///)
 * are ignored — external URL health belongs to the audit path. Anchors are
 * validated against the target document's heading slugs when its content is known.
 */
export function checkInternalLinks(docs: DocFile[], existingFiles: Set<string>): Finding[] {
  const findings: Finding[] = [];
  const slugsByPath = new Map(docs.map((d) => [d.path, headingSlugs(d.content)]));

  for (const doc of docs) {
    const dir = posix.dirname(doc.path);
    for (const m of doc.content.matchAll(LINK_RE)) {
      const target = m[1]!;
      if (EXTERNAL.test(target)) continue;

      const [pathPart, anchor] = splitAnchor(target);

      if (pathPart === "") {
        if (anchor && !slugsByPath.get(doc.path)!.has(anchor)) {
          findings.push(brokenLink(doc.path, `anchor not found: #${anchor}`));
        }
        continue;
      }

      const resolved = posix.normalize(posix.join(dir, pathPart));
      if (!existingFiles.has(resolved)) {
        findings.push(brokenLink(doc.path, `link target not found: ${pathPart}`));
        continue;
      }

      if (anchor) {
        const targetSlugs = slugsByPath.get(resolved);
        if (targetSlugs && !targetSlugs.has(anchor)) {
          findings.push(brokenLink(doc.path, `anchor not found: #${anchor}`));
        }
      }
    }
  }

  return findings;
}
