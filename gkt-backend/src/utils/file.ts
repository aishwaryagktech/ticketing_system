import { env } from '../config/env';

const allowedTypes = env.ALLOWED_FILE_TYPES.split(',').map(t => t.trim());
const maxSize = env.MAX_FILE_SIZE_BYTES;

export function validateFile(filename: string, sizeBytes: number): { valid: boolean; error?: string } {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  if (!allowedTypes.includes(ext)) {
    return { valid: false, error: `File type .${ext} is not allowed. Allowed: ${allowedTypes.join(', ')}` };
  }

  if (sizeBytes > maxSize) {
    return { valid: false, error: `File exceeds max size of ${maxSize / (1024 * 1024)}MB` };
  }

  return { valid: true };
}

export function bufferToBase64(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

export function base64ToBuffer(base64: string): Buffer {
  const data = base64.replace(/^data:[^;]+;base64,/, '');
  return Buffer.from(data, 'base64');
}
