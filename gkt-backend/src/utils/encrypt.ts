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
 * If the string is or starts with an encrypted PII payload (v1:... or v2:...), decrypts it for display.
 * Handles full payload or "ENCRYPTED_PAYLOAD has joined the conversation." pattern.
 */
export function decryptForDisplay(str: string | null | undefined): string {
  if (str == null || typeof str !== 'string') return str ?? '';
  const trimmed = str.trim();
  if (!trimmed) return str;
  // Entire string is encrypted payload (vN:iv:tag:ciphertext)
  if (/^v\d+:[a-fA-F0-9]+:[a-fA-F0-9]+:[a-fA-F0-9]+$/.test(trimmed)) {
    try {
      return decryptPII(trimmed);
    } catch {
      return str;
    }
  }
  // Pattern "ENCRYPTED_PAYLOAD has joined the conversation."
  const joinedMatch = trimmed.match(/^(.+?)\s+has joined the conversation\.?$/);
  if (joinedMatch) {
    const prefix = joinedMatch[1].trim();
    if (/^v\d+:[a-fA-F0-9]+:[a-fA-F0-9]+:[a-fA-F0-9]+$/.test(prefix)) {
      try {
        const decrypted = decryptPII(prefix);
        return `${decrypted} has joined the conversation.`;
      } catch {
        return str;
      }
    }
  }
  return str;
}

/**
 * Decrypts for display and returns optional bold prefix (e.g. decrypted name in "X has joined the conversation.").
 */
export function decryptForDisplayWithBold(str: string | null | undefined): { text: string; boldPrefix?: string } {
  const text = decryptForDisplay(str);
  if (!text) return { text: text || '' };
  const joinedMatch = text.match(/^(.+?)\s+has joined the conversation\.?$/);
  if (joinedMatch) {
    const prefix = joinedMatch[1].trim();
    if (prefix) return { text, boldPrefix: prefix };
  }
  return { text };
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
