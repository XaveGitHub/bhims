import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createReadStream, statSync, existsSync, writeFileSync } from 'node:fs';
import appHandler from './dist/server/server.js';

process.on('uncaughtException', (err) => {
  writeFileSync('C:\\Users\\gizmo\\Desktop\\bhims-fatal-error.txt', err.stack || err.toString());
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  writeFileSync('C:\\Users\\gizmo\\Desktop\\bhims-fatal-rejection.txt', String(reason));
  process.exit(1);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain'
};

const port = process.env.PORT || 3000;

function serveStatic(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }
  
  const urlPath = new URL(req.url, `http://localhost`).pathname;
  let filePath;
  
  if (urlPath.startsWith('/templates/')) {
    const userDataPath = process.env.USER_DATA_PATH;
    if (!userDataPath) return next();
    filePath = join(userDataPath, urlPath);
  } else {
    filePath = join(__dirname, 'dist', 'client', urlPath === '/' ? 'index.html' : urlPath);
  }
  
  if (existsSync(filePath)) {
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      filePath = join(filePath, 'index.html');
      if (!existsSync(filePath)) return next();
    }
    
    const ext = extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    
    const stream = createReadStream(filePath);
    stream.pipe(res);
  } else {
    next();
  }
}

const server = createServer((req, res) => {
  serveStatic(req, res, async () => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) value.forEach(v => headers.append(key, v));
        else if (value) headers.set(key, value);
      }

      let body = undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        body = Buffer.concat(chunks);
      }

      const request = new Request(url, {
        method: req.method,
        headers,
        body,
        duplex: body ? 'half' : undefined
      });

      const response = await appHandler.fetch(request);

      res.statusCode = response.status;
      if (response.statusText) res.statusMessage = response.statusText;
      
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (response.body) {
        // Node 18+ Response body is a ReadableStream
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
    } catch (err) {
      console.error('[Prod Server] SSR Handler Error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    }
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[Prod Server] Listening on http://0.0.0.0:${port}`);
  if (process.send) {
    process.send('ready');
  }
});
