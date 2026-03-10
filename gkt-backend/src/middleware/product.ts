import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/**
 * Resolves product_id from subdomain or X-Product-Id header.
 * Attaches product_id to req for downstream use.
 */
export function resolveProduct(req: AuthRequest, res: Response, next: NextFunction): void {
  // Try header first
  const headerProductId = req.headers['x-product-id'] as string;
  if (headerProductId) {
    req.user = { ...req.user!, product_id: headerProductId };
    next();
    return;
  }

  // Try subdomain
  const host = req.hostname;
  const subdomain = host.split('.')[0];
  if (subdomain && subdomain !== 'www' && subdomain !== 'localhost') {
    // TODO: Lookup product by slug (subdomain)
    next();
    return;
  }

  next();
}
