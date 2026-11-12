import { AppError } from '../errors';
import { describeUpstreamFailure, request } from '../http';
import type { ProviderConfig, TranscriptResult } from './types';

const MIME_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'video/webm': 'webm'
};

function extensionFor(mimeType: string): string {
  return MIME_EXT[mimeType] ?? 'webm';
}

async function transcribeSarvam(
  cfg: ProviderConfig,
  audio: Buffer,
  mimeType: string,
  language?: string
): Promise<{ text: string; language?: string }> {
  const form = new FormData();
  form.append('file', new Blob([audio], { type: mimeType }), `recording.${extensionFor(mimeType)}`);
  form.append('model', cfg.sttModel ?? 'saarika:v2.5');
  form.append('language_code', language && language !== 'auto' ? language : 'unknown');

  const res = await request('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: { 'api-subscription-key': cfg.apiKey },
    body: form,
    timeoutMs: 90_000,
    retries: 1
  });

  if (!res.ok) throw new AppError('unavailable', describeUpstreamFailure(res.status, res.json, cfg.name));
  const text = String(res.json?.transcript ?? '').trim();
  return { text, language: res.json?.language_code };
}

async function transcribeGemini(
  cfg: ProviderConfig,
  audio: Buffer,
  mimeType: string,
  language?: string
): Promise<{ text: string; language?: string }> {
  const model = cfg.sttModel ?? 'gemini-2.0-flash';
  const hint = language && language !== 'auto' ? ` The audio is in ${language}.` : '';

  const res = await request(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': cfg.apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: mimeType, data: audio.toString('base64') } },
              {
                text:
                  'Transcribe this audio verbatim, exactly as spoken. Include filler words and ' +
                  'false starts. Return only the transcript, no commentary, no quotes.' + hint
              }
            ]
          }
        ],
        generationConfig: { temperature: 0 }
      }),
      timeoutMs: 90_000,
      retries: 1
    }
  );

  if (!res.ok) throw new AppError('unavailable', describeUpstreamFailure(res.status, res.json, cfg.name));
  const parts = res.json?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p: any) => p?.text ?? '').join('').trim() : '';
  return { text };
}

async function transcribeOpenAiCompatible(
  cfg: ProviderConfig,
  audio: Buffer,
  mimeType: string,
  language?: string
): Promise<{ text: string; language?: string }> {
  const base = cfg.endpoint.replace(/\/+$/, '');
  const form = new FormData();
  form.append('file', new Blob([audio], { type: mimeType }), `recording.${extensionFor(mimeType)}`);
  form.append('model', cfg.sttModel ?? 'whisper-1');
  if (language && language !== 'auto') form.append('language', language.split('-')[0]);

  const res = await request(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}` },
    body: form,
    timeoutMs: 90_000,
    retries: 1
  });

  if (!res.ok) throw new AppError('unavailable', describeUpstreamFailure(res.status, res.json, cfg.name));
  return { text: String(res.json?.text ?? '').trim() };
}

export async function transcribe(
  cfg: ProviderConfig,
  audio: Buffer,
  mimeType: string,
  language?: string
): Promise<TranscriptResult> {
  if (!cfg.supportsStt) {
    throw new AppError('failed-precondition', `${cfg.name} cannot transcribe audio. Pick another provider.`);
  }

  const started = Date.now();
  let result: { text: string; language?: string };

  if (cfg.id === 'sarvam') {
    result = await transcribeSarvam(cfg, audio, mimeType, language);
  } else if (cfg.id === 'gemini') {
    result = await transcribeGemini(cfg, audio, mimeType, language);
  } else {
    result = await transcribeOpenAiCompatible(cfg, audio, mimeType, language);
  }

  if (!result.text) {
    throw new AppError(
      'failed-precondition',
      'No speech was detected in that recording. Try again somewhere quieter, or speak a little longer.'
    );
  }

  return {
    text: result.text,
    language: result.language,
    providerId: cfg.id,
    providerName: cfg.name,
    latencyMs: Date.now() - started
  };
}
