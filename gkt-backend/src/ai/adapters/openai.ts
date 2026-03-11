import OpenAI from 'openai';
import { prisma } from '../../db/postgres';
import { AIAdapter, ClassifyResult, SentimentResult, DuplicateResult, ChatMessage } from '../../types/ai.types';

export class OpenAIAdapter implements AIAdapter {
  private client: OpenAI;

  constructor(private apiKey: string, private model: string) {
    this.client = new OpenAI({ apiKey });
  }

  async classify(text: string): Promise<ClassifyResult> {
    const prompt =
      'You are a ticket classifier for an IT support helpdesk.\n' +
      'Given the ticket text, return JSON ONLY with keys: category, sub_category, priority, confidence.\n' +
      'Categories: Technical, Billing, Course, Mentor, Hardware, Access.\n' +
      'Priority: P1, P2, P3, P4 (string).\n' +
      'confidence is a number between 0 and 1.\n' +
      'Example input: "My GPU session crashed mid-training"\n' +
      'Example JSON: {"category":"Technical","sub_category":"GPU Session","priority":"P2","confidence":0.92}\n' +
      'Now classify this ticket text:\n' +
      text;

    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const raw = resp.choices?.[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(raw) as Partial<ClassifyResult>;
      return {
        category: parsed.category || 'Uncategorized',
        sub_category: parsed.sub_category,
        priority: (parsed.priority || 'P3').toLowerCase(),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      };
    } catch {
      return { category: 'Uncategorized', priority: 'p3', confidence: 0.3 };
    }
  }

  async detectSentiment(text: string): Promise<SentimentResult> {
    const prompt =
      'You are a sentiment and urgency detector for support tickets.\n' +
      'For the given text, respond with JSON ONLY: { "sentiment": "positive|neutral|frustrated|critical", "trend": "improving|worsening|stable", "score": numberBetween0And1 }.\n' +
      'Text:\n' +
      text;

    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const raw = resp.choices?.[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(raw) as Partial<SentimentResult>;
      const sentiment = (parsed.sentiment || 'neutral').toLowerCase();
      const trend = parsed.trend || 'stable';
      const score = typeof parsed.score === 'number' ? parsed.score : 0.5;
      return { sentiment, trend, score };
    } catch {
      return { sentiment: 'neutral', trend: 'stable', score: 0.5 };
    }
  }

  async suggestReply(ticket: any, history: any[]): Promise<string[]> {
    const bodyLines: string[] = [];
    bodyLines.push(`Ticket: #${ticket.ticket_number || ticket.id}`);
    bodyLines.push(`Subject: ${ticket.subject}`);
    bodyLines.push(`Description: ${ticket.description}`);
    if (history && history.length) {
      bodyLines.push('\nConversation so far:');
      history.slice(-10).forEach((c: any) => {
        bodyLines.push(`${c.is_internal ? 'Internal' : 'User/Agent'}: ${c.body}`);
      });
    }

    const prompt =
      'You are an L1 support agent drafting replies.\n' +
      'Given the ticket and conversation, suggest 3 short, helpful reply drafts.\n' +
      'Return JSON ONLY: {"replies": ["...", "...", "..."]}.\n\n' +
      bodyLines.join('\n');

    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    const raw = resp.choices?.[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(raw) as { replies?: string[] };
      return Array.isArray(parsed.replies) && parsed.replies.length ? parsed.replies.slice(0, 3) : [];
    } catch {
      return [];
    }
  }

  async checkDuplicate(text: string, productId: string): Promise<DuplicateResult> {
    // Fetch recent tickets for this product (open + recently closed)
    const recent = await prisma.ticket.findMany({
      where: {
        product_id: productId,
        OR: [{ status: 'open' }, { status: 'in_progress' }, { status: 'new_ticket' }, { status: 'resolved' }],
      },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: { id: true, ticket_number: true, subject: true, description: true },
    });

    if (!recent.length) {
      return { is_duplicate: false, matches: [] };
    }

    const list = recent
      .map(
        (t, idx) =>
          `T${idx + 1}: [${t.ticket_number}] ${t.subject}\n${(t.description || '').slice(0, 400)}`
      )
      .join('\n\n');

    const prompt =
      'You are checking if a new ticket is a near-duplicate of existing tickets.\n' +
      'New ticket text:\n' +
      text +
      '\n\nExisting tickets:\n' +
      list +
      '\n\nReturn JSON ONLY: {"is_duplicate": boolean, "matches":[{"ticket_number": string, "score": numberBetween0And1}]}\n' +
      'Only include matches with similarity >= 0.85.';

    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    });

    const raw = resp.choices?.[0]?.message?.content || '{}';
    try {
      const parsed = JSON.parse(raw) as {
        is_duplicate?: boolean;
        matches?: Array<{ ticket_number: string; score: number }>;
      };
      const map: DuplicateResult['matches'] = [];
      for (const m of parsed.matches || []) {
        const found = recent.find((t) => t.ticket_number === m.ticket_number);
        if (found && typeof m.score === 'number') {
          map.push({ ticket_id: found.id, ticket_number: found.ticket_number, score: m.score });
        }
      }
      return { is_duplicate: !!parsed.is_duplicate && map.length > 0, matches: map };
    } catch {
      return { is_duplicate: false, matches: [] };
    }
  }

  async chat(messages: ChatMessage[], kbContext: string): Promise<string> {
    const sys =
      'You are a helpful support assistant. Use the provided knowledge base context when answering.\n' +
      'If the context is insufficient, say that you are not sure and ask a clarifying question.';

    const finalMessages = [
      { role: 'system' as const, content: sys + '\n\nKB Context:\n' + kbContext },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const resp = await this.client.chat.completions.create({
      model: this.model,
      messages: finalMessages,
      temperature: 0.3,
    });

    return resp.choices?.[0]?.message?.content?.trim() || '';
  }

  async embed(text: string): Promise<number[]> {
    const res = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return res.data[0]?.embedding ?? [];
  }
}
