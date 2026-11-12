import { useEffect, useState } from 'react';
import { api, describeError } from '../lib/api';
import type { Catalogue } from '../types';

/** The curriculum is served by the backend; cache it for the session. */
let cached: Catalogue | null = null;
let inflight: Promise<Catalogue> | null = null;

export function useCatalogue() {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(cached);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) return;

    let cancelled = false;
    setLoading(true);

    if (!inflight) inflight = api.catalogue();

    inflight
      .then((data) => {
        cached = data;
        if (!cancelled) {
          setCatalogue(data);
          setError(null);
        }
      })
      .catch((err) => {
        inflight = null;
        if (!cancelled) setError(describeError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { catalogue, loading, error };
}
