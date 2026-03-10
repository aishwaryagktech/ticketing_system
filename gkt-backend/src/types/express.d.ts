// Extend Express Request with user and product_id

declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: string;
      product_id: string;
      tenant_id?: string;
    };
    productId?: string;
  }
}
