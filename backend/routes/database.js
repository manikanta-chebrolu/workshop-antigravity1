/**
 * Backend Database API Routes
 * Endpoints for managing Supabase database status, connection testing, and chat sync.
 */

const supabaseService = require('../services/supabase');

function handleDatabaseRoutes(req, res, pathname) {
  // GET /api/database/status
  if (pathname === '/api/database/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(supabaseService.getStatus()));
    return true;
  }

  // POST /api/database/test
  if (pathname === '/api/database/test' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        // If temporary test credentials provided
        if (payload.url && payload.key) {
          supabaseService.initClient(payload.url, payload.key);
        }
        const result = await supabaseService.testConnection();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });
    return true;
  }

  // GET /api/database/chats
  if (pathname === '/api/database/chats' && req.method === 'GET') {
    (async () => {
      try {
        const chats = await supabaseService.getChats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, chats }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    })();
    return true;
  }

  // POST /api/database/chats
  if (pathname === '/api/database/chats' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const saved = await supabaseService.saveChat(payload.chat);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: Boolean(saved), chat: saved }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return true;
  }

  // DELETE /api/database/chats/:id
  if (pathname.startsWith('/api/database/chats/') && req.method === 'DELETE') {
    const chatId = pathname.split('/').pop();
    (async () => {
      try {
        const ok = await supabaseService.deleteChat(chatId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: ok }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    })();
    return true;
  }

  return false;
}

module.exports = { handleDatabaseRoutes };
