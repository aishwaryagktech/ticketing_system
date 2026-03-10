import { Request, Response } from 'express';

export async function handleEmailWebhook(req: Request, res: Response): Promise<void> {
  // TODO: Parse inbound email → create ticket or append reply
  res.status(501).json({ message: 'Not implemented' });
}
export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  // TODO: Handle Stripe subscription events
  res.status(501).json({ message: 'Not implemented' });
}
export async function handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
  // TODO: Handle Razorpay payment events
  res.status(501).json({ message: 'Not implemented' });
}
