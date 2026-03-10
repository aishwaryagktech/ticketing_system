import { Request, Response } from 'express';

// GET /api/tickets/:id/comments
export async function listComments(req: Request, res: Response): Promise<void> {
  // TODO: Implement comment listing for a ticket
  res.status(501).json({ message: 'Not implemented' });
}

// POST /api/tickets/:id/comments
export async function createComment(req: Request, res: Response): Promise<void> {
  // TODO: Implement comment creation (public reply or internal note)
  res.status(501).json({ message: 'Not implemented' });
}
