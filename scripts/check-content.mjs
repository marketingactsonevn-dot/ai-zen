#!/usr/bin/env node
/**
 * Part 2 content check (spec C.0, D QA). Run: node scripts/check-content.mjs  — exits 1 on any problem.
 *
 * For tram-19…39.json (and each .en.json once it exists), news, toolkit, exam-2 (VI + EN):
 *  - every Fact-like object ({ text } plus asOf / source / kind / claimBy / verifiedBy) has an asOf date and a
 *    source key that resolves: the station's own `sources`, shared sources.json, or news.json `sources`;
 *  - every news item has date, kind, tags and a source in news `sources` (or sources.json);
 *  - every toolkit card cites a source that resolves in toolkit `sources` or sources.json (#/do-nghe loads no station);
 *  - every station `takeaways` id (and every nested `takeaway`) exists in toolkit.json;
 *  - every station `newsTags` tag meets at least one news item;
 *  - VI and EN files carry the same news ids, card ids and exam question count.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content')
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
const has = (f) => fs.existsSync(path.join(dir, f))
const problems = []
const bad = (file, where, msg) => problems.push(`${file} ${where}: ${msg}`)
const DATE = /^\d{4}-\d{2}(-\d{2})?$/
const KINDS = new Set(['fact', 'opinion', 'prediction', 'illustration'])
const FACT_KEYS = ['asOf', 'source', 'kind', 'claimBy', 'verifiedBy']

/** walk any JSON value, calling fn(obj, path) on every object */
function walk(v, p, fn) {
  if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`, fn))
  else if (v && typeof v === 'object') {
    fn(v, p)
    for (const [k, x] of Object.entries(v)) walk(x, p ? `${p}.${k}` : k, fn)
  }
}

function checkFacts(file, json, known) {
  let n = 0
  walk(json, '', (o, p) => {
    if (typeof o.text !== 'string' || !FACT_KEYS.some((k) => k in o)) return
    n++
    if (!DATE.test(o.asOf ?? '')) bad(file, p, `asOf missing or not a date (${o.asOf})`)
    if (!o.source) bad(file, p, 'source missing')
    else if (!known(o.source)) bad(file, p, `source "${o.source}" does not resolve`)
    if (o.kind && !KINDS.has(o.kind)) bad(file, p, `unknown kind "${o.kind}"`)
  })
  return n
}

let facts = 0
for (const loc of ['', '.en']) {
  const L = (name) => `${name}${loc}.json`
  if (!has(L('news'))) continue
  const shared = read(L('sources'))
  const news = read(L('news'))
  const toolkit = read(L('toolkit'))
  const inShared = (k) => k in shared
  const inNews = (k) => k in (news.sources ?? {}) || inShared(k)
  const cardIds = new Set(toolkit.cards.map((c) => c.id))

  // news board
  if (!DATE.test(news.asOf ?? '')) bad(L('news'), 'asOf', 'missing or not a date')
  const ids = new Set()
  news.items.forEach((it, i) => {
    const w = `items[${i}] ${it.id}`
    if (ids.has(it.id)) bad(L('news'), w, 'duplicate id')
    ids.add(it.id)
    if (!DATE.test(it.date ?? '')) bad(L('news'), w, 'date missing')
    if (!KINDS.has(it.kind)) bad(L('news'), w, `kind "${it.kind}"`)
    if (!it.tags?.length) bad(L('news'), w, 'no tags')
    for (const k of ['title', 'what', 'why']) if (!it[k]) bad(L('news'), w, `${k} missing`)
    if (!it.source || !inNews(it.source)) bad(L('news'), w, `source "${it.source}" does not resolve`)
  })
  const tags = new Set(news.items.flatMap((it) => it.tags))

  // toolkit cards
  const seen = new Set()
  toolkit.cards.forEach((c, i) => {
    const w = `cards[${i}] ${c.id}`
    if (seen.has(c.id)) bad(L('toolkit'), w, 'duplicate id')
    seen.add(c.id)
    if (!(c.station >= 19 && c.station <= 39)) bad(L('toolkit'), w, `station ${c.station}`)
    if (!['prompt', 'checklist', 'command', 'table'].includes(c.type)) bad(L('toolkit'), w, `type "${c.type}"`)
    if (!c.title || !c.body) bad(L('toolkit'), w, 'title/body missing')
    if (c.asOf && !DATE.test(c.asOf)) bad(L('toolkit'), w, 'asOf not a date')
    if (c.source && !(c.source in (toolkit.sources ?? {}) || inShared(c.source))) bad(L('toolkit'), w, `source "${c.source}" does not resolve`)
  })

  // stations
  for (let id = 19; id <= 39; id++) {
    const f = `tram-${id}${loc}.json`
    if (!has(f)) {
      if (!loc) bad(f, '', 'missing')
      continue
    }
    const st = read(f)
    const own = st.sources ?? {}
    facts += checkFacts(f, st, (k) => k in own || inNews(k))
    for (const t of st.newsTags ?? []) if (!tags.has(t)) bad(f, 'newsTags', `"${t}" meets no news item`)
    const refs = new Set(st.takeaways ?? [])
    walk(st, '', (o) => typeof o.takeaway === 'string' && refs.add(o.takeaway))
    for (const t of refs) if (!cardIds.has(t)) bad(f, 'takeaways', `"${t}" is not in ${L('toolkit')}`)
  }

  facts += checkFacts(L('news'), news, inNews)
  facts += checkFacts(L('toolkit'), toolkit, (k) => k in (toolkit.sources ?? {}) || inShared(k))
  if (has(L('exam-2'))) {
    const ex = read(L('exam-2'))
    facts += checkFacts(L('exam-2'), ex, inShared)
    ex.questions.forEach((q, i) => {
      if (!(q.answer >= 0 && q.answer < q.options.length)) bad(L('exam-2'), `questions[${i}]`, 'answer out of range')
      if (!(q.station >= 19 && q.station <= 39)) bad(L('exam-2'), `questions[${i}]`, `station ${q.station}`)
    })
  }
}

// VI ↔ EN parity
const pair = (f, get) => {
  if (!has(`${f}.json`) || !has(`${f}.en.json`)) return
  const a = get(read(`${f}.json`)), b = get(read(`${f}.en.json`))
  const i = a.findIndex((x, j) => x !== b[j])
  if (i >= 0 || a.length !== b.length) bad(`${f}.en.json`, `[${i < 0 ? a.length : i}]`, `${b[i] ?? '(none)'} ≠ ${f}.json ${a[i] ?? '(none)'}`)
}
pair('news', (d) => d.items.map((x) => `${x.id}:${x.source}:${x.kind}`))
pair('toolkit', (d) => d.cards.map((x) => `${x.id}:${x.station}:${x.type}`))
pair('exam-2', (d) => d.questions.map((q) => `${q.station}:${q.answer}:${q.options.length}`))
pair('glossary', (d) => d.terms.map((t) => `${t.id}:${t.station}`))

if (problems.length) {
  console.error(problems.join('\n'))
  console.error(`\n✗ ${problems.length} problem(s) · ${facts} facts checked`)
  process.exit(1)
}
console.log(`✓ content ok: ${facts} facts checked`)
