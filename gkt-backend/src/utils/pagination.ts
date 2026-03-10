export interface PaginationParams {
  cursor?: string;
  limit: number;
  direction?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

export function parsePaginationParams(query: Record<string, any>): PaginationParams {
  return {
    cursor: query.cursor as string | undefined,
    limit: Math.min(parseInt(query.limit as string) || 25, 100),
    direction: (query.direction as 'asc' | 'desc') || 'desc',
  };
}
