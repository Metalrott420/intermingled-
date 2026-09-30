const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

const distDir = path.resolve(__dirname, 'artifacts', 'speed-date', 'dist', 'public');
const indexHtmlPath = path.join(distDir, 'index.html');

console.log('Production static server starting...');
console.log('Target static directory:', distDir);

// Log incoming requests for Railway debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Healthcheck endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).type('text/plain').send('OK');
});

// 1. Serve static files from dist/public/assets without falling through to index.html for missing files
app.use('/assets', express.static(path.join(distDir, 'assets'), {
  fallthrough: false,
  maxAge: '1y',
  immutable: true
}));

// 2. Serve root public assets (favicon.svg, manifest.json, logo-192.png, etc.)
app.use(express.static(distDir, {
  fallthrough: true,
  maxAge: '0',
}));

// Express 404 error handler for static asset errors (returns plain text 404, NEVER text/html)
app.use('/assets', (err, req, res, next) => {
  console.error(`Asset missing: ${req.url}`);
  if (!res.headersSent) {
    res.status(404).type('text/plain').send('Asset Not Found');
  }
});

// 3. SPA wildcard route fallback ONLY for page requests (HTML)
app.get('*', (req, res) => {
  if (fs.existsSync(indexHtmlPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(indexHtmlPath, (err) => {
      if (err && !res.headersSent) {
        console.error('Error sending index.html:', err.message);
        res.status(500).type('text/plain').send('Error reading index.html');
      }
    });
  } else {
    console.error('index.html not found at:', indexHtmlPath);
    res.status(500).type('text/plain').send('Production build not found in dist/public.');
  }
});

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Production server listening on 0.0.0.0:${port}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
