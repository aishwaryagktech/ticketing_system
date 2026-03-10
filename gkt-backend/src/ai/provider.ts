import { AIAdapter } from '../types/ai.types';
import { prisma } from '../db/postgres';
import { decryptPII } from '../utils/encrypt';

/**
 * Reads the active AI provider from the DB and routes to the correct adapter.
 */
export async function getActiveAdapter(productId: string): Promise<AIAdapter> {
  // 1. Try to find product-specific provider
  let config = await prisma.aiProviderConfig.findFirst({
    where: { product_id: productId, enabled: true },
  });

  // 2. Fallback to platform-wide provider
  if (!config) {
    config = await prisma.aiProviderConfig.findFirst({
      where: { product_id: null, enabled: true },
    });
  }

  if (!config) {
    throw new Error('No active AI provider configured for this product or platform.');
  }

  const apiKey = decryptPII(config.api_key_encrypted);
  const models = config.available_models as string[];
  const defaultModel = config.default_model || models[0];

  // For now, since we haven't implemented the actual adapter files (openai.ts, anthropic.ts, etc.), 
  // we'll just throw a not implemented error, but the key decryption architecture is in place.
  // In a real app, we'd do:
  // if (config.provider_name === 'openai') return new OpenAIAdapter(apiKey, defaultModel);
  // ...

  throw new Error(`AI Adapter for ${config.provider_name} is not yet implemented.`);
}
