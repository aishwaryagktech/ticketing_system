import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';

// Route imports
import authRoutes from './routes/auth.routes';
import ticketRoutes from './routes/ticket.routes';
import commentRoutes from './routes/comment.routes';
import botRoutes from './routes/bot.routes';
import kbRoutes from './routes/kb.routes';
import agentRoutes from './routes/agent.routes';
import notificationRoutes from './routes/notification.routes';
import uploadRoutes from './routes/upload.routes';
import productAdminRoutes from './routes/product-admin.routes';
import superAdminRoutes from './routes/super-admin.routes';
import analyticsRoutes from './routes/analytics.routes';
import billingRoutes from './routes/billing.routes';
import onboardingRoutes from './routes/onboarding.routes';
import brandingPublicRoutes from './routes/branding-public.routes';
import pluginRoutes from './routes/plugin.routes';
import publicRoutes from './routes/public.routes';
import webhookRoutes from './routes/webhook.routes';
import widgetPublicRoutes from './routes/widget-public.routes';
import gmailRoutes from './routes/gmail.routes';

const app = express();

// ---------------------------------------------------------------------------
// Global Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3001',
    process.env.WIDGET_URL || 'http://localhost:4000',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/tickets', commentRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/kb', kbRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/admin', productAdminRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/plugin', pluginRoutes);
app.use('/api/v1', publicRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/public-config', brandingPublicRoutes);
app.use('/api/widget', widgetPublicRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/gmail', gmailRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Error Handler (must be last)
// ---------------------------------------------------------------------------
app.use(errorHandler);

export default app;
