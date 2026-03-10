import cron from 'node-cron';
import { runSLACron } from './sla.cron';
import { runEscalationCron } from './escalation.cron';

export function registerCronJobs(): void {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Running SLA cron...');
    await runSLACron();
  });

  cron.schedule('*/5 * * * *', async () => {
    console.log('⏰ Running Escalation cron...');
    await runEscalationCron();
  });

  console.log('✅ Cron jobs registered');
}
