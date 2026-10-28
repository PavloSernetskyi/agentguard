import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assistantRequests, investigationLink, isOwnershipDenial, requestFromSearch } from './audit.ts';
import { buckets, csv, emptyFilters, filterEvents, fixtures, parseEvents, readImport, summarize } from './audit.ts';

const now = Date.parse('2026-10-28T12:00:00Z');
const sample = fixtures(now);
test('v1 validation unwraps cloud rows, deduplicates IDs, and rejects invalid outcomes and unknown fields', () => {
  const result = parseEvents([sample[0], { value: sample[1], expires: 123 }, sample[0], { ...sample[2], decision: 'deny', execution: 'succeeded' }, { ...sample[3], latency: 1 }, { ...sample[4], request_id: 'bad' }, { ...sample[5], timestamp: 'yesterday' }]);
  assert.equal(result.events.length, 2); assert.equal(result.duplicates, 1); assert.equal(result.rejected, 4);
});
test('counts and rates preserve separate authorization and execution denominators', () => {
  const valid = sample[1];
  const result = summarize([{ ...valid, decision: 'allow', execution: 'succeeded' }, { ...valid, decision: 'allow', execution: 'failed' }, { ...valid, decision: 'deny', execution: 'blocked' }]);
  assert.equal(result.total, 3); assert.equal(result.denyRate, 1 / 3);
  assert.equal(result.executionSuccessRate, 1 / 2); assert.equal(result.executionFailureRate, 1 / 2);
  assert.deepEqual(result.matrix, [[1, 0, 1], [0, 1, 0]]);
  assert.equal(summarize([]).executionSuccessRate, null); assert.equal(summarize([]).denyRate, null);
});
test('actor, reason search, time boundaries and outcome filters compose', () => {
  const rows = filterEvents(sample, { ...emptyFilters, actor: 'alice', execution: 'blocked', search: 'ownership_mismatch' }, now);
  assert.ok(rows.length); assert.ok(rows.every(e => e.actor_id === 'alice' && e.decision === 'deny'));
  assert.equal(filterEvents([{ ...sample[0], timestamp: new Date(now + 1000).toISOString() }], emptyFilters, now).length, 0);
  assert.equal(filterEvents(sample, { ...emptyFilters, hours: 0 }, now + 7 * 86400000).length, 64);
});
test('import accepts NDJSON, JSON envelope, empty and plain cloud payloads', () => {
  assert.equal(readImport(sample.slice(0, 2).map(e => JSON.stringify(e)).join('\n')).length, 2);
  assert.equal(readImport(JSON.stringify({ events: sample })).length, 64);
  assert.deepEqual(readImport(''), []);
  assert.throws(() => readImport('not json'), /JSON/);
});
test('CSV export neutralizes formulas and escapes delimiters and quotes', () => {
  const output = csv([{ ...sample[0], actor_id: '=HYPERLINK("bad")', resource_id: 'one,"two' }]);
  assert.ok(output.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(output.includes('"one,""two"'));
});
test('chart buckets do not double count boundary timestamps', () => {
  const rows = [{ ...sample[0], timestamp: new Date(now).toISOString() }, { ...sample[1], timestamp: new Date(now - 2 * 3600000).toISOString() }];
  const series = buckets(rows, 24, now);
  assert.equal(series.reduce((sum, b) => sum + b.total, 0), 2);
});
test('invalid calendar dates are rejected and reason aggregation handles arbitrary strings', () => {
  assert.equal(parseEvents([{ ...sample[0], timestamp: '2026-02-31T00:00:00Z' }]).rejected, 1);
  const result = summarize([{ ...sample[0], reason: '__proto__' }, { ...sample[0], reason: 'constructor' }]);
  assert.deepEqual(result.reasons, [['__proto__', 1], ['constructor', 1]]);
});
test('authentication signal drill-down uses exactly the same reason predicate as its count', () => {
  const rows = [{ ...sample[0], reason: 'invalid_session' }, { ...sample[0], reason: 'ownership_mismatch' }];
  assert.equal(filterEvents(rows, { ...emptyFilters, signal: 'authentication' }, now).length, 1);
});

test('the merged assistant producer fixture validates unchanged as v1 and correlates private operations', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/assistant-audit.v1.json', import.meta.url), 'utf8'));
  const parsed = parseEvents(fixture);
  assert.equal(parsed.rejected, 0); assert.equal(parsed.duplicates, 0);
  const requests = assistantRequests(parsed.events);
  assert.equal(requests.length, 4);
  assert.equal(requests.filter(r => r.root.execution === 'succeeded').length, 1);
  assert.equal(requests.filter(r => r.root.execution === 'failed').length, 2);
  assert.equal(requests.filter(r => r.root.execution === 'blocked').length, 1);
  const successful = requests.find(r => r.root.execution === 'succeeded')!;
  assert.deepEqual(successful.operations.map(e => e.action).sort(), ['cart.read', 'orders.list']);
  assert.ok(successful.events.every(e => e.request_id === successful.requestId));
  assert.equal(assistantRequests(parsed.events.filter(e => e.action === 'assistant.message'), parsed.events).find(r => r.requestId === successful.requestId)!.events.length, 3);
});

test('investigation links carry only a valid request ID, and conversation denials are ownership signals', () => {
  const id = sample[0].request_id;
  assert.equal(requestFromSearch('?request_id=' + id), id);
  assert.equal(requestFromSearch('?request_id=wrong'), null);
  const link = investigationLink('https://soc.example/?token=private&source=local#old', id);
  assert.equal(new URL(link).searchParams.size, 1);
  assert.equal(new URL(link).searchParams.get('request_id'), id);
  assert.equal(new URL(link).hash, '');
  assert.ok(isOwnershipDenial({...sample[0], decision: 'deny', reason: 'conversation_ownership_mismatch'}));
});
