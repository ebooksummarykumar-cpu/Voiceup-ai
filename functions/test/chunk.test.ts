import { describe, expect, it } from 'vitest';
import { splitForTts } from '../src/ai/chunk';

describe('splitForTts', () => {
  it('returns an empty list for blank text', () => {
    expect(splitForTts('   ')).toEqual([]);
  });

  it('keeps short text as a single chunk', () => {
    expect(splitForTts('Hello there.', 480)).toEqual(['Hello there.']);
  });

  it('splits on sentence boundaries', () => {
    const text = 'One sentence here. Two sentences here. Three sentences here.';
    const chunks = splitForTts(text, 40);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ').replace(/\s+/g, ' ')).toBe(text);
  });

  it('never exceeds the limit', () => {
    const text = 'a'.repeat(50) + ' ' + 'b'.repeat(50) + ' ' + 'c'.repeat(50);
    for (const chunk of splitForTts(text, 60)) {
      expect(chunk.length).toBeLessThanOrEqual(60);
    }
  });

  it('hard-wraps a single very long word', () => {
    const chunks = splitForTts('x'.repeat(1000), 100);
    expect(chunks.every((c) => c.length <= 100)).toBe(true);
    expect(chunks.join('')).toHaveLength(1000);
  });

  it('handles Devanagari danda as a sentence break', () => {
    const text = 'यह पहला वाक्य है। यह दूसरा वाक्य है।';
    expect(splitForTts(text, 20).length).toBeGreaterThan(1);
  });

  it('collapses whitespace', () => {
    expect(splitForTts('a\n\n  b')).toEqual(['a b']);
  });
});
