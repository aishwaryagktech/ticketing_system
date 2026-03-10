"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const postgres_1 = require("../src/db/postgres");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const encrypt_1 = require("../src/utils/encrypt");
async function main() {
    console.log('🌱 Seeding database...');
    // Create default billing plans
    const starterPlan = await postgres_1.prisma.billingPlan.create({
        data: {
            name: 'Starter',
            max_agents: 3,
            max_tickets_per_month: 500,
            price_inr: 4999,
            price_usd: 59,
            features: { sms_alerts: false, white_label: false },
        },
    });
    const growthPlan = await postgres_1.prisma.billingPlan.create({
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
    const enterprisePlan = await postgres_1.prisma.billingPlan.create({
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
    const product = await postgres_1.prisma.product.create({
        data: {
            name: 'GKT AI',
            slug: 'gkt-ai',
            plan_id: enterprisePlan.id,
            created_by: 'system',
        },
    });
    // Create default tenant
    const tenant = await postgres_1.prisma.tenant.create({
        data: {
            product_id: product.id,
            name: 'GKT Internal',
            slug: 'gkt-internal',
            created_by: 'system',
        },
    });
    // Create super admin
    const passwordHash = await bcryptjs_1.default.hash('password123', 10);
    const userEmail = 'superadmin@gkt.app';
    const superAdmin = await postgres_1.prisma.user.create({
        data: {
            product_id: product.id,
            tenant_id: tenant.id,
            name: (0, encrypt_1.encryptPII)('Super Admin'),
            email: (0, encrypt_1.encryptPII)(userEmail),
            email_hash: (0, encrypt_1.hashSearchable)(userEmail),
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
    await postgres_1.prisma.$disconnect();
})
    .catch(async (e) => {
    console.error(e);
    await postgres_1.prisma.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map