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

function handleRequest(req, res) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  // Parse request path
  let reqPath = req.url.split('?')[0];
  let filePath = path.join(publicDir, reqPath === '/' ? 'index.html' : reqPath);

  // If request has a file extension, serve exact static file or 404
  const ext = path.extname(filePath).toLowerCase();

  if (ext) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const mime = mimeTypes[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
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
