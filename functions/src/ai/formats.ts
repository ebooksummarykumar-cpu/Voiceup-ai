/**
 * Pure request/response translation for each wire format.
 *
 * Kept free of Firebase and network imports so it can be unit tested directly.
 * This is the module that makes "do not assume all providers use the same API
 * format" true rather than aspirational.
 */
import type { ApiFormat, ChatRequest, ProviderConfig } from './types';

export interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

/** Auth headers differ per vendor; Sarvam accepts both of its documented forms. */
export function authHeaders(cfg: Pick<ProviderConfig, 'id' | 'format' | 'apiKey' | 'extraHeaders'>): Record<string, string> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };

  switch (cfg.format) {
    case 'gemini':
      headers['x-goog-api-key'] = cfg.apiKey;
      break;
    case 'anthropic':
      headers['x-api-key'] = cfg.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      break;
    case 'openai':
    default:
      headers['authorization'] = `Bearer ${cfg.apiKey}`;
      // Sarvam documents api-subscription-key; sending both is harmless and
      // keeps a single adapter working against their OpenAI-compatible route.
      if (cfg.id === 'sarvam') headers['api-subscription-key'] = cfg.apiKey;
      if (cfg.id === 'openrouter') {
        headers['http-referer'] = 'https://voiceup-ai.netlify.app';
        headers['x-title'] = 'VOICEUP AI';
      }
      break;
  }

  return { ...headers, ...(cfg.extraHeaders ?? {}) };
}

export function buildChatRequest(cfg: ProviderConfig, req: ChatRequest): BuiltRequest {
  const base = trimSlash(cfg.endpoint);
  const temperature = req.temperature ?? 0.7;
  const maxTokens = req.maxTokens ?? 800;

  if (cfg.format === 'gemini') {
    const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const contents = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    return {
      url: `${base}/models/${encodeURIComponent(cfg.model)}:generateContent`,
      headers: authHeaders(cfg),
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          ...(req.jsonMode ? { responseMimeType: 'application/json' } : {})
        }
      })
    };
  }

  if (cfg.format === 'anthropic') {
    const system = req.messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const messages = req.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));

    return {
      url: `${base}/messages`,
      headers: authHeaders(cfg),
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: maxTokens,
        temperature,
        ...(system ? { system } : {}),
        messages
      })
    };
  }

  // OpenAI-compatible: OpenAI, OpenRouter, Groq, Sarvam, custom endpoints.
  return {
    url: `${base}/chat/completions`,
    headers: authHeaders(cfg),
    body: JSON.stringify({
      model: cfg.model,
      messages: req.messages,
      temperature,
      max_tokens: maxTokens,
      ...(req.jsonMode ? { response_format: { type: 'json_object' } } : {})
    })
  };
}

/** Extracts the assistant text from any of the supported response shapes. */
export function parseChatResponse(format: ApiFormat, payload: any): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Provider returned an empty response body.');
  }

  if (format === 'gemini') {
    const parts = payload?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) throw new Error('Gemini response had no candidates.');
    const text = parts.map((p: any) => p?.text ?? '').join('').trim();
    if (!text) throw new Error('Gemini returned an empty completion.');
    return text;
  }

  if (format === 'anthropic') {
    const blocks = payload?.content;
    if (!Array.isArray(blocks)) throw new Error('Anthropic response had no content blocks.');
    const text = blocks.map((b: any) => (b?.type === 'text' ? b.text : '')).join('').trim();
    if (!text) throw new Error('Anthropic returned an empty completion.');
    return text;
  }

  const text = payload?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Provider returned an empty completion.');
  }
  return text.trim();
}

export function parseUsage(format: ApiFormat, payload: any): { promptTokens?: number; completionTokens?: number } {
  if (format === 'gemini') {
    return {
      promptTokens: payload?.usageMetadata?.promptTokenCount,
      completionTokens: payload?.usageMetadata?.candidatesTokenCount
    };
  }
  if (format === 'anthropic') {
    return {
      promptTokens: payload?.usage?.input_tokens,
      completionTokens: payload?.usage?.output_tokens
    };
  }
  return {
    promptTokens: payload?.usage?.prompt_tokens,
    completionTokens: payload?.usage?.completion_tokens
  };
}
