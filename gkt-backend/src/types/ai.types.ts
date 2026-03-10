export interface ClassifyResult {
  category: string;
  sub_category?: string;
  priority: string;
  confidence: number;
}

export interface SentimentResult {
  sentiment: string;
  trend?: string;
  score: number;
}

export interface DuplicateResult {
  is_duplicate: boolean;
  matches: Array<{
    ticket_id: string;
    ticket_number: string;
    score: number;
  }>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIAdapter {
  classify(text: string): Promise<ClassifyResult>;
  detectSentiment(text: string): Promise<SentimentResult>;
  suggestReply(ticket: any, history: any[]): Promise<string[]>;
  checkDuplicate(text: string, productId: string): Promise<DuplicateResult>;
  chat(messages: ChatMessage[], kbContext: string): Promise<string>;
  embed(text: string): Promise<number[]>;
}
