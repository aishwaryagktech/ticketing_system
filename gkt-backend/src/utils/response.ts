import { Response } from 'express';

export function success(res: Response, data: any, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data });
}

export function created(res: Response, data: any): void {
  res.status(201).json({ success: true, data });
}

export function error(res: Response, message: string, statusCode = 400): void {
  res.status(statusCode).json({ success: false, error: message });
}

export function paginated(res: Response, data: any[], nextCursor?: string, total?: number): void {
  res.json({
    success: true,
    data,
    pagination: {
      nextCursor,
      hasMore: !!nextCursor,
      total,
    },
  });
}
