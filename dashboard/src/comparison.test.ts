import assert from 'node:assert/strict';
import test from 'node:test';
import { presentationOrderAccess } from './comparison.ts';
import type { AuditEvent } from './audit.ts';

function event(actor: 'bob' | 'alice', resource: string, timestamp: string): AuditEvent {
  const blocked = actor === 'bob';
  return { schema_version: 1, event_id: `${actor}-${timestamp}`, request_id: `${actor}-request-${timestamp}`,
    timestamp, actor_id: actor, action: 'orders.read', resource_id: resource,
    decision: blocked ? 'deny' : 'allow', reason: blocked ? 'ownership_mismatch' : 'demo_ownership_check_disabled',
    execution: blocked ? 'blocked' : 'succeeded' };
}

test('an Alice read from an earlier rehearsal stays hidden after Bob starts a new run', () => {
  const priorAlice = event('alice', 'ord-bob-old', '2026-11-10T20:00:00Z');
  const bob = event('bob', 'ord-alice-001', '2026-11-10T21:00:00Z');
  const afterBob = presentationOrderAccess([priorAlice, bob]);
  assert.equal(afterBob.bobBlocked, bob);
  assert.equal(afterBob.aliceAllowed, undefined);
  const newAlice = event('alice', 'ord-bob-new', '2026-11-10T21:05:00Z');
  assert.equal(presentationOrderAccess([priorAlice, bob, newAlice]).aliceAllowed, newAlice);
});

test('starting a presentation clears both live cards without deleting audit history', () => {
  const bob = event('bob', 'ord-alice-001', '2026-11-10T21:00:00Z');
  const alice = event('alice', 'ord-bob-new', '2026-11-10T21:05:00Z');
  assert.deepEqual(presentationOrderAccess([bob, alice], Date.parse('2026-11-10T22:00:00Z')),
    { bobBlocked: undefined, aliceAllowed: undefined });
});
