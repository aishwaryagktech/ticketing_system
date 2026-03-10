import { Router } from 'express';
import { prisma } from '../db/postgres';

const router = Router();

// Public read-only branding endpoint for widgets/portals.
router.get('/branding', async (req, res) => {
  const tenantId = String(req.query.tenant_id || '').trim();
  if (!tenantId) {
    res.status(400).json({ error: 'tenant_id required' });
    return;
  }
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { product: true },
    });
    if (!tenant || !tenant.product) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }
    res.json({
      logo_base64: tenant.logo_base64 ?? null,
      primary_color: tenant.product.primary_color,
      name: tenant.name,
    });
  } catch (e) {
    console.error('branding-public error:', e);
    res.status(500).json({ error: 'Failed to load branding' });
  }
});

export default router;

