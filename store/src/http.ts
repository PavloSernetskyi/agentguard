export type ApiOptions = {signal?: AbortSignal};
export class ApiError extends Error {
  status: number;
  requestId: string | null;
  constructor(message: string, status: number, requestId: string | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.requestId = requestId;
  }
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function apiWithMetadata<T>(path: string, method = 'GET', body?: unknown, options: ApiOptions = {}): Promise<{data: T; requestId: string | null}> {
  const response = await fetch('/api' + path, {
    method, credentials: 'same-origin', signal: options.signal,
    headers: {'Content-Type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  const reference = response.headers.get('X-Request-Id') || data?.request_id;
  const requestId = typeof reference === 'string' && uuid.test(reference) ? reference : null;
  if (!response.ok) throw new ApiError(typeof data?.error === 'string' ? data.error : 'Something went wrong', response.status, requestId);
  return {data, requestId};
}

// Preserve the existing data-only API for all ordinary storefront operations.
export async function api<T>(path: string, method = 'GET', body?: unknown, options: ApiOptions = {}): Promise<T> {
  return (await apiWithMetadata<T>(path, method, body, options)).data;
}
