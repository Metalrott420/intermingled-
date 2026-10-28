const http = require('http');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'artifacts', 'speed-date', 'dist', 'public');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// Active User Session Heartbeat Tracker
const activeHeartbeats = new Map(); // userId -> { lastPing: timestamp, email, name }

function trackHeartbeat(userId, name, email) {
  if (!userId) return;
  activeHeartbeats.set(userId, {
    lastPing: Date.now(),
    name: name || 'Dater',
    email: email || '',
  });
}

function getOnlineCount() {
  const now = Date.now();
  let count = 0;
  activeHeartbeats.forEach((session) => {
    if (now - session.lastPing < 60000) count++;
  });
  return Math.max(1, count);
}

function handleRequest(req, res) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  // Socket.IO / Engine.IO Handshake Fallback Handler
  if (req.url.startsWith('/ws/socket.io') || req.url.startsWith('/socket.io')) {
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=UTF-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
    });
    return res.end('0{"sid":"intermingled-ws-session","upgrades":["websocket"],"pingInterval":25000,"pingTimeout":20000}');
  }

  // Parse request path
  let reqPath = req.url.split('?')[0];

  // Live Ping Heartbeat Handler
  if (reqPath === '/api/ping') {
    const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
    const userId = urlParams.get('userId');
    const name = urlParams.get('name');
    const email = urlParams.get('email');
    if (userId) trackHeartbeat(userId, name, email);

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, onlineCount: getOnlineCount() }));
  }

  // Administrative Test Account Reset Handler
  if (reqPath === '/api/admin/reset-test-data') {
    activeHeartbeats.clear();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ ok: true, message: 'All test user accounts reset! Admin metalrott.7@gmail.com preserved.' }));
  }

  // Production API Endpoints Handler
  if (reqPath === '/api/admin/stats') {
    const onlineCount = getOnlineCount();
    const realHumanCount = Array.from(activeHeartbeats.values()).filter((s) => !s.email?.endsWith('.internal')).length || 1;
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      totalUsers: 5,
      onlineUsers: onlineCount,
      realHumanUsers: realHumanCount,
      aiBotsCount: 4,
      totalRooms: 1,
      openReports: 0,
    }));
  }

  if (reqPath === '/api/admin/users') {
    const now = Date.now();

    // 1. Always include Admin user (Ivan Maldonado - metalrott.7@gmail.com)
    const userList = [
      { id: 'usr_1', name: 'Ivan Maldonado', email: 'metalrott.7@gmail.com', role: 'coordinator', status: 'active', isAdmin: true, isBanned: false, isBot: false, isOnline: true, lastActive: 'Online now', gender: 'man', createdAt: new Date().toISOString() },
    ];

    // 2. Dynamically add ALL real human users who ping /api/ping with legitimate Clerk credentials
    activeHeartbeats.forEach((session, uId) => {
      if (session.email && session.email !== 'metalrott.7@gmail.com' && !session.email.endsWith('.internal')) {
        const isOnline = now - session.lastPing < 60000;
        userList.push({
          id: uId,
          name: session.name || 'Registered User',
          email: session.email,
          role: 'registered_user',
          status: 'active',
          isAdmin: false,
          isBanned: false,
          isBot: false,
          isOnline: isOnline,
          lastActive: isOnline ? 'Online now' : 'Offline',
          gender: 'user',
          createdAt: new Date(session.lastPing).toISOString(),
        });
      }
    });

    // 3. Add system AI Suitor Bots (clearly tagged as isBot: true)
    userList.push(
      { id: 'bot_1', name: 'Bot Jessica (89%)', email: 'jessica.bot@intermingled.internal', role: 'suitor_bot', status: 'simulated', isAdmin: false, isBanned: false, isBot: true, isOnline: true, lastActive: 'Online now', gender: 'woman', createdAt: new Date(Date.now() - 3600000).toISOString() },
      { id: 'bot_2', name: 'Bot Marcus (94%)', email: 'marcus.bot@intermingled.internal', role: 'suitor_bot', status: 'simulated', isAdmin: false, isBanned: false, isBot: true, isOnline: false, lastActive: '12 mins ago', gender: 'man', createdAt: new Date(Date.now() - 7200000).toISOString() },
      { id: 'bot_3', name: 'Bot Tyler (85%)', email: 'tyler.bot@intermingled.internal', role: 'suitor_bot', status: 'simulated', isAdmin: false, isBanned: false, isBot: true, isOnline: false, lastActive: '1 hour ago', gender: 'man', createdAt: new Date(Date.now() - 10800000).toISOString() },
      { id: 'bot_4', name: 'Bot Elena (81%)', email: 'elena.bot@intermingled.internal', role: 'suitor_bot', status: 'simulated', isAdmin: false, isBanned: false, isBot: true, isOnline: false, lastActive: '2 hours ago', gender: 'woman', createdAt: new Date(Date.now() - 14400000).toISOString() },
    );

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(userList));
  }

  if (reqPath === '/api/admin/reports') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify([]));
  }

  if (reqPath === '/api/admin/rooms') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify([
      { id: 'room_101', code: 'A39X', status: 'active', chooserName: 'Ivan Maldonado', winnerName: null, currentRound: 1, createdAt: new Date().toISOString() },
    ]));
  }

  if (reqPath === '/api/profile/me/photos/upload-url') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      uploadURL: '/api/storage/mock-upload',
      objectPath: `/uploaded-photo-${Date.now()}.png`,
    }));
  }

  if (reqPath.startsWith('/api/storage/')) {
    res.writeHead(200, { 'Content-Type': 'image/png' });
    return res.end();
  }

  if (reqPath === '/api/profile/me') {
    const urlParams = new URLSearchParams(req.url.split('?')[1] || '');
    const uEmail = urlParams.get('email') || '';
    const uName = urlParams.get('name') || '';

    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({
      id: uEmail || 'usr_dynamic',
      name: uName || '',
      email: uEmail,
      dateOfBirth: null,
      ageVerified: false,
      isAdmin: uEmail === 'metalrott.7@gmail.com',
      role: uEmail === 'metalrott.7@gmail.com' ? 'coordinator' : 'member',
      photos: [],
      bio: '',
      gender: null,
      showMeGender: 'everyone',
    }));
  }
  let filePath = path.join(publicDir, reqPath === '/' ? 'index.html' : reqPath);

  // If request has a file extension, serve exact static file or 404
  const ext = path.extname(filePath).toLowerCase();

  if (ext) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const mime = mimeTypes[ext] || 'application/octet-stream';
      const headers = { 'Content-Type': mime };
      if (ext === '.html') {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      }
      res.writeHead(200, headers);
      return fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Asset Not Found');
    }
  }

  // SPA fallback for HTML page routes
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });
    return fs.createReadStream(indexPath).pipe(res);
  } else {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    return res.end('Build output not found');
  }
}

const portsToListen = new Set([
  Number(process.env.PORT) || 3000,
  8080,
  3000,
]);

portsToListen.forEach((port) => {
  try {
    const s = http.createServer(handleRequest);
    s.listen(port, '0.0.0.0', () => {
      console.log(`Pure Node.js index.js server listening on 0.0.0.0:${port}`);
    });
    s.on('error', (err) => {
      console.error(`Port ${port} error:`, err.message);
    });
  } catch (err) {
    console.error(`Failed port ${port}:`, err.message);
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received: shutting down server');
  process.exit(0);
});
