import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  WIDGET_URL: z.string().default('http://localhost:4000'),
  PLATFORM_DOMAIN: z.string().default('gkt.app'),

  DATABASE_URL: z.string(),
  MONGODB_URI: z.string(),
  QDRANT_URL: z.string().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().optional(),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  ENCRYPTION_KEY_V1: z.string().min(32),
  ENCRYPTION_KEY_V2: z.string().min(32).optional(),
  CURRENT_KEY_VERSION: z.coerce.number().default(1),
  HASH_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),

  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().optional(),
  MAILGUN_API_KEY: z.string().optional(),
  MAILGUN_DOMAIN: z.string().optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),

  MAX_FILE_SIZE_BYTES: z.coerce.number().default(5242880),
  MAX_ATTACHMENTS_PER_TICKET: z.coerce.number().default(3),
  ALLOWED_FILE_TYPES: z.string().default('jpg,jpeg,png,gif,webp,pdf,txt,log,csv'),
});

export const env = envSchema.parse(process.env);
