import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts PII (like API Keys, sensitive fields) using AES-256-GCM.
 * Supports key rotation via CURRENT_KEY_VERSION.
 */
export function encryptPII(text: string): string {
  if (!text) return text;
  
  const currentVersion = env.CURRENT_KEY_VERSION || 1;
  const rawKey = currentVersion === 1 ? env.ENCRYPTION_KEY_V1 : env.ENCRYPTION_KEY_V2;
  if (!rawKey) throw new Error(`Encryption key V${currentVersion} not configured`);
  
  // Ensure the key is exactly 32 bytes for aes-256
  const key = crypto.createHash('sha256').update(rawKey).digest();
  const iv = crypto.randomBytes(12); // GCM recommended IV size
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  
  // Format: v{version}:{iv}:{authTag}:{ciphertext}
  return `v${currentVersion}:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts PII previously encrypted with encryptPII.
 * Automatically uses the correct key version stored in the payload.
 */
export function decryptPII(encryptedPayload: string): string {
  if (!encryptedPayload || !encryptedPayload.startsWith('v')) return encryptedPayload;
  
  const parts = encryptedPayload.split(':');
  if (parts.length !== 4) return encryptedPayload; // Not a recognized format
  
  const [versionObj, ivHex, authTagHex, encryptedHex] = parts;
  const version = parseInt(versionObj.substring(1), 10);
  const rawKey = version === 1 ? env.ENCRYPTION_KEY_V1 : env.ENCRYPTION_KEY_V2;
  if (!rawKey) throw new Error(`Encryption key V${version} not found for decryption`);
  
  const key = crypto.createHash('sha256').update(rawKey).digest();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  try {
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed for payload:', encryptedPayload);
    // If decryption fails, return original or throw
    throw new Error('Failed to decrypt PII: Invalid key or corrupted data');
  }
}

/**
 * Hashes searchable fields like email addresses.
 * Uses HMAC-SHA256. This should NOT be rotated to keep searches working.
 */
export function hashSearchable(text: string): string {
  if (!text) return text;
  const secret = env.HASH_SECRET;
  if (!secret) throw new Error('HASH_SECRET not configured');
  
  return crypto.createHmac('sha256', secret).update(text.toLowerCase().trim()).digest('hex');
}
