import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2'
};

export function resolveSafePath(rawUrl) {
    let urlPath;
    try {
        urlPath = decodeURIComponent((rawUrl || '/').split('?')[0]);
    } catch {
        return null;
    }

    if (urlPath === '/') urlPath = '/index.html';

    const segments = urlPath.split('/').filter(Boolean);
    if (segments.some(seg => seg.startsWith('.'))) {
        return null;
    }

    const resolved = path.resolve(ROOT_DIR, '.' + urlPath);
    if (resolved !== path.join(ROOT_DIR, 'index.html') && !resolved.startsWith(ROOT_DIR + path.sep)) {
        return null;
    }
    return resolved;
}

export function createStaticServer() {
    return http.createServer((req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Method Not Allowed');
            return;
        }

        const filePath = resolveSafePath(req.url);
        if (!filePath) {
            res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Forbidden');
            return;
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('File not found');
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, {
                'Content-Type': contentType,
                'X-Content-Type-Options': 'nosniff'
            });
            res.end(req.method === 'HEAD' ? undefined : content);
        });
    });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const PORT = process.env.PORT || 3000;
    const server = createStaticServer();
    server.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
