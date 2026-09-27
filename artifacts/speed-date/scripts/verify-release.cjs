const fs = require('fs');
const path = require('path');

async function verifyBuild() {
  console.log('=== PHASE 1: Local Build Artifact Inspection ===');
  const distDir = path.resolve(__dirname, '..', 'dist', 'public');
  const indexHtmlPath = path.join(distDir, 'index.html');

  if (!fs.existsSync(indexHtmlPath)) {
    console.error('FAIL: dist/public/index.html does not exist!');
    process.exit(1);
  }

  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  console.log('OK: index.html exists (length:', html.length, 'bytes)');

  // Extract referenced assets from index.html
  const srcMatches = Array.from(html.matchAll(/(?:src|href)=["']([^"']+)["']/g)).map(m => m[1]);
  const assetPaths = srcMatches.filter(p => p.startsWith('/assets/') || p.endsWith('.png') || p.endsWith('.svg') || p.endsWith('.json'));

  console.log('Found referenced static assets in index.html:', assetPaths);

  let hasError = false;
  for (const assetPath of assetPaths) {
    const localFile = path.join(distDir, assetPath.replace(/^\//, ''));
    if (!fs.existsSync(localFile)) {
      console.error(`FAIL: Referenced asset missing from build output: ${assetPath} (expected at ${localFile})`);
      hasError = true;
    } else {
      const stats = fs.statSync(localFile);
      if (stats.size === 0) {
        console.error(`FAIL: Asset file is 0 bytes: ${assetPath}`);
        hasError = true;
      } else {
        console.log(`OK: ${assetPath} exists (${stats.size} bytes)`);
      }
    }
  }

  if (hasError) {
    console.error('BUILD VERIFICATION FAILED: Referenced files are missing from dist/public!');
    process.exit(1);
  }

  console.log('\n=== PHASE 2: Live Production Domain Smoke Test ===');
  const domain = 'https://www.intermingledapp.com';

  try {
    const indexRes = await fetch(domain + '/');
    const indexText = await indexRes.text();
    console.log(`Live index.html status: ${indexRes.status}, Content-Type: ${indexRes.headers.get('content-type')}`);

    const liveJsMatch = indexText.match(/src=["'](\/assets\/[^"']+\.js)["']/);
    const liveCssMatch = indexText.match(/href=["'](\/assets\/[^"']+\.css)["']/);

    if (liveJsMatch) {
      const jsUrl = domain + liveJsMatch[1];
      const jsRes = await fetch(jsUrl);
      const jsContentType = jsRes.headers.get('content-type') || '';
      console.log(`Live JS (${liveJsMatch[1]}): Status ${jsRes.status}, Content-Type: ${jsContentType}`);

      if (jsContentType.includes('text/html')) {
        console.warn('CRITICAL WARNING: Live JS asset is currently returning Content-Type: text/html!');
        console.warn('The Railway production deployment needs to be redeployed with the updated build.');
      } else {
        console.log('SUCCESS: Live JS asset returned valid non-HTML Content-Type!');
      }
    }

    if (liveCssMatch) {
      const cssUrl = domain + liveCssMatch[1];
      const cssRes = await fetch(cssUrl);
      const cssContentType = cssRes.headers.get('content-type') || '';
      console.log(`Live CSS (${liveCssMatch[1]}): Status ${cssRes.status}, Content-Type: ${cssContentType}`);

      if (cssContentType.includes('text/html')) {
        console.warn('CRITICAL WARNING: Live CSS asset is currently returning Content-Type: text/html!');
      } else {
        console.log('SUCCESS: Live CSS asset returned valid non-HTML Content-Type!');
      }
    }
  } catch (err) {
    console.error('Error during live domain check:', err.message);
  }

  console.log('\nVerification completed.');
}

verifyBuild();
