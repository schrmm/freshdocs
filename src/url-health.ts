export type FetchResult = { status: number } | null;
export type Fetcher = (url: string) => Promise<FetchResult>;

export interface LinkStatus {
  url: string;
  ok: boolean;
  status?: number;
  reason?: string;
}

export interface UrlHealthOptions {
  fetch: Fetcher;
}

/**
 * Pure (modulo the injected fetcher) classification of external URL health.
 * 2xx/3xx → ok; anything else (or a null fetch result, signalling a network
 * failure) → not ok. Duplicate input URLs are checked once.
 */
export async function urlHealth(urls: string[], opts: UrlHealthOptions): Promise<LinkStatus[]> {
  const unique = [...new Set(urls)];
  return Promise.all(
    unique.map(async (url): Promise<LinkStatus> => {
      const result = await opts.fetch(url);
      if (result === null) {
        return { url, ok: false, reason: "network failed (unreachable)" };
      }
      const { status } = result;
      if (status >= 200 && status < 400) return { url, ok: true, status };
      return { url, ok: false, status, reason: `HTTP ${status}` };
    }),
  );
}
