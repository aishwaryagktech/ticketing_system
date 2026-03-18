const http = require('http');
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'flowpay.log');
const PORT = 4000;

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

// ── Write a line to the log file ──────────────────────────────
function writeLine(line) {
  fs.appendFileSync(LOG_FILE, line + '\n', 'utf8');
}

// ── Format a single log entry as plain text ───────────────────
function formatEntry(entry) {
  const level = (entry.level || 'info').toUpperCase().padEnd(7);
  const time  = entry.time || new Date().toISOString();
  const msg   = entry.message || entry.msg || JSON.stringify(entry);
  return `[${time}] [${level}] ${msg}`;
}

// ── HTTP Server ───────────────────────────────────────────────
const server = http.createServer((req, res) => {

  // Allow CORS so the browser HTML file can POST here, and GKT backend can GET logs
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);

        // ── Single log entry: { level, message, time, ... }
        if (payload.message || payload.msg) {
          const line = formatEntry(payload);
          writeLine(line);
          console.log(line);

        // ── Batch of log entries: { logs: [...], user_id, issue_id, ... }
        } else if (Array.isArray(payload.logs)) {
          writeLine(`\n${'─'.repeat(60)}`);
          writeLine(`SESSION  : ${payload.session_id || 'unknown'}`);
          writeLine(`USER     : ${payload.user_id || 'unknown'} (${payload.user_email || ''})`);
          writeLine(`ISSUE    : ${(payload.triggered_issues || []).join(', ') || 'n/a'}`);
          writeLine(`ERRORS   : ${payload.error_count || 0}`);
          writeLine(`EXPORTED : ${payload.exported_at || new Date().toISOString()}`);
          writeLine(`${'─'.repeat(60)}`);
          payload.logs.forEach(entry => {
            const line = formatEntry(entry);
            writeLine(line);
            console.log(line);
          });
          writeLine(`${'─'.repeat(60)}\n`);

        // ── Action event: { action, label, ts }
        } else if (payload.action) {
          const line = formatEntry({
            time: payload.ts || new Date().toISOString(),
            level: 'action',
            message: [
              `USER_ACTION`,
              `action=${payload.action}`,
              `label=${payload.label || 'n/a'}`,
              `user=${payload.user_id || 'usr_48291'}`,
              `session=${payload.session_id || 'n/a'}`,
              `page=${payload.page || 'dashboard'}`,
              `component=${payload.component || 'n/a'}`,
            ].join(' | ')
          });
          writeLine(line);
          console.log(line);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));

      } catch (e) {
        console.error('Parse error:', e.message);
        res.writeHead(400); res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }

  // ── GET /logs — view the current log file contents
  if (req.method === 'GET' && req.url === '/logs') {
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(content);
    } else {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('No logs yet.');
    }
    return;
  }

  // ── GET /logs/:user_id?session_id=... — filter logs for a specific user/session
  if (req.method === 'GET' && req.url.startsWith('/logs/')) {
    try {
      const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
      const userId = decodeURIComponent(parsedUrl.pathname.split('/')[2] || '');
      const sessionId = parsedUrl.searchParams.get('session_id') || '';

      if (!userId) {
        res.writeHead(400); res.end('user_id required'); return;
      }

      const content = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '';
      if (!content.trim()) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('No logs yet.');
        return;
      }

      // Split into blocks separated by the ─── dividers (issue snapshots) + individual lines
      const lines = content.split('\n');
      const filtered = lines.filter(line => {
        const matchesUser    = line.includes(`user=${userId}`) || line.includes(`USER     : ${userId}`);
        const matchesSession = sessionId
          ? line.includes(`session=${sessionId}`) || line.includes(`SESSION  : ${sessionId}`)
          : false;
        // Include divider lines (─) when we're showing snapshot blocks — keep them for readability
        const isDivider = /^─+$/.test(line.trim());
        return matchesUser || matchesSession || isDivider;
      });

      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(filtered.join('\n') || 'No logs for this user.');
    } catch (e) {
      res.writeHead(500); res.end('Internal error');
    }
    return;
  }

  // ── GET /clear — wipe the log file
  if (req.method === 'GET' && req.url === '/clear') {
    fs.writeFileSync(LOG_FILE, '', 'utf8');
    res.writeHead(200); res.end('Log file cleared.');
    return;
  }

  res.writeHead(404); res.end('Not found.');
});

server.listen(PORT, () => {
  console.log(`\n✅ FlowPay Logger running on http://localhost:${PORT}`);
  console.log(`   POST /log       — receive logs from browser`);
  console.log(`   GET  /logs      — view current log file`);
  console.log(`   GET  /clear     — wipe log file`);
  console.log(`   Log file: ${LOG_FILE}\n`);
});
