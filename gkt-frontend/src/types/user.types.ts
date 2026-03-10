export enum Role {
  SUPER_ADMIN = 'super_admin',
  TENANT_ADMIN = 'tenant_admin',
  L1_AGENT = 'l1_agent',
  L2_AGENT = 'l2_agent',
  L3_AGENT = 'l3_agent',
  USER = 'user',
}
export enum UserType { TENANT_USER = 'tenant_user', INDIVIDUAL = 'individual' }

export interface User {
  id: string;
  product_id: string;
  tenant_id?: string | null;
  email: string;
  name: string;
  role: Role;
  user_type: UserType;
  avatar_base64?: string | null;
  is_active: boolean;
  is_vip: boolean;
}
