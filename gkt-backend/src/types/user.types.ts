export enum Role {
  STUDENT = 'student',
  FACULTY = 'faculty',
  L1_AGENT = 'l1_agent',
  L2_AGENT = 'l2_agent',
  PRODUCT_ADMIN = 'product_admin',
  SUPER_ADMIN = 'super_admin',
}

export enum UserType {
  TENANT_USER = 'tenant_user',
  INDIVIDUAL = 'individual',
}

export interface User {
  id: string;
  product_id: string;
  tenant_id?: string | null;
  email: string;
  password_hash?: string | null;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  job_title?: string | null;
  role: Role;
  user_type: UserType;
  department?: string | null;
  avatar_base64?: string | null;
  active_model?: string | null;
  notification_prefs: Record<string, any>;
  theme: string;
  is_active: boolean;
  is_vip: boolean;
  last_login_at?: Date | null;
  created_at: Date;
}
