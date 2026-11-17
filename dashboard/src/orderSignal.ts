import type { AuditEvent } from './audit.ts';
import { isOwnershipDenial } from './audit.ts';

export type OrderSignal = 'own-order-read' | 'blocked-order-read' | 'exposed-order-access' | null;

export function orderSignal(event: AuditEvent): OrderSignal {
  if (event.action !== 'orders.read') return null;
  if (event.actor_id === 'alice' && event.resource_id.startsWith('ord-bob-')
    && event.reason === 'demo_ownership_check_disabled'
    && event.decision === 'allow' && event.execution === 'succeeded') return 'exposed-order-access';
  if (event.decision === 'deny' && event.execution === 'blocked'
    && (isOwnershipDenial(event) || event.reason === 'invalid_session')) return 'blocked-order-read';
  if (event.actor_id && event.resource_id.startsWith(`ord-${event.actor_id}-`)
    && event.reason === 'owner_match'
    && event.decision === 'allow' && event.execution === 'succeeded') return 'own-order-read';
  return null;
}

export const orderSignalLabel: Record<Exclude<OrderSignal, null>, string> = {
  'own-order-read': 'Own order · authorized',
  'blocked-order-read': 'Unauthorized order attempt · blocked',
  'exposed-order-access': 'Cross-account read · allowed',
};
