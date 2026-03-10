import { Request, Response } from 'express';

// Simple placeholder chatbot for L0 bot demo.
// In the future this should use KB context + LLM provider configs.

// POST /api/bot/chat
export async function chat(req: Request, res: Response): Promise<void> {
  const { message, session_id, tenant_id, product_id } = req.body || {};
  const text = typeof message === 'string' && message.trim() ? message.trim() : '';

  if (!text) {
    res.status(400).json({ error: 'message required' });
    return;
  }

  // Very simple echo-style bot so the widget and portal chat work end-to-end.
  const reply =
    `I’m your ReWire support bot.\n\n` +
    `You said: "${text}".\n\n` +
    `This is a demo response. In the full version I will use your tenant-product knowledge base, ` +
    `plans, and routing rules to answer questions and decide when to create or escalate tickets.`;

  res.json({
    reply,
    session_id: session_id || null,
    tenant_id: tenant_id || null,
    product_id: product_id || null,
  });
}

// POST /api/bot/handoff
export async function handoff(req: Request, res: Response): Promise<void> {
  // Stub: in the full system this would create a ticket and associate the chat transcript.
  res.json({ message: 'Handoff stub: in production this would create a ticket and route to an agent.' });
}
