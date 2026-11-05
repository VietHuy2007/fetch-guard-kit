# Fetch Guard Kit

A small JSON API client with timeouts, cancellation, and useful HTTP errors.
No runtime dependencies, build step, or framework required. Includes TypeScript declarations.

This is a new starter library, not an established package. No downloads,
external contributors, dependent repositories, or criticality score are claimed.

## Try it

Install Node.js 20 or newer, open this folder in a terminal, and run:

```sh
npm test
npm run example
```

No dependency installation is needed. The example starts a temporary local
server, makes a real request, prints the result, and closes the server.

## Use it

```js
import { createClient, HttpError } from './src/index.js';

const api = createClient({
  baseUrl: 'https://example.com/api/',
  timeoutMs: 5000,
});

const products = await api.request('products', {
  query: { page: 1, available: true },
});

try {
  await api.request('products', {
    method: 'POST',
    json: { name: 'Notebook' },
  });
} catch (error) {
  if (error instanceof HttpError) {
    console.error(error.status, error.body);
  } else {
    throw error;
  }
}
```

### Cancel a request

```js
const controller = new AbortController();
const pending = api.request('products', { signal: controller.signal });
controller.abort();
try { await pending; } catch (error) { console.log(error.name); }
```

## Behavior

- `request(path, options)` returns parsed JSON, or `null` for an empty body.
- Relative paths keep the base path: `products` under `/api/` becomes `/api/products`.
  A leading slash starts at the origin: `/products` becomes `/products`.
- Query entries with `null` or `undefined` values are omitted. Other values are stringified.
- Headers are merged case-insensitively; request headers override defaults.
- `json` serializes the body and supplies a JSON content type if none was set.
  Specify `method: 'POST'` (or another appropriate method) when sending a body.
- Non-2xx responses throw `HttpError`, with `status`, `body`, and `response`.
  Error bodies can be JSON or plain text.
- Malformed JSON on a successful response throws `SyntaxError`.
- The default timeout is 10 seconds and covers reading the response body.
  Set `timeoutMs: 0` to disable it. Timeout aborts use `TimeoutError`.
- Caller cancellation and network errors propagate from fetch.
- Cross-origin request URLs are rejected before sending configured headers.
  Fetch's standard redirect behavior still applies; use `redirect: 'error'`
  when requests must not follow redirects.
- No automatic retries: callers decide whether repeating an operation is safe.
- TypeScript result types are assertions; this library does not validate JSON schemas.

## Using with Vue

Create one client in a module, import it into your components, and call
`api.request()` inside your existing loading/error handling. Vue is not a dependency.

## Publishing later

The package is marked `private` to prevent accidental publication. Before publishing,
choose an available npm name, add your actual repository and author information,
review the API and license, remove `private`, and inspect `npm pack --dry-run`.
The working name here has not been checked for registry availability.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Licensed under MIT.
