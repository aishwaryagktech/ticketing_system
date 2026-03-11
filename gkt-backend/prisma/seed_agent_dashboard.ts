import { prisma } from '../src/db/postgres';

async function main() {
  console.log('🌱 Seeding sample data for agent dashboard...');

  // 1) Pick any existing tenant (the first one)
  const tenant = await prisma.tenant.findFirst({
    include: { tenant_products: true },
  });

  if (!tenant) {
    console.log('No tenants found. Run your normal onboarding/seed first.');
    return;
  }

  // 2) Ensure we have at least one tenant_product
  let tenantProduct = tenant.tenant_products[0];
  if (!tenantProduct) {
    tenantProduct = await prisma.tenantProduct.create({
      data: {
        tenant_id: tenant.id,
        name: 'Dashboard Demo Product',
        description: 'Sample product for agent dashboard seeding',
        status: 'active',
        created_by: 'seed_agent_dashboard',
      },
    });
    console.log('Created demo tenant_product:', tenantProduct.id);
  } else {
    console.log('Using existing tenant_product:', tenantProduct.id);
  }

  // 3) Pick any user in this tenant to act as an "agent" for assignment
  const anyUser = await prisma.user.findFirst({
    where: { tenant_id: tenant.id },
  });

  if (!anyUser) {
    console.log('No users found for this tenant; cannot create assigned tickets.');
  } else {
    console.log('Using user for assignment:', anyUser.id);
  }

  // 4) Create some sample tickets in different states
  const now = new Date();
  const past = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago

  const created = await prisma.ticket.createMany({
    data: [
      // Assigned, in progress
      {
        ticket_number: 'DEMO-ASSIGNED-1',
        product_id: tenant.product_id,
        tenant_id: tenant.id,
        tenant_product_id: tenantProduct.id,
        created_by: 'seed@gkt.app',
        assigned_to: anyUser ? anyUser.id : null,
        subject: 'Demo: Payment failure for premium course',
        description: 'Customer reports payment failing at Razorpay checkout on Chrome.',
        status: 'in_progress',
        priority: 'p2',
        source: 'web_form',
        user_type: 'individual',
        escalation_level: 0,
        sla_deadline: new Date(now.getTime() + 2 * 60 * 60 * 1000), // +2h
        created_at: past,
        updated_at: now,
      },
      // Unassigned, new
      {
        ticket_number: 'DEMO-UNASSIGNED-1',
        product_id: tenant.product_id,
        tenant_id: tenant.id,
        tenant_product_id: tenantProduct.id,
        created_by: 'seed@gkt.app',
        assigned_to: null,
        subject: 'Demo: Unable to access student portal',
        description: 'Student says portal shows 500 error after login.',
        status: 'new_ticket',
        priority: 'p3',
        source: 'web_form',
        user_type: 'individual',
        escalation_level: 0,
        sla_deadline: new Date(now.getTime() + 6 * 60 * 60 * 1000), // +6h
        created_at: now,
        updated_at: now,
      },
      // Breached SLA, escalated
      {
        ticket_number: 'DEMO-BREACHED-1',
        product_id: tenant.product_id,
        tenant_id: tenant.id,
        tenant_product_id: tenantProduct.id,
        created_by: 'seed@gkt.app',
        assigned_to: anyUser ? anyUser.id : null,
        subject: 'Demo: Production outage for LMS',
        description: 'Critical outage reported by multiple campuses; LMS is down.',
        status: 'open',
        priority: 'p1',
        source: 'web_form',
        user_type: 'individual',
        escalation_level: 2,
        sla_deadline: new Date(now.getTime() - 1 * 60 * 60 * 1000), // -1h (breached)
        sla_breached: true,
        created_at: past,
        updated_at: now,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Tickets created for dashboard seed:', created);
  console.log('Done.');
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

