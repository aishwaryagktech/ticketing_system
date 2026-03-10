import { Response } from 'express';
import { prisma } from '../db/postgres';
import { ApiKeyRequest } from '../middleware/apiKey';

// GET /api/tickets
export async function listTickets(_req: any, res: Response): Promise<void> {
  // TODO: Implement ticket listing with filters & pagination
  res.status(501).json({ message: 'Not implemented' });
}

// GET /api/tickets/:id
export async function getTicket(_req: any, res: Response): Promise<void> {
  // TODO: Implement get single ticket
  res.status(501).json({ message: 'Not implemented' });
}

// POST /api/tickets
// Used by both authenticated app and public /api/v1/tickets (with API key).
export async function createTicket(req: ApiKeyRequest, res: Response): Promise<void> {
  const productId = (req as ApiKeyRequest).productId;
  if (!productId) {
    res.status(403).json({ error: 'Product context required' });
    return;
  }

  const { name, email, subject, description, priority, source, user_type, tenant_id, product_id: bodyProductId } =
    (req.body as any) || {};

  if (!subject || !description) {
    res.status(400).json({ error: 'subject and description are required' });
    return;
  }

  const ticketNumber =
    'TKT-' +
    Date.now().toString(36).toUpperCase() +
    '-' +
    Math.random().toString(36).slice(2, 6).toUpperCase();

  try {
    const ticket = await prisma.ticket.create({
      data: {
        ticket_number: ticketNumber,
        product_id: bodyProductId || productId,
        subject: String(subject),
        description: String(description),
        created_by: email ? String(email) : 'public',
        priority: (priority as any) || 'p2',
        source: (source as any) || 'web_form',
        user_type: (user_type as any) || 'individual',
        category: null,
        tenant_id: tenant_id ? String(tenant_id) : null,
      },
    });
    res.status(201).json({ ticket_id: ticket.id, ticket_number: ticket.ticket_number });
  } catch (e) {
    console.error('createTicket error:', e);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
}

// PATCH /api/tickets/:id
export async function updateTicket(_req: any, res: Response): Promise<void> {
  // TODO: Implement ticket update
  res.status(501).json({ message: 'Not implemented' });
}

// PATCH /api/tickets/:id/assign
export async function assignTicket(_req: any, res: Response): Promise<void> {
  // TODO: Implement ticket assignment
  res.status(501).json({ message: 'Not implemented' });
}

// PATCH /api/tickets/:id/status
export async function updateStatus(_req: any, res: Response): Promise<void> {
  // TODO: Implement status transitions + SLA clock management
  res.status(501).json({ message: 'Not implemented' });
}

// PATCH /api/tickets/:id/csat
export async function submitCSAT(_req: any, res: Response): Promise<void> {
  // TODO: Implement CSAT score submission
  res.status(501).json({ message: 'Not implemented' });
}
