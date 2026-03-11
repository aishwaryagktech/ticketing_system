/**
 * One-off script to inspect kb_sources table.
 * Run from gkt-backend: npx ts-node -r dotenv/config scripts/check-kb-sources.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantProductId = process.argv[2] || '5402e5fe-52d6-45f1-a631-cae09f2330c1';
  console.log('KbSource table columns (from schema): id, product_id, tenant_id, tenant_product_id, source_type, url, title, ...\n');

  const all = await prisma.kbSource.findMany({
    select: {
      id: true,
      product_id: true,
      tenant_id: true,
      tenant_product_id: true,
      source_type: true,
      url: true,
      title: true,
      updated_at: true,
    },
    orderBy: { updated_at: 'desc' },
    take: 20,
  });
  console.log('All kb_sources (up to 20):', JSON.stringify(all, null, 2));

  const forProduct = await prisma.kbSource.findMany({
    where: {
      OR: [
        { tenant_product_id: tenantProductId },
        { tenant_product_id: null },
      ],
      AND: [
        {
          OR: [
            { source_type: 'upload' },
            { url: { startsWith: 'upload:' } },
          ],
        },
      ],
    },
    select: {
      id: true,
      tenant_id: true,
      tenant_product_id: true,
      source_type: true,
      url: true,
      title: true,
    },
    orderBy: { updated_at: 'desc' },
    take: 20,
  });
  console.log('\nFiltered for tenant_product_id', tenantProductId, 'or null (upload only):', JSON.stringify(forProduct, null, 2));

  const tp = await prisma.tenantProduct.findUnique({
    where: { id: tenantProductId },
    select: { id: true, tenant_id: true, product_id: true },
  });
  console.log('\nTenantProduct', tenantProductId, 'belongs to tenant_id:', tp?.tenant_id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
