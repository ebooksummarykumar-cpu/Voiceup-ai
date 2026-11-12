import { describe, expect, it } from 'vitest';
import { authHeaders, buildChatRequest, parseChatResponse, parseUsage } from '../src/ai/formats';
import { makeProvider } from './helpers';

describe('authHeaders', () => {
  it('uses a bearer token for OpenAI-compatible formats', () => {
    const headers = authHeaders(makeProvider());
    expect(headers.authorization).toBe('Bearer test-key');
    expect(headers['x-goog-api-key']).toBeUndefined();
  });

  it('uses x-goog-api-key for Gemini and never puts the key in the URL', () => {
    const headers = authHeaders(makeProvider({ id: 'gemini', format: 'gemini' }));
    expect(headers['x-goog-api-key']).toBe('test-key');
    expect(headers.authorization).toBeUndefined();
  });

  it('adds the Anthropic version header', () => {
    const headers = authHeaders(makeProvider({ id: 'anthropic', format: 'anthropic' }));
    expect(headers['x-api-key']).toBe('test-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });

  it('sends both documented Sarvam auth headers', () => {
    const headers = authHeaders(makeProvider({ id: 'sarvam', format: 'openai' }));
    expect(headers['api-subscription-key']).toBe('test-key');
    expect(headers.authorization).toBe('Bearer test-key');
  });

  it('merges custom headers last so a user can override', () => {
    const headers = authHeaders(makeProvider({ extraHeaders: { 'x-custom': 'yes' } }));
    expect(headers['x-custom']).toBe('yes');
  });
});

describe('buildChatRequest', () => {
  const messages = [
    { role: 'system' as const, content: 'You are a coach.' },
    { role: 'user' as const, content: 'Hello' }
  ];

  it('builds an OpenAI chat completions body', () => {
    const built = buildChatRequest(makeProvider(), { messages, temperature: 0.4, maxTokens: 200 });
    expect(built.url).toBe('https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(built.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages).toHaveLength(2);
    expect(body.temperature).toBe(0.4);
    expect(body.max_tokens).toBe(200);
  });

  it('lifts the system message into systemInstruction for Gemini', () => {
    const built = buildChatRequest(makeProvider({ id: 'gemini', format: 'gemini' }), { messages });
    expect(built.url).toContain('/models/gpt-4o-mini:generateContent');
    const body = JSON.parse(built.body);
    expect(body.systemInstruction.parts[0].text).toBe('You are a coach.');
    expect(body.contents).toHaveLength(1);
    expect(body.contents[0].parts[0].text).toBe('Hello');
    expect(body.contents[0].role).toBe('user');
  });

  it('maps assistant turns to the "model" role for Gemini', () => {
    const built = buildChatRequest(makeProvider({ format: 'gemini' }), {
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' }
      ]
    });
    const body = JSON.parse(built.body);
    expect(body.contents[1].role).toBe('model');
  });

  it('asks Gemini for JSON via responseMimeType', () => {
    const built = buildChatRequest(makeProvider({ format: 'gemini' }), { messages, jsonMode: true });
    expect(JSON.parse(built.body).generationConfig.responseMimeType).toBe('application/json');
  });

  it('uses max_tokens and a top-level system field for Anthropic', () => {
    const built = buildChatRequest(makeProvider({ id: 'anthropic', format: 'anthropic' }), { messages });
    expect(built.url).toBe('https://api.openai.com/v1/messages');
    const body = JSON.parse(built.body);
    expect(body.system).toBe('You are a coach.');
    expect(body.max_tokens).toBe(800);
    expect(body.messages).toHaveLength(1);
  });

  it('strips a trailing slash from the endpoint', () => {
    const built = buildChatRequest(makeProvider({ endpoint: 'https://example.com/v1///' }), { messages });
    expect(built.url).toBe('https://example.com/v1/chat/completions');
  });

  it('requests a JSON object for OpenAI-compatible providers', () => {
    const built = buildChatRequest(makeProvider(), { messages, jsonMode: true });
    expect(JSON.parse(built.body).response_format).toEqual({ type: 'json_object' });
  });
});

describe('parseChatResponse', () => {
  it('reads OpenAI choices', () => {
    expect(parseChatResponse('openai', { choices: [{ message: { content: ' hi ' } }] })).toBe('hi');
  });

  it('joins Gemini parts', () => {
    const payload = { candidates: [{ content: { parts: [{ text: 'Hello ' }, { text: 'world' }] } }] };
    expect(parseChatResponse('gemini', payload)).toBe('Hello world');
  });

  it('ignores non-text Anthropic blocks', () => {
    const payload = { content: [{ type: 'thinking', text: 'nope' }, { type: 'text', text: 'answer' }] };
    expect(parseChatResponse('anthropic', payload)).toBe('answer');
  });

  it('throws on an empty completion', () => {
    expect(() => parseChatResponse('openai', { choices: [] })).toThrow(/empty/);
  });

  it('throws when Gemini has no candidates', () => {
    expect(() => parseChatResponse('gemini', {})).toThrow(/candidates/);
  });
});

describe('parseUsage', () => {
  it('normalises usage across formats', () => {
    expect(parseUsage('openai', { usage: { prompt_tokens: 5, completion_tokens: 7 } })).toEqual({
      promptTokens: 5,
      completionTokens: 7
    });
    expect(
      parseUsage('gemini', { usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 } })
    ).toEqual({ promptTokens: 3, completionTokens: 4 });
  });
});
