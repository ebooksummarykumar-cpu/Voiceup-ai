/**
 * Central, environment-driven configuration.
 *
 * Every privileged value is read from the server process environment. Nothing
 * here is ever bundled into the browser build. Keys that are absent simply
 * disable the corresponding provider instead of crashing the deployment.
 */

function str(key: string, fallback = ''): string {
  const raw = process.env[key];
  return (raw ?? fallback).trim();
}

function int(key: string, fallback: number): number {
  const parsed = Number.parseInt(str(key), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(key: string): string[] {
  return str(key)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export const config = {
  region: str('FUNCTIONS_REGION', 'asia-south1'),
  defaultProvider: str('DEFAULT_AI_PROVIDER', 'gemini'),
  allowedOrigins: list('ALLOWED_ORIGINS'),
  adminEmails: list('ADMIN_EMAILS').map((e) => e.toLowerCase()),

  /** Per-user, per-day call budgets. 0 means unlimited. */
  limits: {
    chat: int('DAILY_CHAT_LIMIT', 300),
    transcribe: int('DAILY_TRANSCRIBE_LIMIT', 60),
    tts: int('DAILY_TTS_LIMIT', 200)
  },

  keys: {
    gemini: str('GEMINI_API_KEY'),
    sarvam: str('SARVAM_API_KEY'),
    openai: str('OPENAI_API_KEY'),
    openrouter: str('OPENROUTER_API_KEY'),
    groq: str('GROQ_API_KEY'),
    custom: str('CUSTOM_AI_API_KEY')
  },

  custom: {
    endpoint: str('CUSTOM_AI_ENDPOINT'),
    model: str('CUSTOM_AI_MODEL'),
    name: str('CUSTOM_AI_NAME', 'Custom provider')
  },

  models: {
    geminiChat: str('GEMINI_CHAT_MODEL', 'gemini-2.0-flash'),
    geminiAudio: str('GEMINI_AUDIO_MODEL', 'gemini-2.0-flash'),
    openaiChat: str('OPENAI_CHAT_MODEL', 'gpt-4o-mini'),
    openaiStt: str('OPENAI_STT_MODEL', 'whisper-1'),
    openaiTts: str('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts'),
    openrouterChat: str('OPENROUTER_CHAT_MODEL', 'google/gemini-2.0-flash-001'),
    groqChat: str('GROQ_CHAT_MODEL', 'llama-3.3-70b-versatile'),
    groqStt: str('GROQ_STT_MODEL', 'whisper-large-v3'),
    sarvamChat: str('SARVAM_CHAT_MODEL', 'sarvam-m'),
    sarvamStt: str('SARVAM_STT_MODEL', 'saarika:v2.5'),
    sarvamTts: str('SARVAM_TTS_MODEL', 'bulbul:v2'),
    sarvamSpeaker: str('SARVAM_TTS_SPEAKER', 'anushka')
  },

  storageBucket: str('STORAGE_BUCKET') || `${process.env.GCLOUD_PROJECT ?? 'demo-voiceup'}.appspot.com`,

  /** Hard ceiling accepted from the client, matching storage.rules. */
  maxUploadBytes: 12 * 1024 * 1024
} as const;

export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  return config.adminEmails.includes(email.toLowerCase());
}
