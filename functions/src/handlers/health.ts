import { onRequest } from 'firebase-functions/v2/https';
import { listProviderStatus } from '../ai/registry';
import { config } from '../config';
import { httpOptions } from './options';

const BUILD_VERSION = process.env.BUILD_VERSION ?? '1.0.0';

/**
 * Unauthenticated liveness probe used by the deploy check and by uptime
 * monitors. It reports which providers have credentials - never the values.
 */
export const health = onRequest(httpOptions, async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Use GET.' });
    return;
  }

  try {
    const providers = await listProviderStatus();
    const usable = providers.filter((p) => p.configured);

    res.status(200).json({
      status: 'ok',
      service: 'voiceup-ai-functions',
      version: BUILD_VERSION,
      region: config.region,
      runtime: process.version,
      time: new Date().toISOString(),
      providers: {
        total: providers.length,
        configured: usable.length,
        ids: usable.map((p) => p.id),
        capabilities: usable.map((p) => ({ id: p.id, ...p.capabilities }))
      }
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      error: err instanceof Error ? err.message : 'unknown error'
    });
  }
});
