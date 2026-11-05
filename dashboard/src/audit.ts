export type AuditEvent = {
  schema_version: 1; event_id: string; request_id: string; timestamp: string;
  actor_id: string | null; action: string; resource_id: string;
  decision: 'allow' | 'deny'; reason: string; execution: 'succeeded' | 'blocked' | 'failed';
};
export type Filters = { search: string; actor: string; action: string; decision: string; execution: string; hours: number; signal: string };
export const emptyFilters: Filters = { search: '', actor: '', action: '', decision: '', execution: '', hours: 24, signal: '' };
const fields = ['schema_version', 'event_id', 'request_id', 'timestamp', 'actor_id', 'action', 'resource_id', 'decision', 'reason', 'execution'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const authenticationReasons = ['invalid_session', 'invalid_credentials', 'identity_provider_unavailable'];
export const isAuthenticationDenial = (event: AuditEvent) => event.decision === 'deny' && authenticationReasons.includes(event.reason);
export const isOwnershipDenial = (event: AuditEvent) => event.decision === 'deny' && ['ownership_mismatch', 'conversation_ownership_mismatch'].includes(event.reason);

export type AssistantRequest = {requestId: string; root: AuditEvent; events: AuditEvent[]; operations: AuditEvent[]};
// A v1 request ID is the correlation boundary; it is not a conversation or tool-call ID.
export function assistantRequests(selected: AuditEvent[], loaded: AuditEvent[] = selected): AssistantRequest[] {
  const roots = new Map<string, AuditEvent>();
  for (const event of selected) {
    if (event.action !== 'assistant.message') continue;
    const previous = roots.get(event.request_id);
    if (!previous || Date.parse(event.timestamp) > Date.parse(previous.timestamp)) roots.set(event.request_id, event);
  }
  const grouped = new Map<string, AuditEvent[]>();
  const seen = new Set<string>();
  for (const event of loaded) {
    if (!roots.has(event.request_id) || seen.has(event.event_id)) continue;
    seen.add(event.event_id);
    grouped.set(event.request_id, [...(grouped.get(event.request_id) ?? []), event]);
  }
  return [...roots].map(([requestId, root]) => {
    const events = (grouped.get(requestId) ?? []).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.event_id.localeCompare(b.event_id));
    return {requestId, root, events, operations: events.filter(e => e.action !== 'assistant.message')};
  }).sort((a, b) => Date.parse(b.root.timestamp) - Date.parse(a.root.timestamp));
}

export function requestFromSearch(search: string): string | null {
  const value = new URLSearchParams(search).get('request_id');
  return value && uuid.test(value) ? value : null;
}

export function investigationLink(base: string, requestId: string): string {
  if (!uuid.test(requestId)) throw new Error('Invalid request reference');
  const url = new URL(base);
  url.username = ''; url.password = ''; url.search = ''; url.hash = '';
  url.searchParams.set('request_id', requestId);
  return url.toString();
}
function validTimestamp(value: unknown) {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  const leap = year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] && hour <= 23 && minute <= 59 && second <= 59;
}

export function parseEvents(input: unknown): { events: AuditEvent[]; rejected: number; duplicates: number } {
  if (!Array.isArray(input)) throw new Error('Expected an array of v1 audit events.');
  const events: AuditEvent[] = []; let rejected = 0; let duplicates = 0;
  const seen = new Set<string>();
  for (const item of input) {
    const row = item && typeof item === 'object' && 'value' in item ? item.value : item;
    if (!row || typeof row !== 'object' || Array.isArray(row)) { rejected++; continue; }
    const record = row as Record<string, unknown>;
    const valid = Object.keys(record).length === fields.length && fields.every(key => key in record)
      && record.schema_version === 1 && typeof record.event_id === 'string' && uuid.test(record.event_id)
      && typeof record.request_id === 'string' && uuid.test(record.request_id)
      && validTimestamp(record.timestamp)
      && (record.actor_id === null || typeof record.actor_id === 'string')
      && ['action', 'resource_id', 'reason'].every(key => typeof record[key] === 'string')
      && ['allow', 'deny'].includes(record.decision as string)
      && ['succeeded', 'blocked', 'failed'].includes(record.execution as string)
      && (record.decision !== 'deny' || record.execution === 'blocked');
    if (!valid) { rejected++; continue; }
    const event = row as AuditEvent;
    if (seen.has(event.event_id)) { duplicates++; continue; }
    seen.add(event.event_id); events.push(event);
  }
  return { events: events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || a.event_id.localeCompare(b.event_id)), rejected, duplicates };
}

export function readImport(text: string): unknown[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.events)) return parsed.events;
    return [parsed];
  } catch {
    try { return trimmed.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line)); }
    catch { throw new Error('Use a JSON array, an events envelope, or newline-delimited JSON.'); }
  }
}

