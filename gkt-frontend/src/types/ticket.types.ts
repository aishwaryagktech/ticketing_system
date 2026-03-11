// Mirrors backend ticket types
export enum TicketStatus { NEW = 'new', OPEN = 'open', IN_PROGRESS = 'in_progress', PENDING_USER = 'pending_user', RESOLVED = 'resolved', CLOSED = 'closed' }
export enum Priority { P1 = 'p1', P2 = 'p2', P3 = 'p3', P4 = 'p4' }
export enum TicketSource { WEB_FORM = 'web_form', WIDGET = 'widget', EMAIL = 'email', API = 'api', BOT_HANDOFF = 'bot_handoff' }
export enum Sentiment { POSITIVE = 'positive', NEUTRAL = 'neutral', FRUSTRATED = 'frustrated', CRITICAL = 'critical' }

export interface Ticket {
  id: string;
  ticket_number: string;
  product_id: string;
  tenant_product_id?: string | null;
  tenant_id?: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  source: TicketSource;
  category?: string | null;
  sentiment?: Sentiment | null;
  assigned_to?: string | null;
  sla_breached: boolean;
  escalation_level: number;
  csat_score?: number | null;
  created_at: string;
  updated_at: string;
}
