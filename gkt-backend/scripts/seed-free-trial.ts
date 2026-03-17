import { prisma } from '../src/db/postgres';

async function main() {
  const existing = await prisma.billingPlan.findFirst({ where: { is_free_trial: true } });
  if (existing) {
    console.log('Free Trial plan already exists:', existing.id);
    return;
  }
  const plan = await prisma.billingPlan.create({
    data: {
      name: 'Free Trial',
      max_agents: 3,
      max_tickets_per_month: 100,
      max_products: 1,
      price_inr: 0,
      price_usd: 0,
      is_free_trial: true,
      trial_days: 14,
      features: { sms_alerts: false, white_label: false },
    },
  });
  console.log('✅ Created Free Trial plan:', plan.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
