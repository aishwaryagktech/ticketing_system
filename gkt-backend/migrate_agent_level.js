const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function run() {
  await p.$executeRawUnsafe(`ALTER TABLE kb_sources ADD COLUMN IF NOT EXISTS agent_level VARCHAR(10) NOT NULL DEFAULT 'l0'`);
  console.log('agent_level column added to kb_sources');
  await p.$executeRawUnsafe(`ALTER TABLE tenant_products ADD COLUMN IF NOT EXISTS l1_model VARCHAR(255)`);
  console.log('l1_model column added to tenant_products');
  await p.$executeRawUnsafe(`ALTER TABLE tenant_products ADD COLUMN IF NOT EXISTS l1_provider VARCHAR(255)`);
  console.log('l1_provider column added to tenant_products');
}

run()
  .then(() => { console.log('Done.'); process.exit(0); })
  .catch((e) => { console.error('Error:', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
