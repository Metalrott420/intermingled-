import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5173;

// Serve static files from dist/public with correct MIME types
const publicDir = path.resolve(__dirname, 'dist/public');

// Explicit static file routes FIRST - these bypass any middleware below
app.get('/assets/*', express.static(publicDir));
app.get('*.js', express.static(publicDir));
app.get('*.css', express.static(publicDir));
app.get('*.json', express.static(publicDir));
app.get('*.png', express.static(publicDir));
app.get('*.svg', express.static(publicDir));
app.get('*.jpg', express.static(publicDir));
app.get('*.jpeg', express.static(publicDir));
app.get('*.gif', express.static(publicDir));
app.get('*.ico', express.static(publicDir));
app.get('*.webp', express.static(publicDir));
app.get('*.woff2', express.static(publicDir));

// Serve all other static files with express.static
app.use(express.static(publicDir, {
  maxAge: '1d',
  etag: false
}));

// SPA fallback - only for non-asset routes
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

