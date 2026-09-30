const { execSync } = require('child_process');
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();

const distDir = path.resolve(__dirname, 'artifacts', 'speed-date', 'dist', 'public');
const indexHtmlPath = path.join(distDir, 'index.html');

console.log('Production static server starting...');
console.log('Target static directory:', distDir);
console.log('Environment PORT:', process.env.PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

// If build output is missing, compile it on the fly!
if (!fs.existsSync(indexHtmlPath)) {
  console.log('dist/public/index.html not found. Building speed-date frontend now...');
  try {
    execSync('pnpm --filter @workspace/speed-date run build', { stdio: 'inherit', cwd: __dirname });
    console.log('Build completed successfully!');
  } catch (err) {
    console.error('Failed to build speed-date frontend:', err.message);
  }
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
  if (fs.existsSync(indexHtmlPath)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(indexHtmlPath);
  } else {
    res.status(500).type('text/plain').send('Production build not found in dist/public.');
  }
});

const port = process.env.PORT || 3000;
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`✓ Server listening on 0.0.0.0:${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

