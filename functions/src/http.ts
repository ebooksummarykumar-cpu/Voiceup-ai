import { AppError } from './errors';

export interface FetchOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string | FormData;
  timeoutMs?: number;
  /** Number of extra attempts on network failure or 5xx. */
  retries?: number;
}

const DEFAULT_TIMEOUT = 45_000;

/**
 * A small fetch wrapper with a hard timeout, bounded retries and errors that
 * never leak an API key back to the client.
 */
export async function request(
  url: string,
  opts: FetchOptions = {}
): Promise<{ status: number; ok: boolean; json: any; buffer: Buffer | null; contentType: string }> {
  const { method = 'GET', headers = {}, body, timeoutMs = DEFAULT_TIMEOUT, retries = 1 } = opts;

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { method, headers, body, signal: controller.signal });
      clearTimeout(timer);

      const contentType = res.headers.get('content-type') ?? '';

      if (res.status >= 500 && attempt < retries) {
        lastError = new AppError('unavailable', `Upstream returned ${res.status}`);
        continue;
      }

      if (contentType.includes('application/json')) {
        const json = await res.json().catch(() => null);
        return { status: res.status, ok: res.ok, json, buffer: null, contentType };
      }

      const ab = await res.arrayBuffer();
      return {
        status: res.status,
        ok: res.ok,
        json: null,
        buffer: Buffer.from(ab),
        contentType
      };
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt >= retries) break;
    }
  }

  if (lastError instanceof AppError) throw lastError;

  const reason = lastError instanceof Error ? lastError.message : 'unknown error';
  if (reason.includes('aborted')) {
    throw new AppError('unavailable', 'The AI provider took too long to respond. Please try again.');
  }
  throw new AppError('unavailable', `Could not reach the AI provider: ${reason}`);
}

/** Turns a provider error response into a safe, actionable message. */
export function describeUpstreamFailure(status: number, payload: any, providerName: string): string {
  const detail =
    payload?.error?.message ??
    payload?.message ??
    payload?.detail ??
    (typeof payload === 'string' ? payload.slice(0, 200) : '');

  if (status === 401 || status === 403) {
    return `${providerName} rejected the API key (HTTP ${status}). Check the key in Settings or in functions/.env.`;
  }
  if (status === 404) {
    return `${providerName} returned 404 - the endpoint or model name is probably wrong.`;
  }
  if (status === 429) {
    return `${providerName} rate-limited this request (HTTP 429). Wait a moment and try again.`;
  }
  return `${providerName} request failed (HTTP ${status})${detail ? `: ${detail}` : '.'}`;
}
