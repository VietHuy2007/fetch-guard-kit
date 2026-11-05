export class HttpError extends Error {
  constructor(response, body) {
    super(`HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`);
    this.name = 'HttpError';
    this.status = response.status;
    this.body = body;
    this.response = response;
  }
}

/** Create a JSON client. baseUrl must be an absolute HTTP(S) URL. */
export function createClient({ baseUrl, headers: defaults, timeoutMs = 10000, fetch: fetcher = globalThis.fetch } = {}) {
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(base.protocol)) throw new TypeError('baseUrl must use HTTP or HTTPS');
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  if (typeof fetcher !== 'function') throw new TypeError('A fetch implementation is required');

  return {
    async request(path, { query, json, headers, timeoutMs: timeout = timeoutMs, signal, ...init } = {}) {
      if (!Number.isFinite(timeout) || timeout < 0) throw new TypeError('timeoutMs must be a finite nonnegative number');
      const url = new URL(path, base);
      // Prevent default credentials/headers from being sent to another origin.
      if (url.origin !== base.origin) throw new TypeError('Requests must use the base URL origin');
      for (const [key, value] of Object.entries(query ?? {})) {
        if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
      }
      const mergedHeaders = new Headers(defaults);
      new Headers(headers).forEach((value, key) => mergedHeaders.set(key, value));
      if (!mergedHeaders.has('accept')) mergedHeaders.set('accept', 'application/json');
      if (json !== undefined && init.body !== undefined) throw new TypeError('Use json or body, not both');
      let body = init.body;
      if (json !== undefined) {
        body = JSON.stringify(json);
        if (!mergedHeaders.has('content-type')) mergedHeaders.set('content-type', 'application/json');
      }
      const controller = new AbortController();
      const abort = () => controller.abort(signal.reason);
      if (signal?.aborted) abort();
      else signal?.addEventListener('abort', abort, { once: true });
      const timer = timeout > 0 ? setTimeout(() => {
        controller.abort(new DOMException(`Request timed out after ${timeout}ms`, 'TimeoutError'));
      }, timeout) : undefined;

      try {
        controller.signal.throwIfAborted();
        const response = await fetcher(url, { ...init, body, headers: mergedHeaders, signal: controller.signal });
        const text = await response.text();
        let data = null;
        if (text) {
          try { data = JSON.parse(text); }
          catch (error) {
            if (response.ok) throw error;
            data = text;
          }
        }
        if (!response.ok) throw new HttpError(response, data);
        return data;
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
      }
    }
  };
}
