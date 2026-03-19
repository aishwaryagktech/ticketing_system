const fs = require('fs');
const file = 'c:/Users/User/Documents/Projects/ticketing_system/ticketing_system/gkt-backend/src/controllers/bot.controller.ts';
let code = fs.readFileSync(file, 'utf8');

const startIdx = code.indexOf('async function runAgentChat(');
const endIdx = code.indexOf('// ─────────────────────────────────────────────────────────────────────────────\r\n//  Public route handlers');
const endIdxFallback = code.indexOf('// ─────────────────────────────────────────────────────────────────────────────\n//  Public route handlers');

const finalEndIdx = endIdx !== -1 ? endIdx : endIdxFallback;

if (startIdx !== -1 && finalEndIdx !== -1) {
    const runAgentChatCode = code.slice(startIdx, finalEndIdx);

    const l0Code = runAgentChatCode.replace(/async function runAgentChat\([\s\S]*?Promise<void> \{/, 'async function runL0Chat(req: Request, res: Response): Promise<void> {\n  const agentLevel = \'l0\';');
    
    // In l1 code, replace agentLevel === 'l0' with false, or just do the same
    const l1Code = runAgentChatCode.replace(/async function runAgentChat\([\s\S]*?Promise<void> \{/, 'async function runL1Chat(req: Request, res: Response): Promise<void> {\n  const agentLevel = \'l1\';');

    let newCode = code.substring(0, startIdx) + l0Code + '\n' + l1Code + '\n' + code.substring(finalEndIdx);
    
    newCode = newCode.replace('return runAgentChat(req, res, \'l0\');', 'return runL0Chat(req, res);');
    newCode = newCode.replace('return runAgentChat(req, res, \'l1\');', 'return runL1Chat(req, res);');

    fs.writeFileSync(file, newCode);
    console.log('Success');
} else {
    console.log('Could not find boundaries', startIdx, endIdx);
}
