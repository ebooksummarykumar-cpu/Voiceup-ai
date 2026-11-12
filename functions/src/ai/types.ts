/** Wire formats we know how to speak. Anything else must be proxied by the user. */
export type ApiFormat = 'openai' | 'gemini' | 'anthropic';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the model for strict JSON when the format supports it. */
  jsonMode?: boolean;
}

export interface ChatResult {
  text: string;
  model: string;
  providerId: string;
  providerName: string;
  usage?: { promptTokens?: number; completionTokens?: number };
  latencyMs: number;
}

/**
 * A fully resolved provider, ready to call. `apiKey` never leaves the server.
 * Providers can come from environment variables or from the admin-managed
 * Firestore collection.
 */
export interface ProviderConfig {
  id: string;
  name: string;
  format: ApiFormat;
  /** Base URL, e.g. https://api.openai.com/v1 */
  endpoint: string;
  apiKey: string;
  model: string;
  sttModel?: string;
  ttsModel?: string;
  voice?: string;
  extraHeaders?: Record<string, string>;
  supportsChat: boolean;
  supportsStt: boolean;
  supportsTts: boolean;
  source: 'env' | 'firestore';
}

export interface TranscriptResult {
  text: string;
  language?: string;
  providerId: string;
  providerName: string;
  latencyMs: number;
}

export interface SpeechSegment {
  audioBase64: string;
  mimeType: string;
}

/**
 * Some vendors cap a single synthesis call at a few hundred characters, so a
 * long reply comes back as ordered segments that the client plays in sequence.
 */
export interface SpeechResult {
  segments: SpeechSegment[];
  providerId: string;
  providerName: string;
  latencyMs: number;
  chunkCount: number;
}

/** Public metadata shape returned to the browser - never includes a key. */
export interface ProviderStatus {
  id: string;
  name: string;
  format: ApiFormat;
  model: string;
  source: 'env' | 'firestore';
  configured: boolean;
  capabilities: { chat: boolean; stt: boolean; tts: boolean };
}
