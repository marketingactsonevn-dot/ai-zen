import { defineConfig, type Plugin } from 'vite'
import fs from 'node:fs'

// LOCALE=en builds the English edition: every import of src/content/<name>.json resolves to <name>.en.json when it exists.
const locale = process.env.LOCALE === 'en' ? 'en' : 'vi'

const localeContent = (): Plugin => ({
  name: 'locale-content',
  enforce: 'pre',
  async resolveId(source, importer, options) {
    if (locale !== 'en' || !source.endsWith('.json') || source.endsWith('.en.json')) return null
    const r = await this.resolve(source, importer, { ...options, skipSelf: true })
    if (!r || !r.id.includes('/src/content/')) return null
    const en = r.id.replace(/\.json$/, '.en.json')
    return fs.existsSync(en) ? en : null
  },
  transformIndexHtml(html) {
    if (locale !== 'en') return html
    return html
      .replace('<html lang="vi">', '<html lang="en">')
      .replace(/<title>[^<]*<\/title>/, '<title>AI Zen — Understand AI to use it well</title>')
      .replace(/(<meta name="description" content=")[^"]*/, '$1A calm, playable museum in a stone garden: what AI is, how it works, which AI to give which job, and how to use it wisely.')
      .replace('AI Zen cần JavaScript để chạy các trạm tương tác.', 'AI Zen needs JavaScript to run its interactive stations.')
  },
})

export default defineConfig({
  base: './',
  define: { __LOCALE__: JSON.stringify(locale) },
  build: { chunkSizeWarningLimit: 900 },
  plugins: [
    localeContent(),
    {
      // Many stations are edited in parallel during development: edits to one station must not
      // full-reload every open tab. Station/extras files are invalidated but not pushed; reload to see them.
      name: 'quiet-station-hmr',
      handleHotUpdate({ file }) {
        if (/\/src\/(stations\/t\d+|extras)\//.test(file) || /\/src\/content\/tram-\d+(\.en)?\.json$/.test(file)) return []
      },
    },
  ],
})
