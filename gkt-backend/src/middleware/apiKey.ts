import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/postgres';
import crypto from 'crypto';

export interface ApiKeyRequest extends Request {
  productId?: string;
}

/**
 * API key authentication for public /v1/ routes.
 */
export async function apiKeyAuth(req: ApiKeyRequest, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    res.status(401).json({ error: 'API key required' });
    return;
  }

  try {
    const hash = crypto.createHash('sha256').update(apiKey).digest('hex');

    const product = await prisma.product.findFirst({
      where: { api_key_hash: hash, is_active: true },
    });

    if (!product) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    req.productId = product.id;
    next();
  } catch {
    res.status(500).json({ error: 'Authentication failed' });
  }
}
