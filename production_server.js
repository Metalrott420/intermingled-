const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const distDir = path.resolve(__dirname, 'artifacts', 'speed-date', 'dist', 'public');
const indexHtmlPath = path.join(distDir, 'index.html');

console.log(`[${new Date().toISOString()}] Server starting on port ${PORT}`);

// Serve static assets
app.use('/assets', express.static(path.join(distDir, 'assets'), {
  maxAge: '365d',
  immutable: true
}));

// Serve everything else as SPA
app.use((req, res, next) => {
  // If it's a static file that exists, serve it
  const filePath = path.join(distDir, req.path);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }
  // Otherwise send index.html for SPA routing
  res.sendFile(indexHtmlPath);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[${new Date().toISOString()}] ✓ Server running on 0.0.0.0:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] SIGTERM received, shutting down`);
  server.close(() => process.exit(0));
});

