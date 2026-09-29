const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

const distDir = path.resolve(__dirname, 'artifacts', 'speed-date', 'dist', 'public');

console.log('Production static server starting...');
console.log('Serving static files from:', distDir);

if (!fs.existsSync(distDir)) {
  console.error('CRITICAL WARNING: dist/public directory does not exist! Run pnpm build first.');
}

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
  res.status(404).type('text/plain').send('Asset Not Found');
});

// 3. SPA wildcard route fallback ONLY for page requests (HTML)
app.get('*', (req, res) => {
  const indexHtmlPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(indexHtmlPath);
  } else {
    res.status(500).type('text/plain').send('Production build not found in dist/public. Please run build.');
  }
});

const port = process.env.PORT || 24906;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server listening on 0.0.0.0:${port}`);
});
