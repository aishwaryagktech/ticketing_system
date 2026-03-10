import { Request, Response } from 'express';
import { prisma } from '../db/postgres';

export async function listPlans(req: Request, res: Response): Promise<void> {
  try {
    const plans = await prisma.billingPlan.findMany({
      where: { is_active: true },
      orderBy: { price_usd: 'asc' },
    });
    res.json(plans);
  } catch (e) {
    console.error('listPlans error:', e);
    res.status(500).json({ error: 'Failed to list plans' });
  }
}
export async function getSubscription(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function subscribe(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function updateSubscription(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function listInvoices(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
