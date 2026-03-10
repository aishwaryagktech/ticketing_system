// All ticket-related types — source of truth

export enum TicketStatus {
  NEW = 'new',
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  PENDING_USER = 'pending_user',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum Priority {
  P1 = 'p1',
  P2 = 'p2',
  P3 = 'p3',
  P4 = 'p4',
}

export enum TicketSource {
  WEB_FORM = 'web_form',
  WIDGET = 'widget',
  EMAIL = 'email',
  API = 'api',
  BOT_HANDOFF = 'bot_handoff',
}

export enum Sentiment {
  POSITIVE = 'positive',
  NEUTRAL = 'neutral',
  FRUSTRATED = 'frustrated',
  CRITICAL = 'critical',
}

export interface Ticket {
  id: string;
  ticket_number: string;
  product_id: string;
  tenant_id?: string | null;
  created_by: string;
  assigned_to?: string | null;
  parent_ticket_id?: string | null;
  subject: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  source: TicketSource;
  user_type: string;
  category?: string | null;
  sub_category?: string | null;
  department?: string | null;
  ai_confidence?: number | null;
  sentiment?: Sentiment | null;
  sentiment_trend?: string | null;
  is_vip: boolean;
  sla_deadline?: Date | null;
  sla_paused_at?: Date | null;
  sla_paused_duration: number;
  sla_breached: boolean;
  escalation_level: number;
  resolved_at?: Date | null;
  closed_at?: Date | null;
  reopen_deadline?: Date | null;
  csat_score?: number | null;
  csat_comment?: string | null;
  course_id?: string | null;
  course_name?: string | null;
  session_id?: string | null;
  created_at: Date;
  updated_at: Date;
}
