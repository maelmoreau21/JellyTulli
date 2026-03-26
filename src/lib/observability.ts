export function recordMetric(name: string, value: number, tags?: Record<string, string>) {
  try {
    const endpoint = process.env.METRICS_ENDPOINT;
    if (endpoint) {
      const apiKey = process.env.METRICS_API_KEY;
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'User-Agent': 'JellyTrack-Server/1.0'
      };
      if (apiKey) headers['X-Api-Key'] = apiKey;

      // Fire and forget push (non-blocking)
      fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          metric: name, 
          value, 
          tags: { ...tags, source: 'jellytrack-server' }, 
          timestamp: new Date().toISOString() 
        }),
        // Ensure this doesn't hang the request
        signal: AbortSignal.timeout(2000)
      }).then(res => {
        if (!res.ok) console.warn(`[Obs] Remote push returned ${res.status}`);
      }).catch(err => console.error('[Obs] Push failed', err.message));
    }
    
    // Always log locally for debugging unless suppressed
    if (process.env.DEBUG_METRICS === 'true') {
      console.log(`[Metric] ${name}=${value}`, tags ?? {});
    }
  } catch (e) {
    // non-fatal
    console.warn('[Observability] recordMetric failure', e);
  }
}

export function logEvent(level: 'info' | 'warn' | 'error', message: string, details?: unknown) {
  if (level === 'error') {
    console.error(`[Obs] ${message}`, details ?? '');
  } else if (level === 'warn') {
    console.warn(`[Obs] ${message}`, details ?? '');
  } else {
    console.log(`[Obs] ${message}`, details ?? '');
  }
}
