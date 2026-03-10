export interface WidgetConfig {
  productId: string;
  productName: string;
  tenantId?: string;
  tenantName?: string;
  userId: string;
  userName: string;
  userEmail: string;
  userType: 'tenant_user' | 'individual';
  courseId?: string;
  courseName?: string;
  sessionId?: string;
}
