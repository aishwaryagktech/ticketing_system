export interface Product {
  id: string;
  name: string;
  slug: string;
  logo_base64?: string | null;
  primary_color: string;
  is_active: boolean;
}

export interface Tenant {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  is_active: boolean;
}
