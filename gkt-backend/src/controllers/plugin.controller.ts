import { Request, Response } from 'express';

export async function getEmbedCodes(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function getPluginConfig(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
export async function updatePluginConfig(req: Request, res: Response): Promise<void> {
  res.status(501).json({ message: 'Not implemented' });
}
