import { Response } from 'express';
import { prisma } from '../db/postgres';
import { AuthRequest } from '../middleware/auth';
import { BillingService } from '../services/billing.service';
import { env } from '../config/env';

export async function listPlans(req: AuthRequest, res: Response): Promise<void> {
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

export async function getSubscription(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  try {
    const data = await BillingService.getSubscription(tenantId);
    res.json(data);
  } catch (e) {
    console.error('getSubscription error:', e);
    res.status(500).json({ error: 'Failed to get subscription' });
  }
}

export async function subscribe(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  const { plan_id } = req.body;
  if (!plan_id || typeof plan_id !== 'string') {
    res.status(400).json({ error: 'plan_id required' });
    return;
  }
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
    res.status(503).json({ error: 'Payment gateway not configured' });
    return;
  }
  try {
    const { order, plan } = await BillingService.createOrder(plan_id, tenantId);
    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: env.RAZORPAY_KEY_ID,
      plan: { id: plan.id, name: plan.name, price_inr: plan.price_inr },
    });
  } catch (e: any) {
    console.error('subscribe error:', e);
    res.status(500).json({ error: e?.message || 'Failed to create payment order' });
  }
}

export async function verifyPayment(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id } = req.body;
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan_id) {
    res.status(400).json({ error: 'razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_id are required' });
    return;
  }
  try {
    const isValid = BillingService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    );
    if (!isValid) {
      res.status(400).json({ error: 'Payment verification failed: invalid signature' });
      return;
    }
    const result = await BillingService.activateSubscription(tenantId, plan_id, razorpay_order_id, razorpay_payment_id);
    res.json({ message: 'Payment verified and subscription activated', ...result });
  } catch (e: any) {
    console.error('verifyPayment error:', e);
    res.status(500).json({ error: e?.message || 'Failed to verify payment' });
  }
}

export async function activateFreeTrial(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  const { plan_id } = req.body;
  if (!plan_id || typeof plan_id !== 'string') {
    res.status(400).json({ error: 'plan_id required' });
    return;
  }
  try {
    const result = await BillingService.activateFreeTrial(tenantId, plan_id);
    res.json({ message: 'Free trial activated', ...result });
  } catch (e: any) {
    console.error('activateFreeTrial error:', e);
    res.status(400).json({ error: e?.message || 'Failed to activate free trial' });
  }
}

export async function updateSubscription(req: AuthRequest, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}

export async function listInvoices(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const invoices = await BillingService.listInvoices(tenantId, limit);
    res.json(invoices);
  } catch (e) {
    console.error('listInvoices error:', e);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
}

export async function getInvoice(req: AuthRequest, res: Response): Promise<void> {
  const tenantId = req.user?.tenant_id;
  const { payment_id } = req.params;
  if (!tenantId) {
    res.status(403).json({ error: 'Tenant required' });
    return;
  }
  try {
    const invoices = await BillingService.listInvoices(tenantId, 100);
    const invoice = invoices.find((inv) => inv.payment_id === payment_id);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found' });
      return;
    }
    res.json(invoice);
  } catch (e) {
    console.error('getInvoice error:', e);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
}
