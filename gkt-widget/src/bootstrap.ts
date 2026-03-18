import { WidgetConfig } from './types/widget.types';

/**
 * Validates required data-* attributes and returns config object.
 */
export function bootstrap(scriptTag: HTMLScriptElement): WidgetConfig | null {
  const productId = scriptTag.getAttribute('data-product-id');
  const productName = scriptTag.getAttribute('data-product-name');
  const userId = scriptTag.getAttribute('data-user-id');
  const userName = scriptTag.getAttribute('data-user-name');
  const userEmail = scriptTag.getAttribute('data-user-email');
  const userType = scriptTag.getAttribute('data-user-type');

  if (!productId || !userId || !userEmail || !userType) {
    console.error('[GKT Widget] Missing required data attributes: data-product-id, data-user-id, data-user-email, data-user-type');
    return null;
  }

  return {
    productId,
    productName: productName || '',
    tenantId: scriptTag.getAttribute('data-tenant-id') || undefined,
    tenantName: scriptTag.getAttribute('data-tenant-name') || undefined,
    userId,
    userName: userName || '',
    userEmail,
    userType: userType as 'tenant_user' | 'individual',
    courseId: scriptTag.getAttribute('data-course-id') || undefined,
    courseName: scriptTag.getAttribute('data-course-name') || undefined,
    sessionId: scriptTag.getAttribute('data-session-id') || undefined,
    appSessionId: scriptTag.getAttribute('data-app-session-id') || undefined,
  };
}
