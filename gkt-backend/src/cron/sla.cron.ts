import { markBreachedTickets } from '../services/sla.service';

/**
 * SLA Cron — runs every 5 minutes
 * Marks tickets as sla_breached when sla_deadline has passed and status is not resolved/closed.
 * (75% warning and notifications can be added later.)
 */
export async function runSLACron(): Promise<void> {
  try {
    const count = await markBreachedTickets();
    if (count > 0) {
      console.log(`SLA cron: marked ${count} ticket(s) as breached`);
    }
  } catch (e) {
    console.error('SLA cron error:', e);
  }
}
