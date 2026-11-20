import type { AuditEvent } from './audit.ts';
import { isExposedOrderRead, isOwnershipDenial } from './audit.ts';

export type OrderSignal = 'own-order-read' | 'blocked-order-read' | 'exposed-order-access' | null;

export function orderSignal(event: AuditEvent): OrderSignal {
  if (event.action !== 'orders.read') return null;
  if (isExposedOrderRead(event)) return 'exposed-order-access';
  if (event.decision === 'deny' && event.execution === 'blocked'
    && (isOwnershipDenial(event) || event.reason === 'invalid_session')) return 'blocked-order-read';
  if (event.actor_id && event.resource_id.startsWith(`ord-${event.actor_id}-`)
    && event.reason === 'owner_match'
    && event.decision === 'allow' && event.execution === 'succeeded') return 'own-order-read';
  return null;
}

export const orderSignalLabel: Record<Exclude<OrderSignal, null>, string> = {
  'own-order-read': 'Authorized access',
  'blocked-order-read': 'Blocked access',
  'exposed-order-access': 'Data breach',
};

// Failures apply to any action, including cart and assistant events.
export function eventRowClass(event: AuditEvent): string | undefined {
  return event.execution === 'failed' ? 'event-error' : orderSignal(event) ?? undefined;
}
