export type Audience = "agent" | "human";

/** Files anywhere in the repo that are always treated as agent-context. */
export const AGENT_CONTEXT_FILES: ReadonlySet<string> = new Set([
  "CLAUDE.md",
  "AGENTS.md",
  "CONTEXT.md",
]);

/** Path → audience when frontmatter doesn't specify one. */
export function inferAudience(relPath: string): Audience {
  const normalized = relPath.replace(/\\/g, "/");
  const basename = normalized.split("/").pop() ?? normalized;
  if (AGENT_CONTEXT_FILES.has(basename)) return "agent";
  if (normalized.startsWith("docs/agents/")) return "agent";
  return "human";
}
