/** Pure provider-selection logic, so the precedence rules can be tested. */
import type { ProviderConfig } from './types';

/**
 * Precedence:
 *   1. The provider explicitly requested by the caller, if usable.
 *   2. The configured default provider, if usable.
 *   3. The first usable provider in the list.
 *
 * "Usable" means enabled and holding a non-empty key.
 */
export function selectProvider(
  candidates: ProviderConfig[],
  requestedId: string | undefined,
  defaultId: string,
  capability: 'chat' | 'stt' | 'tts' = 'chat'
): ProviderConfig {
  const usable = candidates.filter((p) => {
    if (!p.apiKey || !p.endpoint) return false;
    if (capability === 'chat') return p.supportsChat;
    if (capability === 'stt') return p.supportsStt;
    return p.supportsTts;
  });

  if (usable.length === 0) {
    throw new Error(
      `No AI provider is configured for ${capability}. Add a key in functions/.env or in Settings -> AI providers.`
    );
  }

  if (requestedId) {
    const exact = usable.find((p) => p.id === requestedId);
    if (exact) return exact;
    throw new Error(`Provider "${requestedId}" is not configured or does not support ${capability}.`);
  }

  const fallback = usable.find((p) => p.id === defaultId);
  return fallback ?? usable[0];
}
