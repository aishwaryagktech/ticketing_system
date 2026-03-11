import { AIAdapter } from '../types/ai.types';
import { prisma } from '../db/postgres';
import { decryptPII } from '../utils/encrypt';
import { OpenAIAdapter } from './adapters/openai';
import { env } from '../config/env';

/**
 * Reads the active AI provider from the DB and routes to the correct adapter.
 * Falls back to OPENAI_API_KEY from env if no DB config is present.
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

  // 3. If we found a DB config, route based on provider_name
  if (config) {
    const apiKey = decryptPII(config.api_key_encrypted);
    const models = (config.available_models as string[]) || [];
    const defaultModel = config.default_model || models[0] || 'gpt-4o-mini';

    if (config.provider_name === 'openai') {
      return new OpenAIAdapter(apiKey, defaultModel);
    }

    throw new Error(`AI Adapter for provider ${config.provider_name} is not yet implemented.`);
  }

  // 4. Fallback: use OPENAI_API_KEY from env if no DB config
  if (!env.OPENAI_API_KEY) {
    throw new Error('No active AI provider configured and OPENAI_API_KEY not set.');
  }

  return new OpenAIAdapter(env.OPENAI_API_KEY, 'gpt-4o-mini');
}

