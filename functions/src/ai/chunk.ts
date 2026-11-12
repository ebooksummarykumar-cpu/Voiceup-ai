/**
 * Splits text into synthesis-sized pieces without cutting mid-sentence.
 * Sarvam caps one TTS call at ~500 characters; OpenAI allows 4096.
 */
export function splitForTts(text: string, maxChars = 480): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const sentences = clean.match(/[^.!?\u0964\u061F]+[.!?\u0964\u061F]*\s*/g) ?? [clean];
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      // A single monster sentence: hard-wrap it on word boundaries.
      pushCurrent();
      let rest = sentence.trim();
      while (rest.length > maxChars) {
        let cut = rest.lastIndexOf(' ', maxChars);
        if (cut <= 0) cut = maxChars;
        chunks.push(rest.slice(0, cut).trim());
        rest = rest.slice(cut).trim();
      }
      current = rest;
      continue;
    }
    if ((current + sentence).length > maxChars) pushCurrent();
    current += sentence;
  }
  pushCurrent();

  return chunks.filter(Boolean);
}
