/**
 * Parse "Chat transcript" from ticket description into separate User/Bot messages
 * for conversation-style display in UI.
 */
const CHAT_TRANSCRIPT_MARKER = '\n---\nChat transcript\n---\n';

export type ParsedTranscriptMessage = { from: 'user' | 'bot'; text: string };

export function parseTranscriptFromDescription(description: string): ParsedTranscriptMessage[] {
  if (!description || typeof description !== 'string') return [];
  const idx = description.indexOf(CHAT_TRANSCRIPT_MARKER);
  if (idx < 0) return [];
  const transcript = description.slice(idx + CHAT_TRANSCRIPT_MARKER.length).trim();
  if (!transcript) return [];

  const lines = transcript.split('\n');
  const messages: ParsedTranscriptMessage[] = [];
  let current: ParsedTranscriptMessage | null = null;

  for (const line of lines) {
    if (line.startsWith('User: ')) {
      if (current) messages.push(current);
      current = { from: 'user', text: line.slice(6).trim() };
    } else if (line.startsWith('Bot: ')) {
      if (current) messages.push(current);
      current = { from: 'bot', text: line.slice(5).trim() };
    } else if (current) {
      current.text += '\n' + line;
    }
  }
  if (current) messages.push(current);
  return messages;
}
