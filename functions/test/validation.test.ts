import { describe, expect, it } from 'vitest';
import {
  MAX_MESSAGE_CHARS,
  ValidationError,
  clampNumber,
  isOwnedStoragePath,
  normaliseMessages,
  requireDuration,
  requireSessionType,
  validateProviderInput
} from '../src/lib/validation';

describe('isOwnedStoragePath', () => {
  it('accepts a path under the caller uid', () => {
    expect(isOwnedStoragePath('recordings/abc/one.webm', 'abc', 'recordings')).toBe(true);
  });

  it('rejects another user path', () => {
    expect(isOwnedStoragePath('recordings/other/one.webm', 'abc', 'recordings')).toBe(false);
  });

  it('rejects a prefix trick', () => {
    expect(isOwnedStoragePath('recordings/abcdef/x.webm', 'abc', 'recordings')).toBe(false);
  });

  it('rejects traversal', () => {
    expect(isOwnedStoragePath('recordings/abc/../other/x.webm', 'abc', 'recordings')).toBe(false);
  });

  it('rejects the wrong folder', () => {
    expect(isOwnedStoragePath('tts/abc/x.mp3', 'abc', 'recordings')).toBe(false);
  });
});

describe('requireDuration', () => {
  it('rounds a valid duration', () => {
    expect(requireDuration(1500.6)).toBe(1501);
  });

  it('rejects negative values', () => {
    expect(() => requireDuration(-1)).toThrow(ValidationError);
  });

  it('rejects recordings over ten minutes', () => {
    expect(() => requireDuration(11 * 60 * 1000)).toThrow(/10 minutes/);
  });

  it('rejects non-numbers', () => {
    expect(() => requireDuration('soon')).toThrow(ValidationError);
  });
});

describe('requireSessionType', () => {
  it('accepts a known type', () => {
    expect(requireSessionType('lesson')).toBe('lesson');
  });

  it('rejects an invented type', () => {
    expect(() => requireSessionType('admin')).toThrow(ValidationError);
  });
});

describe('normaliseMessages', () => {
  it('trims content', () => {
    expect(normaliseMessages([{ role: 'user', content: '  hi  ' }])[0].content).toBe('hi');
  });

  it('rejects an empty array', () => {
    expect(() => normaliseMessages([])).toThrow(ValidationError);
  });

  it('rejects an invalid role', () => {
    expect(() => normaliseMessages([{ role: 'root', content: 'x' }])).toThrow(/invalid role/);
  });

  it('rejects oversized content', () => {
    expect(() =>
      normaliseMessages([{ role: 'user', content: 'x'.repeat(MAX_MESSAGE_CHARS + 1) }])
    ).toThrow(/longer than/);
  });

  it('caps the message count', () => {
    const many = Array.from({ length: 30 }, () => ({ role: 'user', content: 'hi' }));
    expect(() => normaliseMessages(many)).toThrow(/At most/);
  });
});

describe('validateProviderInput', () => {
  const good = {
    id: 'my-groq',
    name: 'My Groq',
    format: 'openai',
    endpoint: 'https://api.groq.com/openai/v1/',
    apiKey: 'k',
    model: 'llama-3.3-70b-versatile'
  };

  it('normalises a valid provider and strips the trailing slash', () => {
    const out = validateProviderInput(good);
    expect(out.endpoint).toBe('https://api.groq.com/openai/v1');
    expect(out.enabled).toBe(true);
    expect(out.supportsStt).toBe(false);
  });

  it('rejects a non-https endpoint', () => {
    expect(() => validateProviderInput({ ...good, endpoint: 'http://x.dev/v1' })).toThrow(/https/);
  });

  it('rejects an unknown format', () => {
    expect(() => validateProviderInput({ ...good, format: 'soap' })).toThrow(/format/);
  });

  it('rejects an id with capitals or spaces', () => {
    expect(() => validateProviderInput({ ...good, id: 'My Groq' })).toThrow(/lowercase/);
  });
});

describe('clampNumber', () => {
  it('clamps and falls back', () => {
    expect(clampNumber(5, 0, 1, 0.5)).toBe(1);
    expect(clampNumber('x', 0, 1, 0.5)).toBe(0.5);
  });
});
