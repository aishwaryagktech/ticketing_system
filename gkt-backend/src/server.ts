import http from 'http';
import app from './app';
import { initSocketServer } from './config/socket';
import { connectMongo } from './db/mongo';
import { registerCronJobs } from './cron';
import { env } from './config/env';

const PORT = env.PORT || 5000;

async function bootstrap() {
  // Connect to MongoDB
  await connectMongo();

  // Create HTTP server
  const server = http.createServer(app);

  // Initialise Socket.io
  initSocketServer(server);

  // Register cron jobs
  registerCronJobs();

  server.listen(PORT, () => {
    console.log(`🚀 GKT Backend running on http://localhost:${PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
  });
}

bootstrap().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});
