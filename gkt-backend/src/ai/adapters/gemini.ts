import { AIAdapter, ClassifyResult, SentimentResult, DuplicateResult, ChatMessage } from '../../types/ai.types';

export class GeminiAdapter implements AIAdapter {
  constructor(private apiKey: string, private model: string) {}

  async classify(text: string): Promise<ClassifyResult> {
    throw new Error('Not implemented');
  }
  async detectSentiment(text: string): Promise<SentimentResult> {
    throw new Error('Not implemented');
  }
  async suggestReply(ticket: any, history: any[]): Promise<string[]> {
    throw new Error('Not implemented');
  }
  async checkDuplicate(text: string, productId: string): Promise<DuplicateResult> {
    throw new Error('Not implemented');
  }
  async chat(messages: ChatMessage[], kbContext: string): Promise<string> {
    throw new Error('Not implemented');
  }
  async embed(text: string): Promise<number[]> {
    throw new Error('Not implemented');
  }
}
