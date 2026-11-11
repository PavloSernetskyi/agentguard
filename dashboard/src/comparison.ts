import type { AuditEvent } from './audit';

export function presentationOrderAccess(events: AuditEvent[], startedAt = 0) {
  const newest = (matches: (event: AuditEvent) => boolean) => events
    .filter(event => Date.parse(event.timestamp) > startedAt && matches(event))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  const bobBlocked = newest(event => event.actor_id === 'bob' && event.action === 'orders.read'
    && event.resource_id.startsWith('ord-alice-') && event.decision === 'deny'
    && event.reason === 'ownership_mismatch' && event.execution === 'blocked');
  const aliceAllowed = bobBlocked && newest(event => event.actor_id === 'alice' && event.action === 'orders.read'
    && event.resource_id.startsWith('ord-bob-') && event.reason === 'demo_ownership_check_disabled'
    && event.decision === 'allow' && event.execution === 'succeeded'
    && Date.parse(event.timestamp) > Date.parse(bobBlocked.timestamp));
  return { bobBlocked, aliceAllowed };
}
