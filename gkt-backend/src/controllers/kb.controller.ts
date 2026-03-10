import { Request, Response } from 'express';

// GET /api/kb/search
export async function search(req: Request, res: Response): Promise<void> {
  // TODO: Implement semantic KB search via Qdrant
  res.status(501).json({ message: 'Not implemented' });
}

// GET /api/kb/suggest
export async function suggest(req: Request, res: Response): Promise<void> {
  // TODO: Implement inline KB suggestions
  res.status(501).json({ message: 'Not implemented' });
}

// GET /api/kb/articles
export async function listArticles(req: Request, res: Response): Promise<void> {
  // TODO: Implement article listing with filters
  res.status(501).json({ message: 'Not implemented' });
}

// GET /api/kb/articles/:id
export async function getArticle(req: Request, res: Response): Promise<void> {
  // TODO: Implement get single article
  res.status(501).json({ message: 'Not implemented' });
}

// POST /api/kb/articles
export async function createArticle(req: Request, res: Response): Promise<void> {
  // TODO: Implement article creation + embedding
  res.status(501).json({ message: 'Not implemented' });
}

// PATCH /api/kb/articles/:id
export async function updateArticle(req: Request, res: Response): Promise<void> {
  // TODO: Implement article update
  res.status(501).json({ message: 'Not implemented' });
}

// DELETE /api/kb/articles/:id
export async function deleteArticle(req: Request, res: Response): Promise<void> {
  // TODO: Implement article deletion
  res.status(501).json({ message: 'Not implemented' });
}
