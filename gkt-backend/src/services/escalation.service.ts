import { prisma } from '../db/postgres';
import { EscalationTrigger } from '@prisma/client';

export class EscalationService {
  /**
   * Evaluates escalation rules for all matching tickets.
   * Currently focusing on 'sla_breach' triggers.
   */
  static async evaluateAutoEscalation(): Promise<number> {
    const now = new Date();
    let escalatedCount = 0;

    // Find active tickets that might need escalation
    const tickets = await prisma.ticket.findMany({
      where: {
        status: { notIn: ['resolved', 'closed'] },
        sla_deadline: { not: null },
      },
      include: {
        tenant_product: {
          include: {
            escalation_rules: {
              where: { is_active: true },
              orderBy: { level: 'asc' },
            },
          },
        },
      },
    });

    for (const ticket of tickets) {
      if (!ticket.tenant_product?.escalation_rules) continue;

      // Find the next rule for this ticket's current escalation_level
      const nextLevel = ticket.escalation_level + 1;
      const nextRule = ticket.tenant_product.escalation_rules.find(
        (r) => r.level === nextLevel && r.trigger_type === EscalationTrigger.sla_breach
      );

      if (!nextRule) continue;

      const thresholdMins = nextRule.trigger_threshold_mins || 0;
      const escalationDue = new Date(
        new Date(ticket.sla_deadline!).getTime() + thresholdMins * 60 * 1000
      );

      if (now >= escalationDue) {
        // Perform escalation
        await prisma.$transaction([
          prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              escalation_level: nextLevel,
              assigned_to: null, // Make it unassigned for the new level's agents to claim
            },
          }),
          prisma.escalationLog.create({
            data: {
              product_id: ticket.product_id,
              ticket_id: ticket.id,
              from_level: ticket.escalation_level,
              to_level: nextLevel,
              trigger_reason: `Auto-escalation: ${EscalationTrigger.sla_breach} threshold of ${thresholdMins}m reached`,
              triggered_by: 'system_auto',
            },
          }),
        ]);
        escalatedCount++;
      }
    }

    return escalatedCount;
  }

  /**
   * Get the predicted next escalation time for a ticket.
   */
  static async getNextEscalationDue(ticketId: string): Promise<Date | null> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        tenant_product: {
          include: {
            escalation_rules: {
              where: { is_active: true, trigger_type: EscalationTrigger.sla_breach },
              orderBy: { level: 'asc' },
            },
          },
        },
      },
    });

    if (!ticket || !ticket.sla_deadline || !ticket.tenant_product) return null;

    const nextRule = ticket.tenant_product.escalation_rules.find(
      (r) => r.level === ticket.escalation_level + 1
    );

    if (!nextRule) return null;

    return new Date(
      new Date(ticket.sla_deadline).getTime() + (nextRule.trigger_threshold_mins || 0) * 60 * 1000
    );
  }
}
