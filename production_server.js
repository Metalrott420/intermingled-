const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const distDir = path.resolve(__dirname, 'artifacts', 'speed-date', 'dist', 'public');
const indexHtmlPath = path.join(distDir, 'index.html');

// CRITICAL: Read PORT FIRST, before anything else
const PORT = process.env.PORT;
if (!PORT) {
  console.error('FATAL: process.env.PORT is not set. Railway must provide it.');
  process.exit(1);
}

console.log(`[STARTUP] PORT from environment: ${PORT}`);
console.log(`[STARTUP] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[STARTUP] Target directory: ${distDir}`);

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Static assets (no fallback)
app.use('/assets', express.static(path.join(distDir, 'assets'), {
  fallthrough: false,
  maxAge: '1y',
  immutable: true
}));

// Root static files with fallback
app.use(express.static(distDir, {
  fallthrough: true,
  maxAge: '0'
}));

// Asset 404 handler
app.use('/assets', (err, req, res, next) => {
  if (!res.headersSent) {
    res.status(404).type('text/plain').send('Asset Not Found');
  }
});

// SPA wildcard fallback
app.get('*', (req, res) => {
  if (!fs.existsSync(indexHtmlPath)) {
    console.error(`[ERROR] index.html not found at ${indexHtmlPath}`);
    return res.status(500).type('text/plain').send('Build not found');
  }
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.sendFile(indexHtmlPath);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SUCCESS] Server listening on 0.0.0.0:${PORT}`);
});

server.on('error', (err) => {
  console.error(`[FATAL] Server error on port ${PORT}:`, err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed');
    process.exit(0);
  });
});

