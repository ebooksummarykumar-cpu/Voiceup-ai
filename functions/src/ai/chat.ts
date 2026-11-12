import { AppError } from '../errors';
import { describeUpstreamFailure, request } from '../http';
import { buildChatRequest, parseChatResponse, parseUsage } from './formats';
import type { ChatRequest, ChatResult, ProviderConfig } from './types';

export async function chat(cfg: ProviderConfig, req: ChatRequest): Promise<ChatResult> {
  const built = buildChatRequest(cfg, req);
  const started = Date.now();

  const res = await request(built.url, {
    method: 'POST',
    headers: built.headers,
    body: built.body,
    timeoutMs: 60_000,
    retries: 1
  });

  if (!res.ok) {
    throw new AppError('unavailable', describeUpstreamFailure(res.status, res.json, cfg.name));
  }

  let text: string;
  try {
    text = parseChatResponse(cfg.format, res.json);
  } catch (err) {
    throw new AppError('internal', `${cfg.name} returned a response we could not read: ${
      err instanceof Error ? err.message : 'unknown shape'
    }`);
  }

  return {
    text,
    model: cfg.model,
    providerId: cfg.id,
    providerName: cfg.name,
    usage: parseUsage(cfg.format, res.json),
    latencyMs: Date.now() - started
  };
}
