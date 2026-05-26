const FRONTMATTER = /^(---\r?\n)([\s\S]*?)(\r?\n---)/;

export interface BumpFields {
  synced?: string;
  reviewed?: string;
}

/**
 * Update or insert `synced` and `reviewed` keys inside the frontmatter block
 * while preserving every other line and the body. Returns the input unchanged
 * when the doc has no frontmatter (un-gated docs are repaired by
 * freshdocs-audit --init, not here).
 */
export function bumpFrontmatter(content: string, fields: BumpFields): string {
  const match = content.match(FRONTMATTER);
  if (!match) return content;

  const [whole, openFence, body, closeFence] = match;
  let updated = body!;

  for (const [key, value] of Object.entries(fields) as Array<[string, string | undefined]>) {
    if (value === undefined) continue;
    const lineRe = new RegExp(`^${key}:\\s*.*$`, "m");
    if (lineRe.test(updated)) {
      updated = updated.replace(lineRe, `${key}: ${value}`);
    } else {
      updated = `${updated}\n${key}: ${value}`;
    }
  }

  return content.replace(whole!, `${openFence}${updated}${closeFence}`);
}
