import type { ProviderConfig } from '../src/ai/types';

export function makeProvider(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'openai',
    name: 'OpenAI',
    format: 'openai',
    endpoint: 'https://api.openai.com/v1',
    apiKey: 'test-key',
    model: 'gpt-4o-mini',
    supportsChat: true,
    supportsStt: true,
    supportsTts: true,
    source: 'env',
    ...overrides
  };
}
