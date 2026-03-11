import { prisma } from '../db/postgres';
import { Priority } from '@prisma/client';

const RESOLVED_STATUSES = ['resolved', 'closed'];

/**
 * Get resolution time (minutes) from SLA policy for a ticket context.
 * Looks up by tenant_product_id + priority first, then product-level (tenant_product_id null).
 */
export async function getResolutionTimeMins(
  productId: string,
  tenantProductId: string | null,
  priority: string
): Promise<number | null> {
  const priorityEnum = normalizePriority(priority);
  if (!priorityEnum) return null;

  // Prefer tenant_product-specific policy
  if (tenantProductId) {
    const policy = await prisma.slaPolicy.findFirst({
      where: {
        tenant_product_id: tenantProductId,
        priority: priorityEnum,
      },
      select: { resolution_time_mins: true },
    });
    if (policy) return policy.resolution_time_mins;
  }

  // Fallback: product-level policy (tenant_product_id null)
  const policy = await prisma.slaPolicy.findFirst({
    where: {
      product_id: productId,
      tenant_product_id: null,
      priority: priorityEnum,
    },
    select: { resolution_time_mins: true },
  });
  if (policy?.resolution_time_mins != null) {
    return policy.resolution_time_mins;
  }

  // Fallback default SLA per priority tier (in minutes)
  // P1: 1 hour, P2: 4 hours, P3: 12 hours, P4: 48 hours
  if (priorityEnum === 'p1') return 60;
  if (priorityEnum === 'p2') return 4 * 60;
  if (priorityEnum === 'p3') return 12 * 60;
  if (priorityEnum === 'p4') return 48 * 60;

  return null;
}

/**
 * Compute SLA deadline from created_at and resolution time in minutes.
 */
export function computeSlaDeadline(createdAt: Date, resolutionTimeMins: number): Date {
  return new Date(createdAt.getTime() + resolutionTimeMins * 60 * 1000);
}

/**
 * Check if ticket should be considered breached (deadline passed, not resolved/closed).
 */
export function shouldBeBreached(
  slaDeadline: Date | null,
  status: string,
  alreadyBreached: boolean
): boolean {
  if (!slaDeadline || alreadyBreached) return alreadyBreached;
  if (RESOLVED_STATUSES.includes(String(status).toLowerCase())) return false;
  return Date.now() > new Date(slaDeadline).getTime();
}

/**
 * Mark all tickets that have passed SLA deadline and are not resolved/closed as breached.
 */
export async function markBreachedTickets(): Promise<number> {
  const now = new Date();
  const result = await prisma.ticket.updateMany({
    where: {
      sla_deadline: { lt: now },
      sla_breached: false,
      status: { notIn: ['resolved', 'closed'] },
    },
    data: { sla_breached: true },
  });
  return result.count;
}

function normalizePriority(priority: string): Priority | null {
  const p = String(priority).toLowerCase();
  if (p === 'p1') return 'p1';
  if (p === 'p2') return 'p2';
  if (p === 'p3') return 'p3';
  if (p === 'p4') return 'p4';
  return null;
}
