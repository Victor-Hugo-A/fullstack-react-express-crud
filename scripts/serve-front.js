const http = require('node:http');
const { createReadStream } = require('node:fs');
const { realpath, stat } = require('node:fs/promises');
const path = require('node:path');

const frontendDirectory = path.resolve(__dirname, '..', 'FrontEnd');
const port = Number(process.env.FRONTEND_PORT) || 5500;
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};
const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://code.jquery.com",
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://www.gov.br",
    "connect-src 'self' http://localhost:3000",
    "frame-src 'self' blob:"
].join('; ');

http.createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' }).end();
        return;
    }

    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
        res.writeHead(400).end();
        return;
    }

    if (pathname === '/') {
        res.writeHead(302, { Location: '/login.html' }).end();
        return;
    }

    // Mantém endereços antigos funcionando sem expor a estrutura interna de pastas.
    if (pathname.startsWith('/FrontEnd/')) {
        res.writeHead(308, { Location: pathname.slice('/FrontEnd'.length) }).end();
        return;
    }

    const relativePath = pathname.slice(1);
    if (relativePath.split(/[\\/]/).some(part => !part || part.startsWith('.'))) {
        res.writeHead(404).end();
        return;
    }

    try {
        const filePath = await realpath(path.resolve(frontendDirectory, relativePath));
        const relative = path.relative(frontendDirectory, filePath);
        if (relative.startsWith('..') || path.isAbsolute(relative) || !(await stat(filePath)).isFile()) {
            res.writeHead(404).end();
            return;
        }

        res.writeHead(200, {
            'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'strict-origin-when-cross-origin',
            'Content-Security-Policy': contentSecurityPolicy
        });
        if (req.method === 'HEAD') {
            res.end();
            return;
        }
        createReadStream(filePath).pipe(res);
    } catch {
        res.writeHead(404).end();
    }
}).listen(port, '127.0.0.1', () => {
    console.log(`Frontend disponível em http://localhost:${port}/login.html`);
});
