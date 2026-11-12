import { describe, expect, it } from 'vitest';
import { clampScore, extractJsonObject, normaliseScore, parseScoreJson } from '../src/lib/score';

const validPayload = {
  overall: 72,
  fluency: 68,
  clarity: 80,
  grammar: 65,
  confidence: 70,
  vocabulary: 74,
  pace: { wordsPerMinute: 138, verdict: 'comfortable' },
  fillerWords: [{ word: 'um', count: 6 }],
  strengths: ['Clear opening', 'Good use of a number'],
  improvements: ['Second sentence trailed off'],
  drills: [{ title: 'Pause drill', instruction: 'Pause instead of saying um.' }],
  coachNote: 'Solid attempt. Tighten your second sentence.'
};

describe('clampScore', () => {
  it('clamps to 0-100 and rounds', () => {
    expect(clampScore(120)).toBe(100);
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(72.6)).toBe(73);
  });

  it('falls back on non-numeric input', () => {
    expect(clampScore('abc', 50)).toBe(50);
    expect(clampScore(undefined, 50)).toBe(50);
  });
});

describe('extractJsonObject', () => {
  it('strips code fences', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('pulls JSON out of surrounding prose', () => {
    expect(extractJsonObject('Here you go: {"a": {"b": 2}} hope that helps')).toBe('{"a": {"b": 2}}');
  });

  it('does not trip over braces inside strings', () => {
    const raw = '{"note": "use {curly} braces", "n": 1}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it('handles escaped quotes inside strings', () => {
    const raw = '{"note": "she said \\"hi\\" {ok}"}';
    expect(extractJsonObject(raw)).toBe(raw);
  });

  it('throws when there is no object', () => {
    expect(() => extractJsonObject('no json here')).toThrow(/did not return any JSON/);
  });

  it('throws on truncated JSON', () => {
    expect(() => extractJsonObject('{"a": 1')).toThrow(/truncated/);
  });
});

describe('normaliseScore', () => {
  it('keeps a well-formed payload intact', () => {
    const score = normaliseScore(validPayload);
    expect(score.overall).toBe(72);
    expect(score.pace.verdict).toBe('comfortable');
    expect(score.fillerWords[0]).toEqual({ word: 'um', count: 6 });
    expect(score.strengths).toHaveLength(2);
  });

  it('coerces a bad pace verdict to comfortable', () => {
    const score = normaliseScore({ ...validPayload, pace: { wordsPerMinute: 90, verdict: 'weird' } });
    expect(score.pace.verdict).toBe('comfortable');
  });

  it('drops malformed drills and filler words', () => {
    const score = normaliseScore({
      ...validPayload,
      drills: [{ title: 'ok', instruction: 'do it' }, { title: 5 }],
      fillerWords: [{ word: 'like', count: 2 }, { nope: true }]
    });
    expect(score.drills).toHaveLength(1);
    expect(score.fillerWords).toHaveLength(1);
  });

  it('caps a feedback-free answer so it cannot look perfect', () => {
    const score = normaliseScore({ ...validPayload, overall: 95, strengths: [], improvements: [] });
    expect(score.overall).toBeLessThanOrEqual(40);
  });

  it('rejects a non-object payload', () => {
    expect(() => normaliseScore(null)).toThrow(/not an object/);
  });
});

describe('parseScoreJson', () => {
  it('parses a fenced payload end to end', () => {
    const raw = '```json\n' + JSON.stringify(validPayload) + '\n```';
    expect(parseScoreJson(raw).overall).toBe(72);
  });
});
