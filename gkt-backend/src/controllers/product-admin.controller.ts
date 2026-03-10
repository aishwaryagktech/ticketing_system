import { Request, Response } from 'express';
import { prisma } from '../db/postgres';
import { encryptPII } from '../utils/encrypt';
// --- SLA ---
export async function listSLAPolicies(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function createSLAPolicy(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function updateSLAPolicy(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}

// --- Escalation ---
export async function listEscalationRules(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function createEscalationRule(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function updateEscalationRule(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}

// --- Branding ---
export async function getBranding(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function updateBranding(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}

// --- AI Providers ---
export async function listAIProviders(req: Request, res: Response): Promise<void> {
  const productId = (req as any).user?.role === 'super_admin' ? null : (req as any).product_id;
  try {
    const providers = await prisma.aiProviderConfig.findMany({
      where: { product_id: productId },
    });
    // Omit sensitive encrypted key when returning to frontend
    const safeProviders = providers.map((p) => {
      const { api_key_encrypted, ...rest } = p;
      return rest;
    });
    res.json(safeProviders);
  } catch (err) {
    console.error('listAIProviders err', err);
    res.status(500).json({ error: 'Failed to fetch AI providers' });
  }
}

export async function createAIProvider(req: Request, res: Response): Promise<void> {
  const productId = (req as any).user?.role === 'super_admin' ? null : (req as any).product_id;
  try {
    const data = req.body;
    
    // Check for existing provider
    const existing = await prisma.aiProviderConfig.findFirst({
      where: { product_id: productId, provider_name: data.provider_name }
    });
    if (existing) {
       res.status(409).json({ error: 'Provider already configured' });
       return;
    }

    const encryptedKey = encryptPII(data.api_key_encrypted);

    const provider = await prisma.aiProviderConfig.create({
      data: {
        product_id: productId,
        provider_name: data.provider_name,
        api_key_encrypted: encryptedKey,
        enabled: data.enabled ?? true,
        available_models: data.available_models || [],
        default_model: data.default_model,
        custom_base_url: data.custom_base_url,
        created_by: (req as any).user?.id || 'system',
      }
    });

    const { api_key_encrypted, ...safeResponse } = provider;
    res.json(safeResponse);
  } catch (err) {
    console.error('createAIProvider err', err);
    res.status(500).json({ error: 'Failed to create AI provider' });
  }
}

export async function updateAIProvider(req: Request, res: Response): Promise<void> {
  const productId = (req as any).user?.role === 'super_admin' ? null : (req as any).product_id;
  const { id } = req.params;
  
  try {
    const existing = await prisma.aiProviderConfig.findUnique({ where: { id }});
    // Prevent updating cross-product
    if (!existing || (existing.product_id !== productId && productId !== undefined)) {
       res.status(404).json({ error: 'Not found' });
       return;
    }

    const data = req.body;
    const updateData: any = {
      enabled: data.enabled,
      available_models: data.available_models,
      default_model: data.default_model,
      custom_base_url: data.custom_base_url,
    };

    if (data.api_key_encrypted) {
       updateData.api_key_encrypted = encryptPII(data.api_key_encrypted);
    }

    const updated = await prisma.aiProviderConfig.update({
      where: { id },
      data: updateData
    });
    
    const { api_key_encrypted, ...safeResponse } = updated;
    res.json(safeResponse);
  } catch (err) {
    console.error('updateAIProvider err', err);
    res.status(500).json({ error: 'Failed to update AI provider' });
  }
}

// --- Tenants ---
export async function listTenants(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function createTenant(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function updateTenant(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
