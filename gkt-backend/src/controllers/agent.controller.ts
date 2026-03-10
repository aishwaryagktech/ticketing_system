import { Request, Response } from 'express';

// GET /api/agents
export async function listAgents(req: Request, res: Response): Promise<void> {
  // TODO: Implement agent roster listing
  res.status(501).json({ message: 'Not implemented' });
}

// POST /api/agents/invite
export async function inviteAgent(req: Request, res: Response): Promise<void> {
  // TODO: Implement agent invitation
  res.status(501).json({ message: 'Not implemented' });
}

// PATCH /api/agents/:id
export async function updateAgent(req: Request, res: Response): Promise<void> {
  // TODO: Implement agent update
  res.status(501).json({ message: 'Not implemented' });
}

// PATCH /api/agents/:id/deactivate
export async function deactivateAgent(req: Request, res: Response): Promise<void> {
  // TODO: Implement agent deactivation
  res.status(501).json({ message: 'Not implemented' });
}
