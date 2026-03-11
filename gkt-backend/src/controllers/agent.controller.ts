import { Request, Response } from 'express';
import { prisma } from '../db/postgres';
import { AuthRequest } from '../middleware/auth';
import { encryptPII, hashSearchable } from '../utils/encrypt';
import bcrypt from 'bcryptjs';

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
export async function updateAgent(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const actorRole = req.user?.role;
  const { id } = req.params;
  const { first_name, last_name, email, role, assigned_products, new_password } =
    (req.body as any) || {};

  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  if (actorRole !== 'tenant_admin' && actorRole !== 'super_admin') {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }
  if (!id) {
    res.status(400).json({ error: 'id required' });
    return;
  }

  try {
    const existing = await prisma.user.findFirst({
      where: { id, tenant_id: tenantId },
      include: { roleRef: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    const data: any = {};

    if (typeof email === 'string' && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const emailHash = hashSearchable(normalizedEmail);

      const conflict = await prisma.user.findFirst({
        where: {
          tenant_id: tenantId,
          email_hash: emailHash,
          NOT: { id: existing.id },
        },
      });

      if (conflict) {
        res.status(409).json({ error: 'User with this email already exists' });
        return;
      }

      data.email = encryptPII(normalizedEmail);
      data.email_hash = emailHash;
    }

    if (typeof first_name === 'string') {
      const trimmed = first_name.trim();
      data.first_name = trimmed ? encryptPII(trimmed) : null;
    }

    if (typeof last_name === 'string') {
      const trimmed = last_name.trim();
      data.last_name = trimmed ? encryptPII(trimmed) : null;
    }

    let desiredRoleName = existing.roleRef?.name ?? 'l1_agent';
    if (typeof role === 'string') {
      desiredRoleName =
        role === 'tenant_admin'
          ? 'tenant_admin'
          : role === 'l2_agent'
          ? 'l2_agent'
          : role === 'l3_agent'
          ? 'l3_agent'
          : 'l1_agent';
    }

    const roleRecord = await prisma.userRole.upsert({
      where: { name: desiredRoleName },
      update: {},
      create: { name: desiredRoleName, label: desiredRoleName.replace('_', ' ').toUpperCase() },
    });

    data.role_id = roleRecord.id;

    if (typeof new_password === 'string' && new_password.trim()) {
      if (new_password.trim().length < 8) {
        res.status(400).json({ error: 'new_password must be at least 8 characters' });
        return;
      }
      const passwordHash = await bcrypt.hash(new_password.trim(), 10);
      data.password_hash = passwordHash;
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data,
    });

    if (Array.isArray(assigned_products)) {
      const rawAssignments: string[] = assigned_products;
      const tenantProductIds = new Set(
        (
          await prisma.tenantProduct.findMany({
            where: { tenant_id: tenantId },
            select: { id: true },
          })
        ).map((tp) => tp.id)
      );

      const assignments = rawAssignments.filter(
        (tpId) => typeof tpId === 'string' && tenantProductIds.has(tpId)
      );

      if (desiredRoleName === 'tenant_admin') {
        await prisma.productAgent.deleteMany({
          where: {
            user_id: updated.id,
            tenant_product: { tenant_id: tenantId },
          },
        });
      } else {
        const level =
          desiredRoleName === 'l2_agent' ? 'L2' : desiredRoleName === 'l3_agent' ? 'L3' : 'L1';

        const existingAssignments = await prisma.productAgent.findMany({
          where: { user_id: updated.id },
          include: { tenant_product: true },
        });

        const existingForTenant = existingAssignments.filter(
          (pa) => pa.tenant_product?.tenant_id === tenantId
        );
        const existingIds = new Set(existingForTenant.map((pa) => pa.tenant_product_id));

        const toRemove = existingForTenant.filter(
          (pa) => !assignments.includes(pa.tenant_product_id)
        );
        if (toRemove.length) {
          await prisma.productAgent.deleteMany({
            where: { id: { in: toRemove.map((pa) => pa.id) } },
          });
        }

        for (const tpId of assignments) {
          if (!existingIds.has(tpId)) {
            await prisma.productAgent
              .create({
                data: {
                  tenant_product_id: tpId,
                  user_id: updated.id,
                  support_level: level,
                },
              })
              .catch(() => {
                // ignore duplicate
              });
          } else {
            await prisma.productAgent.updateMany({
              where: { user_id: updated.id, tenant_product_id: tpId },
              data: { support_level: level },
            });
          }
        }
      }
    }

    res.json({ message: 'Agent updated', id: updated.id });
  } catch (e) {
    console.error('updateAgent error:', e);
    res.status(500).json({ error: 'Failed to update agent' });
  }
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
