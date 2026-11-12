/**
 * VOICEUP AI - Cloud Functions entry point.
 *
 * Every export here becomes a deployed endpoint. The browser only ever talks
 * to callables (which require a Firebase ID token) plus the public `health`
 * probe. All provider API keys stay in this process.
 */
export { aiChat, speakText } from './handlers/chat';
export { transcribeSession, scoreSession } from './handlers/session';
export { startRoleplay, roleplayTurn, debriefRoleplay } from './handlers/roleplay';
export { getCatalogue } from './handlers/catalogue';
export { listProviders, saveProvider, deleteProvider, testProvider } from './handlers/providers';
export { health } from './handlers/health';
