const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src', 'controllers', 'bot.controller.ts');
let content = fs.readFileSync(file, 'utf8');

// Ensure we don't append it twice
if (content.includes('export async function chatL1')) {
  console.log('chatL1 already exists');
  process.exit(0);
}

// Find the start and end of chat()
const startIdx = content.indexOf('export async function chat(req: Request, res: Response): Promise<void> {');
// The chat function ends with: res.json({ reply, session_id: sessionId });\n}
const endString = 'res.json({ reply, session_id: sessionId });\n}';
const endIdx = content.indexOf(endString, startIdx) + endString.length;

let chatCode = content.substring(startIdx, endIdx);

// Rename function
chatCode = chatCode.replace('export async function chat(', 'export async function chatL1(');

// Update DB selects
chatCode = chatCode.replace('l0_provider: true, l0_model: true', 'l1_provider: true, l1_model: true');

// Update variable lookups
chatCode = chatCode.replace('tp?.l0_provider', 'tp?.l1_provider');
chatCode = chatCode.replace('tp?.l0_model', 'tp?.l1_model');

// Update searchKb
chatCode = chatCode.replace("agent_level: 'l0'", "agent_level: 'l1'");
// If it didn't have agent_level yet for some reason
if (!chatCode.includes("agent_level: 'l1'")) {
  chatCode = chatCode.replace('limit: 5, tenant_product_id', "limit: 5, tenant_product_id, agent_level: 'l1'");
}

// Update error string for invalid key
chatCode = chatCode.replace('bot chat error:', 'bot chatL1 error:');
chatCode = chatCode.replace(/bot chat: l0_provider=/g, 'bot chatL1: l1_provider=');

content = content + '\n\n// POST /api/bot/l1/chat\n' + chatCode + '\n';
fs.writeFileSync(file, content, 'utf8');
console.log('Appended chatL1');
