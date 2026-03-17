import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/postgres';
import { env } from '../config/env';
import { encryptPII, decryptPII, hashSearchable } from '../utils/encrypt';

// POST /api/auth/register
export async function register(req: Request, res: Response): Promise<void> {
  const {
    first_name,
    last_name,
    phone,
    job_title,
    company,
    number_of_employees,
    email,
    password,
  } = req.body;

  if (!first_name || !last_name || !company || !email || !password) {
    res.status(400).json({ error: 'First name, last name, company, email and password are required' });
    return;
  }

  try {
    // Use the primary product (single-product SaaS for now)
    const product = await prisma.product.findFirst({
      where: { slug: 'gkt-ai' },
    });

    if (!product) {
      res.status(500).json({ error: 'No primary product configured for self-signup' });
      return;
    }

    const email_hash = hashSearchable(email);
    const existingUser = await prisma.user.findFirst({
      where: { email_hash },
    });

    if (existingUser) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    // Create tenant for this company
    // Always add a short random suffix to guarantee uniqueness for (product_id, slug)
    const base = company.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tenant';
    const tenantSlug = `${base}-${Date.now().toString(36)}`;

    // Auto-assign the Free Trial plan to new tenants
    const freeTrial = await prisma.billingPlan.findFirst({
      where: { is_free_trial: true, is_active: true },
    });

    const tenant = await prisma.tenant.create({
      data: {
        product_id: product.id,
        name: company,
        slug: tenantSlug,
        employee_count: typeof number_of_employees === 'number' ? number_of_employees : undefined,
        contact_email: encryptPII(email),
        contact_email_hash: email_hash,
        created_by: 'self_signup',
        ...(freeTrial ? { plan_id: freeTrial.id, trial_started_at: new Date() } : {}),
      },
    });

    const password_hash = await bcrypt.hash(password, 10);
    const fullName = `${first_name} ${last_name}`.trim();

    // Signup always gets tenant_admin role
    const roleRecord = await prisma.userRole.upsert({
      where: { name: 'tenant_admin' },
      update: {},
      create: { name: 'tenant_admin', label: 'Tenant Admin' },
    });

    const user = await prisma.user.create({
      data: {
        tenant_id: tenant.id,
        email: encryptPII(email),
        email_hash,
        password_hash,
        first_name: encryptPII(first_name),
        last_name: encryptPII(last_name),
        phone,
        job_title,
        role_id: roleRecord.id, // tenant_admin
      },
    });

    const decryptedEmail = email;
    const decryptedName = fullName;

    res.status(201).json({
      message: 'Account created successfully',
      user: {
        id: user.id,
        email: decryptedEmail,
        name: decryptedName,
        role: roleRecord.name,
        tenant_id: user.tenant_id,
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  try {
    const email_hash = hashSearchable(email);
    const user = await prisma.user.findFirst({ where: { email_hash }, include: { roleRef: true } });

    if (!user || !user.password_hash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const decryptedEmail = decryptPII(user.email);

    // First/last name now stored as encrypted PII.
    let decryptedName: string | null = null;
    try {
      if (user.first_name && user.last_name && user.first_name !== user.last_name) {
        const fn = decryptPII(user.first_name);
        const ln = decryptPII(user.last_name);
        decryptedName = `${fn} ${ln}`.trim();
      } else if (user.first_name) {
        decryptedName = decryptPII(user.first_name);
      } else if (user.last_name) {
        decryptedName = decryptPII(user.last_name);
      }
    } catch {
      decryptedName = null;
    }

    const roleName = user.roleRef?.name || 'user';

    // Look up tenant to derive product_id and onboarding step
    let onboarding_step: string | null = null;
    let productIdForToken: string | undefined;
    if (user.tenant_id) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: user.tenant_id },
        select: { onboarding_step: true, name: true, product_id: true },
      });
      if (tenant) {
        onboarding_step = tenant.onboarding_step;
        productIdForToken = tenant.product_id;
      }
    }

    const payload = {
      id: user.id,
      email: decryptedEmail, // put raw email in JWT for client convenience
      role: roleName,
      product_id: productIdForToken,
      tenant_id: user.tenant_id || undefined,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
    const refresh_token = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { last_login_at: new Date() },
    });

    res.status(200).json({
      token,
      refresh_token,
      user: {
        id: user.id,
        email: decryptedEmail,
        name: decryptedName ?? undefined,
        role: roleName,
        product_id: productIdForToken,
        tenant_id: user.tenant_id,
        onboarding_step: onboarding_step ?? undefined,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/auth/refresh
export async function refresh(req: Request, res: Response): Promise<void> {
  const { refresh_token } = req.body || {};
  if (!refresh_token) {
    res.status(400).json({ error: 'refresh_token is required' });
    return;
  }

  try {
    const decoded = jwt.verify(refresh_token, env.JWT_REFRESH_SECRET) as any;

    // Minimal payload re-issue (do not trust client beyond verified token)
    const payload = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      product_id: decoded.product_id,
      tenant_id: decoded.tenant_id || undefined,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
    res.status(200).json({ token });
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

// POST /api/auth/logout
export async function logout(req: Request, res: Response): Promise<void> {
  // Stateless JWT logout: client deletes tokens
  res.status(200).json({ message: 'ok' });
}
