import { AppError } from '../errors';
import { describeUpstreamFailure, request } from '../http';
import { splitForTts } from './chunk';
import type { ProviderConfig, SpeechResult, SpeechSegment } from './types';

async function speakSarvam(
  cfg: ProviderConfig,
  chunks: string[],
  language: string
): Promise<SpeechSegment[]> {
  const segments: SpeechSegment[] = [];

  for (const chunk of chunks) {
    const res = await request('https://api.sarvam.ai/text-to-speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'api-subscription-key': cfg.apiKey },
      body: JSON.stringify({
        inputs: [chunk],
        target_language_code: language,
        speaker: cfg.voice ?? 'anushka',
        model: cfg.ttsModel ?? 'bulbul:v2',
        pitch: 0,
        pace: 1.0,
        loudness: 1.0,
        speech_sample_rate: 22050,
        enable_preprocessing: true
      }),
      timeoutMs: 90_000,
      retries: 1
    });

    if (!res.ok) throw new AppError('unavailable', describeUpstreamFailure(res.status, res.json, cfg.name));

    const audios = res.json?.audios;
    if (!Array.isArray(audios) || typeof audios[0] !== 'string') {
      throw new AppError('internal', `${cfg.name} returned no audio.`);
    }
    segments.push({ audioBase64: audios[0], mimeType: 'audio/wav' });
  }

  return segments;
}

async function speakOpenAiCompatible(cfg: ProviderConfig, chunks: string[]): Promise<SpeechSegment[]> {
  const base = cfg.endpoint.replace(/\/+$/, '');
  const segments: SpeechSegment[] = [];

  for (const chunk of chunks) {
    const res = await request(`${base}/audio/speech`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.ttsModel ?? 'gpt-4o-mini-tts',
        voice: cfg.voice ?? 'alloy',
        input: chunk,
        response_format: 'mp3'
      }),
      timeoutMs: 90_000,
      retries: 1
    });

    if (!res.ok) throw new AppError('unavailable', describeUpstreamFailure(res.status, res.json, cfg.name));
    if (!res.buffer) throw new AppError('internal', `${cfg.name} returned no audio data.`);

    segments.push({ audioBase64: res.buffer.toString('base64'), mimeType: 'audio/mpeg' });
  }

  return segments;
}

export async function speak(
  cfg: ProviderConfig,
  text: string,
  language = 'en-IN'
): Promise<SpeechResult> {
  if (!cfg.supportsTts) {
    throw new AppError('failed-precondition', `${cfg.name} cannot synthesise speech. Pick another provider.`);
  }

  const maxChars = cfg.id === 'sarvam' ? 480 : 4000;
  const chunks = splitForTts(text, maxChars);
  if (chunks.length === 0) {
    throw new AppError('invalid-argument', 'There is no text to speak.');
  }
  if (chunks.length > 12) {
    throw new AppError('invalid-argument', 'That reply is too long to speak. Shorten it first.');
  }

  const started = Date.now();
  const segments =
    cfg.id === 'sarvam' ? await speakSarvam(cfg, chunks, language) : await speakOpenAiCompatible(cfg, chunks);

  return {
    segments,
    providerId: cfg.id,
    providerName: cfg.name,
    latencyMs: Date.now() - started,
    chunkCount: segments.length
  };
}
