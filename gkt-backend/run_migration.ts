import { prisma } from './src/db/postgres';

async function main() {
  await prisma.$executeRawUnsafe(
    `ALTER TABLE tenant_channel_settings ADD COLUMN IF NOT EXISTS human_support_channel TEXT NOT NULL DEFAULT 'email'`
  );
  console.log('Migration applied: human_support_channel column added');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
