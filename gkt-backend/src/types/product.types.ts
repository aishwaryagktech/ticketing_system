export interface Product {
  id: string;
  name: string;
  slug: string;
  logo_base64?: string | null;
  primary_color: string;
  email_sender_name?: string | null;
  email_sender_address?: string | null;
  api_key_hash?: string | null;
  plan_id: string;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface Tenant {
  id: string;
  product_id: string;
  name: string;
  slug: string;
  logo_base64?: string | null;
  contact_email?: string | null;
  is_active: boolean;
  created_by: string;
  created_at: Date;
}
