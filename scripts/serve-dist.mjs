// Serve a build folder gzip-compressed with max-age=600, as GitHub Pages serves it (vite preview sends it raw).
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.woff': 'font/woff' }

/** Start a server on a free port; resolves to { url, close }. */
export async function serveDist(dir = 'dist') {
  const root = path.resolve(dir)
  if (!fs.existsSync(path.join(root, 'index.html'))) throw new Error(`No ${dir}/index.html — run \`npm run build\` first.`)
  const cache = new Map()
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname)
    if (p.endsWith('/')) p += 'index.html'
    const file = path.join(root, p)
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end()
    const ext = path.extname(file)
    const gz = /^\.(html|js|css|json|svg)$/.test(ext)
    if (!cache.has(file)) cache.set(file, gz ? zlib.gzipSync(fs.readFileSync(file)) : fs.readFileSync(file))
    res.writeHead(200, { 'content-type': TYPES[ext] ?? 'application/octet-stream', 'cache-control': 'max-age=600', ...(gz ? { 'content-encoding': 'gzip' } : {}) })
    res.end(cache.get(file))
  })
  await new Promise((ok) => server.listen(0, ok))
  return { url: `http://localhost:${server.address().port}/`, close: () => server.close() }
}
