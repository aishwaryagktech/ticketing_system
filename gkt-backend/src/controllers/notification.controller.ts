import { Request, Response } from 'express';

// GET /api/notifications
export async function listNotifications(req: Request, res: Response): Promise<void> {
  // TODO: Implement notification listing
  res.status(501).json({ message: 'Not implemented' });
}

// PATCH /api/notifications/:id/read
export async function markRead(req: Request, res: Response): Promise<void> {
  // TODO: Implement mark notification as read
  res.status(501).json({ message: 'Not implemented' });
}

// PATCH /api/notifications/read-all
export async function markAllRead(req: Request, res: Response): Promise<void> {
  // TODO: Implement mark all notifications as read
  res.status(501).json({ message: 'Not implemented' });
}
