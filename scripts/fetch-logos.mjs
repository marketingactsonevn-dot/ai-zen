// npm run logos [-- <generatedAt>]
// Copies each company's official mark from the installed simple-icons package (CC0 package; per-icon licences recorded) into public/logos/
// byte-for-byte — no download, no redraw, no recolour — and records where every file came from in logos.json.
// Companies without logo.simpleIcons (or whose slug is not in the package) go to "missing" and render as name badges.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkgDir = join(root, 'node_modules', 'simple-icons')
const companiesFile = join(root, 'src', 'content', 'companies.json')
const outDir = join(root, 'public', 'logos')
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'))

const pkg = readJson(join(pkgDir, 'package.json'))
const dataFile = ['data/simple-icons.json', '_data/simple-icons.json'].map((p) => join(pkgDir, p)).find((p) => existsSync(p))
if (!dataFile) throw new Error(`simple-icons@${pkg.version}: metadata JSON not found`)
const data = readJson(dataFile)
const icons = new Map((Array.isArray(data) ? data : data.icons).map((i) => [i.slug, i]))

const { companies } = readJson(companiesFile)
const generatedAt = process.argv[2] ?? statSync(companiesFile).mtime.toISOString()

mkdirSync(outDir, { recursive: true })
const items = {}
const missing = []

for (const c of companies) {
  const slug = c.logo?.simpleIcons
  const meta = slug ? icons.get(slug) : undefined
  const svg = slug ? join(pkgDir, 'icons', `${slug}.svg`) : ''
  if (!meta || !existsSync(svg)) {
    if (slug) console.warn(`!  ${c.id}: slug "${slug}" is not in simple-icons@${pkg.version}`)
    missing.push({ id: c.id, name: c.name, reason: 'not in simple-icons', ...(c.logo?.pressKit && { pressKit: c.logo.pressKit }) })
    continue
  }
  const file = `${c.id}.svg`
  copyFileSync(svg, join(outDir, file))
  items[c.id] = {
    name: c.name,
    title: meta.title,
    file,
    origin: 'simple-icons',
    slug,
    source: meta.source,
    ...(meta.guidelines && { guidelines: meta.guidelines }),
    ...(meta.license && { license: meta.license }),
    hex: `#${meta.hex}`,
  }
  console.log(`✓  ${c.id.padEnd(18)} ← ${slug}.svg  "${meta.title}"`)
}

// Drop marks this script generated last time for companies that were removed or lost their slug.
// Files it never wrote (e.g. a press-kit SVG added by hand) are left alone.
const manifestFile = join(outDir, 'logos.json')
const keep = new Set(Object.values(items).map((i) => i.file))
const prev = existsSync(manifestFile) ? Object.values(readJson(manifestFile).items ?? {}).map((i) => i.file) : []
for (const f of prev) if (!keep.has(f) && existsSync(join(outDir, f))) rmSync(join(outDir, f))

writeFileSync(
  manifestFile,
  JSON.stringify(
    {
      generatedAt,
      package: `simple-icons@${pkg.version}`,
      license: 'simple-icons package CC0-1.0; some icons carry their own licence (see items[].license); trademarks belong to their owners',
      items,
      missing,
    },
    null,
    2,
  ) + '\n',
)
for (const m of missing) console.log(`·  ${m.id.padEnd(18)} → name badge`)
console.log(`\n${Object.keys(items).length} official marks, ${missing.length} name badges → public/logos/logos.json`)