export function filterEvents(events: AuditEvent[], filters: Filters, now = Date.now()) {
  const needle = filters.search.toLowerCase().trim();
  return events.filter(event => (!filters.hours || Date.parse(event.timestamp) >= now - filters.hours * 3600000)
    && (!filters.signal || filters.signal !== 'authentication' || isAuthenticationDenial(event))
    && (!filters.hours || Date.parse(event.timestamp) <= now)
    && (!filters.actor || (event.actor_id ?? '__anonymous__') === filters.actor)
    && (!filters.action || event.action === filters.action)
    && (!filters.decision || event.decision === filters.decision)
    && (!filters.execution || event.execution === filters.execution)
    && (!needle || [event.event_id, event.request_id, event.actor_id ?? 'Unauthenticated', event.action, event.resource_id, event.reason].some(value => value.toLowerCase().includes(needle))));
}

export function summarize(events: AuditEvent[]) {
  const allowed = events.filter(e => e.decision === 'allow').length;
  const blocked = events.filter(e => e.execution === 'blocked').length;
  const succeeded = events.filter(e => e.execution === 'succeeded').length;
  const failed = events.filter(e => e.execution === 'failed').length;
  const denied = events.filter(e => e.decision === 'deny').length;
  const matrix = ['allow', 'deny'].map(decision => ['succeeded', 'blocked', 'failed'].map(execution => events.filter(e => e.decision === decision && e.execution === execution).length));
  const reasons = Object.entries(events.filter(e => e.decision === 'deny').reduce<Record<string, number>>((all, e) => { all[e.reason] = (all[e.reason] ?? 0) + 1; return all; }, Object.create(null))).sort((a, b) => b[1] - a[1]);
  return { total: events.length, allowed, denied, blocked, succeeded, failed, matrix, reasons,
    denyRate: events.length ? denied / events.length : null,
    executionSuccessRate: allowed ? succeeded / allowed : null,
    executionFailureRate: allowed ? failed / allowed : null,
    uniqueActors: new Set(events.flatMap(e => e.actor_id === null ? [] : [e.actor_id])).size,
    uniqueRequests: new Set(events.map(e => e.request_id)).size };
}

export function buckets(events: AuditEvent[], hours: number, now = Date.now()) {
  const span = hours ? hours * 3600000 : Math.max(24 * 3600000, now - Math.min(now, ...events.map(e => Date.parse(e.timestamp))));
  const width = span / 12;
  return Array.from({ length: 12 }, (_, index) => {
    const start = now - span + index * width;
    const rows = events.filter(e => Date.parse(e.timestamp) >= start && (index === 11 ? Date.parse(e.timestamp) <= now : Date.parse(e.timestamp) < start + width));
    return { start, total: rows.length, succeeded: rows.filter(e => e.execution === 'succeeded').length, blocked: rows.filter(e => e.execution === 'blocked').length, failed: rows.filter(e => e.execution === 'failed').length };
  });
}

export function csv(events: AuditEvent[]) {
  const cell = (value: unknown) => {
    let string = String(value ?? '');
    if (/^[\s]*[=+\-@\t\r\n]/.test(string)) string = "'" + string;
    return '"' + string.replaceAll('"', '""') + '"';
  };
  return [fields.join(','), ...events.map(e => fields.map(key => cell(e[key as keyof AuditEvent])).join(','))].join('\r\n');
}

export function fixtures(now = Date.now()): AuditEvent[] {
  return Array.from({ length: 64 }, (_, index) => {
    const blocked = index % 6 === 0; const failed = !blocked && index % 13 === 0;
    const actor = index % 12 === 0 ? null : index % 5 === 0 ? 'bob' : 'alice';
    const action = blocked ? 'orders.read' : failed ? 'cart.update' : index % 4 === 0 ? 'session.create' : index % 3 === 0 ? 'orders.list' : 'orders.read';
    return { schema_version: 1, event_id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      request_id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      timestamp: new Date(now - (index * 19 + 3) * 60000).toISOString(), actor_id: actor,
      action,
      resource_id: action === 'session.create' ? 'session' : action === 'cart.update' ? `cart:${actor}` : action === 'orders.list' ? 'orders' : blocked && actor ? `ord-${actor === 'alice' ? 'bob' : 'alice'}-001` : `ord-${actor ?? 'alice'}-001`, decision: blocked ? 'deny' : 'allow',
      reason: blocked ? (actor ? 'ownership_mismatch' : 'invalid_session') : action === 'session.create' ? 'credentials_valid' : 'owner_match',
      execution: blocked ? 'blocked' : failed ? 'failed' : 'succeeded' };
  });
}
