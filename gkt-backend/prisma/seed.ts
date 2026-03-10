import { prisma } from '../src/db/postgres';
import bcrypt from 'bcryptjs';
import { encryptPII, hashSearchable } from '../src/utils/encrypt';

async function main() {
  console.log('🌱 Seeding database...');

  // Create default billing plans
  const starterPlan = await prisma.billingPlan.create({
    data: {
      name: 'Starter',
      max_agents: 3,
      max_tickets_per_month: 500,
      price_inr: 4999,
      price_usd: 59,
      features: { sms_alerts: false, white_label: false },
    },
  });

  const growthPlan = await prisma.billingPlan.create({
    data: {
      name: 'Growth',
      max_agents: 10,
      max_tickets_per_month: 5000,
      price_inr: 14999,
      price_usd: 179,
      overage_per_ticket_inr: 5,
      overage_per_ticket_usd: 0.06,
      features: { sms_alerts: true, white_label: false },
    },
  });

  const enterprisePlan = await prisma.billingPlan.create({
    data: {
      name: 'Enterprise',
      max_agents: -1,
      max_tickets_per_month: -1,
      price_inr: 49999,
      price_usd: 599,
      features: { sms_alerts: true, white_label: true },
    },
  });

  console.log('✅ Billing plans created:', { starterPlan, growthPlan, enterprisePlan });

  // Create default product
  const product = await prisma.product.create({
    data: {
      name: 'GKT AI',
      slug: 'gkt-ai',
      plan_id: enterprisePlan.id,
      created_by: 'system',
    },
  });

  // Create default tenant
  const tenant = await prisma.tenant.create({
    data: {
      product_id: product.id,
      name: 'GKT Internal',
      slug: 'gkt-internal',
      created_by: 'system',
    },
  });

  // Create super admin
  const passwordHash = await bcrypt.hash('password123', 10);
  const userEmail = 'superadmin@gkt.app';
  
  const superAdmin = await prisma.user.create({
    data: {
      product_id: product.id,
      tenant_id: tenant.id,
      name: encryptPII('Super Admin'),
      email: encryptPII(userEmail),
      email_hash: hashSearchable(userEmail),
      password_hash: passwordHash,
      role: 'super_admin',
      user_type: 'individual',
    },
  });

  console.log('✅ Super Admin created:', userEmail);

  console.log('🌱 Seeding complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
