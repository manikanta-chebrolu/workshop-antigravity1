/**
 * Nexus Backend Server
 * Express-free, zero-dependency Node.js HTTP server.
 * Handles API endpoints (/api/chat, /api/health, /api/config, /api/database/*) and serves the frontend client.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const { handleChatRequest } = require('./routes/chat');
const { handleDatabaseRoutes } = require('./routes/database');
const supabaseService = require('./services/supabase');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // =========================================================================
  // BACKEND API ROUTES
  // =========================================================================
  if (pathname === '/api/chat' && req.method === 'POST') {
    handleChatRequest(req, res);
    return;
  }

  // Database endpoints: /api/database/*
  if (pathname.startsWith('/api/database')) {
    const handled = handleDatabaseRoutes(req, res, pathname);
    if (handled) return;
  }

  // Expose safe public frontend configuration parsed from frontend/.env
  if (pathname === '/api/config' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(config.FRONTEND_PUBLIC_CONFIG));
    return;
  }

  if (pathname === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      tier: 'Nexus Backend Server',
      database: {
        provider: 'Supabase PostgreSQL',
        connected: supabaseService.isConfigured()
      },
      environment: config.ENVIRONMENT,
      uptime: Math.floor(process.uptime()),
      timestamp: Date.now()
    }));
    return;
  }

  // =========================================================================
  // FRONTEND STATIC FILE SERVING
  // =========================================================================
  let relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const safePath = path.normalize(path.join(config.FRONTEND_DIR, relPath));

  // Security: block direct browser download of frontend/.env
  if (path.basename(safePath) === '.env') {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: .env files cannot be directly downloaded by the browser.');
    return;
  }

  if (!safePath.startsWith(config.FRONTEND_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<h1>404 Not Found</h1><p>The frontend resource <code>${pathname}</code> was not found.</p>`);
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️  Port ${config.PORT} is already in use by another process.`);
    console.error(`👉 Close the existing server process, or set a different port in backend/.env (e.g. PORT=3001).\n`);
    process.exit(1);
  } else {
    throw err;
  }
});

server.listen(config.PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Nexus Backend Server Running Live`);
  console.log(`🌐 Frontend UI     : http://localhost:${config.PORT}`);
  console.log(`⚡ Backend API     : http://localhost:${config.PORT}/api/chat`);
  console.log(`🔧 Public Config   : http://localhost:${config.PORT}/api/config`);
  console.log(`🗄️ Database Status : ${supabaseService.isConfigured() ? '🟢 Supabase Connected' : '🟡 Supabase Ready (Add keys to backend/.env)'}`);
  console.log(`🩺 Health Check    : http://localhost:${config.PORT}/api/health`);
  console.log(`======================================================\n`);
});

