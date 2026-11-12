export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface Lesson {
  id: string;
  title: string;
  level: Level;
  category: string;
  minutes: number;
  prompt: string;
  why: string;
  tips: string[];
  rubric: string[];
}

export interface Scenario {
  id: string;
  title: string;
  setting: string;
  personaName: string;
  personaRole: string;
  goal: string;
  difficulty: Level;
  openingLine: string;
  emoji: string;
}

export interface Catalogue {
  lessons: Lesson[];
  scenarios: Scenario[];
  version: number;
}

export interface FillerWord {
  word: string;
  count: number;
}

export interface ScoreBreakdown {
  overall: number;
  fluency: number;
  clarity: number;
  grammar: number;
  confidence: number;
  vocabulary: number;
  pace: { wordsPerMinute: number; verdict: 'too slow' | 'comfortable' | 'too fast' };
  fillerWords: FillerWord[];
  strengths: string[];
  improvements: string[];
  drills: { title: string; instruction: string }[];
  coachNote: string;
}

export type SessionType = 'coach' | 'lesson' | 'roleplay';

export interface PracticeSession {
  id: string;
  uid: string;
  type: SessionType;
  title?: string;
  lessonId?: string;
  audioPath?: string;
  durationMs: number;
  transcript?: string;
  score?: ScoreBreakdown;
  status?: 'uploaded' | 'transcribed' | 'scored';
  createdAt?: { seconds: number } | null;
}

export interface RoleplayMessage {
  role: 'assistant' | 'user';
  content: string;
}

export interface RoleplayThread {
  id: string;
  title: string;
  scenarioId: string;
  language: string;
  messages: RoleplayMessage[];
  createdAt?: { seconds: number } | null;
}

export interface ProviderStatus {
  id: string;
  name: string;
  format: 'openai' | 'gemini' | 'anthropic';
  model: string;
  source: 'env' | 'firestore';
  configured: boolean;
  capabilities: { chat: boolean; stt: boolean; tts: boolean };
}

export interface ProviderListResponse {
  providers: ProviderStatus[];
  defaultProvider: string;
  isAdmin: boolean;
  limits: { chat: number; transcribe: number; tts: number };
}

export interface SpeechSegment {
  audioBase64: string;
  mimeType: string;
}

export interface UserProfile {
  uid: string;
  email?: string | null;
  displayName?: string;
  photoURL?: string | null;
  targetLanguage?: string;
  voice?: string;
  level?: Level;
  streakDays?: number;
}
