import { Response } from 'express';
import { prisma } from '../db/postgres';
import { AuthRequest } from '../middleware/auth';
import { decryptPII } from '../utils/encrypt';

export async function getSummary(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) { res.status(403).json({ error: 'Tenant context required' }); return; }

  try {
    const tenantProducts = await prisma.tenantProduct.findMany({
      where: { tenant_id: tenantId },
      select: { id: true, name: true, status: true },
    });
    const tpIds = tenantProducts.map((tp) => tp.id);

    // Ticket counts by status
    const ticketsByStatus = await prisma.ticket.groupBy({
      by: ['status'],
      where: { tenant_id: tenantId },
      _count: { id: true },
    });
    const by_status: Record<string, number> = {};
    for (const row of ticketsByStatus) {
      by_status[row.status] = row._count.id;
    }
    const total_tickets = Object.values(by_status).reduce((a, b) => a + b, 0);

    // Tickets by priority
    const ticketsByPriority = await prisma.ticket.groupBy({
      by: ['priority'],
      where: { tenant_id: tenantId },
      _count: { id: true },
    });
    const by_priority: Record<string, number> = {};
    for (const row of ticketsByPriority) {
      by_priority[row.priority] = row._count.id;
    }

    // SLA / resolved
    const sla_breached_count = await prisma.ticket.count({ where: { tenant_id: tenantId, sla_breached: true } });
    const resolved_or_closed_count = await prisma.ticket.count({ where: { tenant_id: tenantId, status: { in: ['resolved', 'closed'] as any } } });

    // Bot stats
    const botResult = await prisma.ticketComment.aggregate({
      where: { ticket: { tenant_id: tenantId }, is_bot: true },
      _count: { id: true },
    });
    const bot_replies_total = botResult._count.id;

    // Agents
    const agent_count = await prisma.user.count({
      where: { tenant_id: tenantId, roleRef: { name: { in: ['l1_agent', 'l2_agent', 'l3_agent'] } } },
    });

    // KB articles
    const kb_articles_count = tpIds.length > 0
      ? await prisma.kbArticle.count({ where: { tenant_product_id: { in: tpIds } } })
      : 0;

    // Tickets created per day – last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const recentTickets = await prisma.ticket.findMany({
      where: { tenant_id: tenantId, created_at: { gte: since } },
      select: { created_at: true, status: true, sla_breached: true },
      orderBy: { created_at: 'asc' },
    });
    const dailyMap: Record<string, number> = {};
    for (const t of recentTickets) {
      const day = t.created_at.toISOString().slice(0, 10);
      dailyMap[day] = (dailyMap[day] || 0) + 1;
    }
    const tickets_over_time = Object.entries(dailyMap).map(([date, count]) => ({ date, count }));

    // Top agents by assigned tickets
    const topAgentsRaw = await prisma.ticket.groupBy({
      by: ['assigned_to'],
      where: { tenant_id: tenantId, assigned_to: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 8,
    });
    const agentIds = topAgentsRaw.map((r) => r.assigned_to as string);
    const agentUsers = agentIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: agentIds } },
          select: { id: true, first_name: true, last_name: true, email: true },
        })
      : [];
    const agentMap: Record<string, string> = {};
    for (const u of agentUsers) {
      let first = u.first_name || '';
      let last = u.last_name || '';
      try {
        if (first) first = decryptPII(first);
      } catch {
        /* ignore */
      }
      try {
        if (last) last = decryptPII(last);
      } catch {
        /* ignore */
      }
      let name = `${first} ${last}`.trim();
      if (!name) {
        let email = u.email || '';
        try {
          if (email) email = decryptPII(email);
        } catch {
          /* ignore */
        }
        name = email || 'Agent';
      }
      agentMap[u.id] = name.trim() || 'Agent';
    }
    const top_agents = topAgentsRaw.map((r) => ({
      agent_id: r.assigned_to,
      name: agentMap[r.assigned_to as string] || 'Unknown',
      ticket_count: r._count.id,
    }));

    // Tickets per product
    const ticketsByProduct: Array<{ name: string; count: number }> = [];
    for (const tp of tenantProducts) {
      const count = await prisma.ticket.count({ where: { tenant_product_id: tp.id } });
      ticketsByProduct.push({ name: tp.name, count });
    }

    res.json({
      total_tickets,
      by_status,
      by_priority,
      sla_breached_count,
      resolved_or_closed_count,
      bot_replies_total,
      agent_count,
      kb_articles_count,
      tickets_over_time,
      top_agents,
      tickets_by_product: ticketsByProduct,
      products_count: tenantProducts.length,
      active_products_count: tenantProducts.filter((tp) => tp.status === 'active').length,
    });
  } catch (err) {
    console.error('Analytics summary error', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
}

export async function getTicketAnalytics(req: AuthRequest, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function getAgentAnalytics(req: AuthRequest, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function getSLAAnalytics(req: AuthRequest, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function getAIUsage(req: AuthRequest, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function getKBAnalytics(req: AuthRequest, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function exportReport(req: AuthRequest, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
