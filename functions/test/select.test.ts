import { describe, expect, it } from 'vitest';
import { selectProvider } from '../src/ai/select';
import { makeProvider } from './helpers';

const gemini = makeProvider({ id: 'gemini', name: 'Gemini', format: 'gemini' });
const openai = makeProvider({ id: 'openai', name: 'OpenAI' });
const groq = makeProvider({ id: 'groq', name: 'Groq', supportsStt: false, supportsTts: false });

describe('selectProvider', () => {
  it('honours an explicitly requested provider', () => {
    expect(selectProvider([gemini, openai], 'groq' in {} ? undefined : 'gemini', 'openai').id).toBe('gemini');
  });

  it('falls back to the configured default', () => {
    expect(selectProvider([gemini, openai], undefined, 'openai').id).toBe('openai');
  });

  it('falls back to the first usable provider when the default is missing', () => {
    expect(selectProvider([gemini, openai], undefined, 'anthropic').id).toBe('gemini');
  });

  it('throws a helpful error for an unknown explicit provider', () => {
    expect(() => selectProvider([gemini], 'nope', 'gemini')).toThrow(/not configured/);
  });

  it('throws when nothing is configured at all', () => {
    expect(() => selectProvider([], undefined, 'gemini')).toThrow(/No AI provider is configured/);
  });

  it('skips providers with an empty key', () => {
    const broken = makeProvider({ id: 'broken', apiKey: '' });
    expect(selectProvider([broken, openai], undefined, 'broken').id).toBe('openai');
  });

  it('respects capability filters', () => {
    expect(() => selectProvider([groq], undefined, 'groq', 'tts')).toThrow(/does not support tts|No AI provider/);
    expect(selectProvider([groq, openai], undefined, 'groq', 'stt').id).toBe('openai');
  });
});
