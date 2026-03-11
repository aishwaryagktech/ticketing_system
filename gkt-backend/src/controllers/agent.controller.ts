import { Request, Response } from 'express';
import { prisma } from '../db/postgres';
import { AuthRequest } from '../middleware/auth';

// GET /api/agents
export async function listAgents(req: Request, res: Response): Promise<void> {
  // TODO: Implement agent roster listing
  res.status(501).json({ message: 'Not implemented' });
}

// POST /api/agents/invite
export async function inviteAgent(req: Request, res: Response): Promise<void> {
  // TODO: Implement agent invitation
  res.status(501).json({ message: 'Not implemented' });
}

// PATCH /api/agents/:id
export async function updateAgent(req: Request, res: Response): Promise<void> {
  // TODO: Implement agent update
  res.status(501).json({ message: 'Not implemented' });
}

// PATCH /api/agents/:id/deactivate
export async function deactivateAgent(req: Request, res: Response): Promise<void> {
  // TODO: Implement agent deactivation
  res.status(501).json({ message: 'Not implemented' });
}

// GET /api/agents/me/products
export async function myProducts(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const tenantId = req.user?.tenant_id;
  if (!userId || !tenantId) {
    res.status(403).json({ error: 'Tenant context required' });
    return;
  }

  try {
    const rows = await prisma.productAgent.findMany({
      where: { user_id: userId, tenant_product: { tenant_id: tenantId } },
      include: { tenant_product: { select: { id: true, name: true, status: true } } },
      orderBy: { created_at: 'asc' },
    });
    const items = rows
      .filter((r) => r.tenant_product?.status !== 'inactive')
      .map((r) => ({
        id: r.tenant_product_id,
        name: r.tenant_product?.name || 'Product',
        support_level: r.support_level,
      }));
    res.json({ items });
  } catch (e) {
    console.error('myProducts error:', e);
    res.status(500).json({ error: 'Failed to load products' });
  }
}
