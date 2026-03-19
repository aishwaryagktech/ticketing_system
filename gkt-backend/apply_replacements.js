const fs = require('fs');

let c = fs.readFileSync('src/controllers/bot.controller.ts', 'utf8');
const r0 = fs.readFileSync('chat_replacement.txt', 'utf8');
const r1 = fs.readFileSync('chatL1_replacement.txt', 'utf8');

const chatStart = c.indexOf('export async function chat(req: Request, res: Response): Promise<void> {');
const chatEnd = c.indexOf('  // ── Build shared context for LLM calls ────────────────────────────────────', chatStart);

if (chatStart > -1 && chatEnd > chatStart) {
  c = c.slice(0, chatStart) + r0 + "\n" + c.slice(chatEnd);
} else {
  console.error("Could not find L0 chat function boundaries.");
}

const l1Start = c.indexOf('export async function chatL1(req: Request, res: Response): Promise<void> {');
const l1End = c.indexOf('  // ── Build shared context for LLM calls ────────────────────────────────────', l1Start);

if (l1Start > -1 && l1End > l1Start) {
  c = c.slice(0, l1Start) + r1 + "\n" + c.slice(l1End);
} else {
  console.error("Could not find L1 chat function boundaries.");
}

// 1. Inject transition_message logic at the end of the shared LLM section
// The response looks like:
// res.json({ reply, session_id: sessionId, handoff });
// We need it to be contextual based on isFirstMessage. However, isFirstMessage is not defined down there.
// We can just add transition_message to session.exchanges === 1

c = c.replace(/res\.json\(\{ reply, session_id: sessionId, handoff \}\);/g, `const payload: any = { reply, session_id: sessionId, handoff };
    if (req.url.includes('/l1') && session.exchanges === 1) {
      payload.transition_message = '— L0 ended. L1 joined —';
    }
    res.json(payload);`);

// 2. Inject L1 system instruction
// We can append it to appLogContext
c = c.replace(/const system = `[\s\S]*?`;/g, (match) => {
  return match + `\n\n  let extraL1Context = '';\n  if (req.url.includes('/l1') && session.exchanges === 0) {\n    extraL1Context = '\\n\\nIMPORTANT SYSTEM INSTRUCTION: The user has just been transferred to you from an automated L0 bot. Review the conversation history above safely. **Your VERY FIRST response MUST begin with a 1-2 sentence summary of their issue to confirm understanding, followed by immediate troubleshooting steps or a resolution effort.** Do not greet them like it\\'s a new conversation, they already spoke to the L0 bot.';\n  }\n`;
});

c = c.replace(/system: system,/g, 'system: system + extraL1Context,');

fs.writeFileSync('src/controllers/bot.controller.ts', c);
console.log("Replacements applied successfully.");
