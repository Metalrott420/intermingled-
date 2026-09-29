import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5173;

// Serve static files from dist/public with proper MIME types
const publicDir = path.resolve(__dirname, 'dist/public');
app.use(express.static(publicDir, {
  maxAge: '1d',
  etag: false,
  setHeaders: (res, filepath) => {
    // Ensure correct MIME types for assets
    if (filepath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filepath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filepath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filepath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    } else if (filepath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else if (filepath.endsWith('.woff2')) {
      res.setHeader('Content-Type', 'font/woff2');
    }
  }
}));

// SPA fallback: only rewrite app routes back to index.html
// Static assets (in /assets/, .js, .css, .png, .svg, .json, .woff2, etc.) are served directly
// and return 404 if not found (not index.html)
app.get('*', (req, res) => {
  // Don't rewrite actual asset requests
  if (req.path.match(/\.(js|css|png|svg|json|woff2|jpg|jpeg|gif|ico|webp)$/i)) {
    res.status(404).send('Not Found');
    return;
  }
  
  // Don't rewrite API calls or known non-SPA paths
  if (req.path.startsWith('/api/')) {
    res.status(404).send('Not Found');
    return;
  }

  // Rewrite SPA routes to index.html
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

