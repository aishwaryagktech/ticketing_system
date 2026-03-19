/**
 * Generate embeddings (OpenAI) and index KB documents in Qdrant for RAG.
 * Uses QDRANT_URL and QDRANT_API_KEY from env; OpenAI for embeddings.
 *
 * agent_level: 'l0' | 'l1' — each KB doc is tagged with the agent it belongs to.
 * L0 bot searches only L0 docs; L1 bot searches only L1 docs (strict separation).
 */

import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { qdrantClient } from '../db/qdrant';
import { env } from '../config/env';

const KB_COLLECTION = 'kb_docs';
const EMBEDDING_MODEL = 'text-embedding-3-small';
const VECTOR_SIZE = 1536;
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!env.OPENAI_API_KEY) return null;
  if (!openai) openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return openai;
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return chunks;
  while (start < cleaned.length) {
    let end = Math.min(start + CHUNK_SIZE, cleaned.length);
    if (end < cleaned.length) {
      const nextNewline = cleaned.indexOf('\n', end);
      if (nextNewline !== -1 && nextNewline - start < CHUNK_SIZE + 200) {
        end = nextNewline + 1;
      } else {
        const lastSpace = cleaned.lastIndexOf(' ', end);
        if (lastSpace > start) end = lastSpace + 1;
      }
    }
    chunks.push(cleaned.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
    if (start >= cleaned.length) break;
    if (chunks.length >= 100) break;
  }
  return chunks.filter(Boolean);
}

async function ensureCollection(): Promise<void> {
  const { collections } = await qdrantClient.getCollections();
  const exists = collections?.some((c: { name?: string }) => c.name === KB_COLLECTION);
  if (!exists) {
    await qdrantClient.createCollection(KB_COLLECTION, {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    });
  }

  // Qdrant requires payload indices for filtered search
  // (otherwise /points/search with filter returns 400).
  // These may already exist; ignore "already exists" errors.
  const ensureIndex = async (field_name: string, field_schema: 'keyword' | 'uuid') => {
    try {
      await qdrantClient.createPayloadIndex(KB_COLLECTION, { field_name, field_schema });
    } catch (e: any) {
      const msg = String(e?.data?.status?.error || e?.message || '');
      if (msg.toLowerCase().includes('already exists')) return;
      if (e?.status === 409) return;
      console.warn(`EmbeddingService: createPayloadIndex(${field_name}) skipped:`, msg || e);
    }
  };

  await ensureIndex('tenant_id', 'uuid');
  await ensureIndex('tenant_product_id', 'uuid');
  await ensureIndex('product_id', 'uuid');
  await ensureIndex('agent_level', 'keyword');
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const client = getOpenAI();
  if (!client) throw new Error('OPENAI_API_KEY not set');
  const res = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return res.data.map((d) => d.embedding);
}

export interface IndexKbDocumentParams {
  kb_source_id: string;
  tenant_id: string | null;
  product_id: string;
  tenant_product_id: string | null;
  title: string;
  content_text: string;
  agent_level?: 'l0' | 'l1'; // which AI agent this KB belongs to (default: 'l0')
}

/**
 * Index a KB document (e.g. after upload) in Qdrant for RAG.
 * Chunks the text, generates embeddings, and upserts points.
 */
export async function indexKbDocument(params: IndexKbDocumentParams): Promise<void> {
  const { kb_source_id, tenant_id, product_id, tenant_product_id, title, content_text, agent_level = 'l0' } = params;
  if (!content_text || content_text.length < 50) return;

  const client = getOpenAI();
  if (!client) {
    console.warn('EmbeddingService: OPENAI_API_KEY not set, skipping Qdrant index');
    return;
  }

  try {
    await ensureCollection();
  } catch (e) {
    console.error('EmbeddingService: ensureCollection failed', e);
    return;
  }

  const chunks = chunkText(content_text);
  if (chunks.length === 0) return;

  let vectors: number[][];
  try {
    vectors = await embedTexts(chunks);
  } catch (e: unknown) {
    const err = e as { status?: number; code?: string; message?: string };
    if (err?.status === 401 || err?.code === 'invalid_api_key') {
      console.warn('EmbeddingService: OpenAI API key invalid or missing. Set OPENAI_API_KEY in .env for RAG indexing.');
    } else {
      console.error('EmbeddingService: embed failed', e);
    }
    return;
  }

  if (vectors.length !== chunks.length) {
    console.warn('EmbeddingService: embedding count mismatch');
    return;
  }

  try {
    await qdrantClient.delete(KB_COLLECTION, {
      filter: {
        must: [{ key: 'kb_source_id', match: { value: kb_source_id } }],
      },
    });
  } catch (e) {
    // ignore if no points
  }

  const points = chunks.map((text, i) => ({
    id: uuidv4(),
    vector: vectors[i],
    payload: {
      kb_source_id,
      // Keep legacy fields for compatibility
      tenant_id: tenant_id ?? undefined,
      product_id,
      tenant_product_id: tenant_product_id || undefined,
      agent_level, // 'l0' | 'l1' — strict per-agent KB filter
      title: title?.slice(0, 500),
      text: text.slice(0, 2000),
      chunk_index: i,
    },
  }));

  try {
    await qdrantClient.upsert(KB_COLLECTION, { points });
  } catch (e) {
    console.error('EmbeddingService: upsert failed', e);
    throw e;
  }
}

/**
 * Remove all points for a KB source (e.g. when source is deleted).
 */
export async function deleteKbDocumentFromQdrant(kb_source_id: string): Promise<void> {
  try {
    await qdrantClient.delete(KB_COLLECTION, {
      filter: {
        must: [{ key: 'kb_source_id', match: { value: kb_source_id } }],
      },
    });
  } catch (e) {
    console.error('EmbeddingService: delete failed', e);
  }
}

/**
 * Search KB by query text for RAG. Returns scored points with payload.
 *
 * agent_level: 'l0' | 'l1' — strictly filters to only that agent's KB docs.
 * L0 bot always passes 'l0'; L1 bot always passes 'l1'.
 */
export async function searchKb(
  queryEmbedding: number[],
  options: { limit?: number; tenant_product_id?: string; agent_level?: 'l0' | 'l1' } = {}
): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
  const limit = options.limit ?? 10;
  const must: Array<{ key: string; match: { value: string } }> = [];

  if (options.tenant_product_id) {
    must.push({ key: 'tenant_product_id', match: { value: options.tenant_product_id } });
  }
  if (options.agent_level) {
    must.push({ key: 'agent_level', match: { value: options.agent_level } });
  }

  const results = await qdrantClient.search(KB_COLLECTION, {
    vector: queryEmbedding,
    limit,
    with_payload: true,
    ...(must.length > 0 ? { filter: { must } } : {}),
  });

  return (results ?? []).map((p) => ({
    id: String(p.id),
    score: p.score ?? 0,
    payload: (p.payload as Record<string, unknown>) ?? {},
  }));
}

/**
 * Embed a single query string for search.
 */
export async function embedQuery(query: string): Promise<number[]> {
  const client = getOpenAI();
  if (!client) throw new Error('OPENAI_API_KEY not set');
  const res = await client.embeddings.create({ model: EMBEDDING_MODEL, input: query });
  return res.data[0]?.embedding ?? [];
}
