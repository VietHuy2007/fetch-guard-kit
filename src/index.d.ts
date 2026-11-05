export class HttpError extends Error {
  status: number;
  body: unknown;
  response: Response;
  constructor(response: Response, body: unknown);
}
export interface ClientOptions {
  baseUrl: string;
  headers?: HeadersInit;
  /** Milliseconds; 0 disables the timeout. Default: 10000. */
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}
export interface RequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | null | undefined>;
  json?: unknown;
  timeoutMs?: number;
}
export interface Client {
  /** Empty responses return null. T is a caller assertion, not runtime validation. */
  request<T = unknown>(path: string, options?: RequestOptions): Promise<T | null>;
}
export function createClient(options: ClientOptions): Client;
