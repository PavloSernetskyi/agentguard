import {afterEach, expect, it, vi} from 'vitest';
import {api, apiWithMetadata, ApiError} from './http';
const requestId = '10000000-0000-4000-8000-000000000001';
afterEach(() => vi.unstubAllGlobals());
it('preserves the existing API result while exposing request metadata to assistant callers', async () => {
  const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({reply: 'Hello'}), {headers: {'X-Request-Id': requestId}}));
  vi.stubGlobal('fetch', fetcher);
  expect(await api('/products')).toEqual({reply: 'Hello'});
  const controller = new AbortController();
  expect(await apiWithMetadata('/assistant/messages', 'POST', {message: 'hello'}, {signal: controller.signal})).toEqual({data: {reply: 'Hello'}, requestId});
  expect(fetcher.mock.calls[1][1].signal).toBe(controller.signal);
  expect(fetcher.mock.calls[1][1].credentials).toBe('same-origin');
});
it('preserves the sanitized backend error and request reference for failed assistant turns', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({error: 'Assistant temporarily unavailable', request_id: requestId}), {status: 503})));
  await expect(apiWithMetadata('/assistant/messages')).rejects.toMatchObject({status: 503, requestId, message: 'Assistant temporarily unavailable'});
});
it('does not surface malformed request references', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({error: 'Unavailable'}), {status: 503, headers: {'X-Request-Id': 'not-a-reference'}})));
  try { await apiWithMetadata('/assistant/messages'); } catch (error) { expect(error).toBeInstanceOf(ApiError); expect((error as ApiError).requestId).toBeNull(); }
});
