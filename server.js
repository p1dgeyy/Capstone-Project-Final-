/**
 * Capstone Project - Local Development & Test Server
 * 
 * Zero-dependency Node.js HTTP server for local testing.
 * Serves static files from the 'frontend' directory with proper MIME types,
 * SPA fallback routing, and live console logging.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Normalize root path to index.html
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  // Security check: prevent path traversal attacks
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(PUBLIC_DIR, safePath);

  // Check if target is a directory, append index.html if so
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // Check if file exists; if not, check with .html extension
  if (!fs.existsSync(filePath)) {
    const htmlCandidate = filePath + '.html';
    if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
      filePath = htmlCandidate;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Return 404 with fallback page
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>404 - Not Found | Capstone Portal</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; padding: 2.5rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 480px; width: 90%; }
            h1 { font-size: 3rem; margin: 0 0 0.5rem; color: #38bdf8; }
            p { color: #94a3b8; margin: 0 0 1.5rem; line-height: 1.5; }
            a { display: inline-block; background: #2563eb; color: #ffffff; padding: 0.75rem 1.5rem; border-radius: 8px; text-decoration: none; font-weight: 600; transition: background 0.2s; }
            a:hover { background: #1d4ed8; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>404</h1>
            <p>File or page not found: <code>${pathname}</code></p>
            <a href="/index.html">Return to Portal Home</a>
          </div>
        </body>
        </html>
      `);
      console.log(`[404] ${req.method} ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
    console.log(`[200] ${req.method} ${pathname} (${contentType})`);
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  🚀 Capstone Localhost Server is Running!`);
  console.log(`======================================================`);
  console.log(`  🔗 Local URL:            http://localhost:${PORT}`);
  console.log(`  🔗 Official Login:       http://localhost:${PORT}/official_login.html`);
  console.log(`  🔗 Admin Login:          http://localhost:${PORT}/admin_login.html`);
  console.log(`  📁 Serving Directory:    ${PUBLIC_DIR}`);
  console.log(`======================================================\n`);
  console.log(`  Press Ctrl + C to stop the server anytime.\n`);
});
