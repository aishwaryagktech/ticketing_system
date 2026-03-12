import Razorpay from 'razorpay';
import crypto from 'crypto';
import { env } from '../config/env';
import { prisma } from '../db/postgres';
import { PaymentTransaction } from '../../mongo/models/payment-transaction.model';

const getRazorpay = () =>
  new Razorpay({
    key_id: env.RAZORPAY_KEY_ID!,
    key_secret: env.RAZORPAY_KEY_SECRET!,
  });

export class BillingService {
  static async createOrder(planId: string, tenantId: string) {
    const plan = await prisma.billingPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');
    if (!plan.is_active) throw new Error('Plan is no longer available');

    const amountInPaise = Math.round(Number(plan.price_inr) * 100);
    if (amountInPaise <= 0) throw new Error('Plan has invalid price');

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `t_${tenantId.slice(0, 12)}_p_${planId.slice(0, 12)}`,
      notes: { tenant_id: tenantId, plan_id: planId },
    });

    return { order, plan };
  }

  static verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest('hex');
    return expectedSignature === signature;
  }

  static async activateSubscription(
    tenantId: string,
    planId: string,
    orderId: string,
    paymentId: string,
  ) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { product_id: true },
    });
    if (!tenant) throw new Error('Tenant not found');

    const plan = await prisma.billingPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const [, subscription] = await prisma.$transaction([
      prisma.tenant.update({
        where: { id: tenantId },
        data: { plan_id: planId, onboarding_step: 'plan_selected' },
      }),
      prisma.productSubscription.upsert({
        where: { product_id: tenant.product_id },
        create: {
          product_id: tenant.product_id,
          plan_id: planId,
          status: 'active',
          payment_provider: 'razorpay',
          external_subscription_id: paymentId,
          current_period_start: now,
          current_period_end: periodEnd,
        },
        update: {
          plan_id: planId,
          status: 'active',
          payment_provider: 'razorpay',
          external_subscription_id: paymentId,
          current_period_start: now,
          current_period_end: periodEnd,
        },
      }),
    ]);

    // Persist payment history to MongoDB (best-effort — don't block the response)
    PaymentTransaction.create({
      tenant_id: tenantId,
      product_id: tenant.product_id,
      payment_id: paymentId,
      order_id: orderId,
      plan_id: plan.id,
      plan_name: plan.name,
      amount_inr: Number(plan.price_inr),
      currency: 'INR',
      status: 'paid',
      payment_provider: 'razorpay',
      period_start: now,
      period_end: periodEnd,
      paid_at: now,
    }).catch((e) => console.error('PaymentTransaction save error:', e));

    return {
      transaction: {
        payment_id: paymentId,
        order_id: orderId,
        plan_id: plan.id,
        plan_name: plan.name,
        amount_inr: Number(plan.price_inr),
        paid_at: now.toISOString(),
        valid_until: subscription.current_period_end.toISOString(),
        status: 'paid',
      },
    };
  }

  static async listInvoices(tenantId: string, limit = 20) {
    const txns = await PaymentTransaction.find({ tenant_id: tenantId })
      .sort({ paid_at: -1 })
      .limit(limit)
      .lean();

    return txns.map((t: any) => ({
      id: String(t._id),
      payment_id: t.payment_id,
      order_id: t.order_id,
      plan_id: t.plan_id,
      plan_name: t.plan_name,
      amount_inr: t.amount_inr,
      currency: t.currency ?? 'INR',
      status: t.status ?? 'paid',
      payment_provider: t.payment_provider ?? 'razorpay',
      period_start: t.period_start ? (t.period_start as Date).toISOString() : null,
      period_end: t.period_end ? (t.period_end as Date).toISOString() : null,
      paid_at: t.paid_at ? (t.paid_at as Date).toISOString() : null,
    }));
  }

  static async getSubscription(tenantId: string) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        product_id: true,
        plan_id: true,
        plan: true,
      },
    });
    if (!tenant) return null;

    const subscription = await prisma.productSubscription.findUnique({
      where: { product_id: tenant.product_id },
    });

    return { plan: tenant.plan, subscription };
  }
}
