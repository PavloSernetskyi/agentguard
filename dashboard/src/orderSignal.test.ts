import assert from 'node:assert/strict';
import test from 'node:test';
import { orderSignal } from './orderSignal.ts';
import type { AuditEvent } from './audit.ts';

const base: AuditEvent = { schema_version: 1, event_id: '1', request_id: '1', timestamp: '2026-11-17T20:00:00Z', actor_id: 'bob', action: 'orders.read', resource_id: 'ord-bob-001', decision: 'allow', reason: 'owner_match', execution: 'succeeded' };

test('order signals distinguish owned, blocked, and exposed reads', () => {
  assert.equal(orderSignal(base), 'own-order-read');
  assert.equal(orderSignal({ ...base, actor_id: 'alice', resource_id: 'ord-alice-001' }), 'own-order-read');
  assert.equal(orderSignal({ ...base, resource_id: 'ord-alice-001', decision: 'deny', reason: 'ownership_mismatch', execution: 'blocked' }), 'blocked-order-read');
  assert.equal(orderSignal({ ...base, actor_id: null, resource_id: 'ord-alice-001', decision: 'deny', reason: 'invalid_session', execution: 'blocked' }), 'blocked-order-read');
  assert.equal(orderSignal({ ...base, actor_id: 'alice', resource_id: 'ord-bob-006', reason: 'demo_ownership_check_disabled' }), 'exposed-order-access');
  assert.equal(orderSignal({ ...base, action: 'assistant.message' }), null);
  assert.equal(orderSignal({ ...base, actor_id: 'alice', resource_id: 'ord-bob-006' }), null);
});
