import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8080;

const publicDir = path.resolve(__dirname, 'artifacts/speed-date/dist/public');

// MIME type map
const mimeTypes = {
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.html': 'text/html; charset=utf-8',
};

// Explicit static file handler - responds directly with correct MIME types
app.get(/\.(js|css|png|jpg|jpeg|gif|svg|json|woff|woff2|ttf|eot|ico|webp|html)$/i, (req, res, next) => {
  const filePath = path.join(publicDir, req.path);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(publicDir)) {
    return res.status(403).send('Forbidden');
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`[404] Static asset not found: ${req.path}`);
    return res.status(404).send('Not Found');
  }
  
  // Get file extension and set correct MIME type
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  
  // Send the file
  return res.sendFile(filePath);
});

// Explicit /assets/* handler - guarantees static files from assets directory
app.get('/assets/*', (req, res) => {
  const filePath = path.join(publicDir, req.path);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(publicDir)) {
    return res.status(403).send('Forbidden');
  }
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`[404] Asset not found: ${req.path}`);
    return res.status(404).send('Not Found');
  }
  
  // Detect MIME type from extension
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = mimeTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  
  return res.sendFile(filePath);
});

// Serve other static files (favicon, robots.txt, manifest, etc.)
app.use((req, res, next) => {
  const filePath = path.join(publicDir, req.path);
  
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    return res.sendFile(filePath);
  }
  
  next()
});

// SPA fallback - rewrite all other routes to index.html for client-side routing
app.get('*', (req, res) => {
  const indexPath = path.join(publicDir, 'index.html');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(indexPath);
});

// Error handling
app.use((err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  res.status(500).send('Internal Server Error');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Serving static files from: ${publicDir}`);
});

