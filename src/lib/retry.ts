export type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  isRetryable?: (err: unknown) => boolean;
};

function defaultIsRetryable(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status;
  // Rate limits and server-side errors are worth retrying; 4xx (bad request, auth, safety
  // blocks) won't succeed on retry, so fail fast on those.
  if (typeof status === "number") return status === 429 || status >= 500;
  // No status usually means a network-level failure (timeout, DNS, connection reset) — retry.
  return true;
}

/**
 * Retries `fn` with exponential backoff + jitter. Only retries errors `isRetryable` accepts
 * (default: HTTP 429/5xx or no status at all); anything else — and the final attempt — rethrows.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 300, isRetryable = defaultIsRetryable } = options;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts || !isRetryable(err)) throw err;
      const backoff = baseDelayMs * 2 ** (attempt - 1);
      const jitter = backoff * (0.75 + Math.random() * 0.5);
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
  }
  throw lastError;
}
