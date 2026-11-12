import { onCall } from 'firebase-functions/v2/https';
import { LESSONS, SCENARIOS } from '../content/catalogue';
import { guarded, requireUser } from '../guards';
import { callableOptions } from './options';

/** Serves the curriculum. Prompts live on the server so they can be updated
 *  by deploying functions, without shipping a new frontend build. */
export const getCatalogue = onCall(
  callableOptions({ timeoutSeconds: 30, memory: '256MiB' }),
  guarded(async (req) => {
    await requireUser(req);
    return {
      lessons: LESSONS,
      scenarios: SCENARIOS.map((s) => ({
        id: s.id,
        title: s.title,
        setting: s.setting,
        personaName: s.personaName,
        personaRole: s.personaRole,
        goal: s.goal,
        difficulty: s.difficulty,
        openingLine: s.openingLine,
        emoji: s.emoji
      })),
      version: 1
    };
  })
);
