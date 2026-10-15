import './part2.css'
import { fill, h, s } from '../../core/dom'
import { L } from '../../core/content'
import type { CodeScroll } from './types'
import { copyText } from './ink'

type Tok = [cls: string, re: RegExp]
const STR = /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/
const NUM = /\b\d+(?:\.\d+)?\b/
// A tiny hand-written highlighter (no library): per language, the first rule that matches at a position wins.
// shortcut: one line at a time, so a /* comment */ or a string spanning lines is not tinted; fine for the short scrolls of B.7.7.
const RULES: Record<CodeScroll['lang'], Tok[]> = {
  js: [['c', /\/\/.*|\/\*.*?\*\//], ['s', STR], ['k', /\b(?:const|let|var|function|return|if|else|for|while|of|in|new|class|import|from|export|await|async|true|false|null|undefined|this)\b/], ['n', NUM], ['f', /\b[A-Za-z_$][\w$]*(?=\()/]],
  python: [['c', /#.*/], ['s', STR], ['k', /\b(?:def|return|if|elif|else|for|while|in|import|from|as|class|with|True|False|None|and|or|not|lambda|try|except)\b/], ['n', NUM], ['f', /\b[A-Za-z_]\w*(?=\()/]],
  html: [['c', /<!--.*?-->/], ['t', /<\/?[\w-]+|\/?>/], ['a', /\b[\w-]+(?==)/], ['s', STR]],
  css: [['c', /\/\*.*?\*\//], ['s', STR], ['a', /[\w-]+(?=\s*:)/], ['n', /#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|rem|em|%|s|ms|vh|vw|deg)?/], ['t', /[.#]?[\w-]+(?=[^{};]*\{)/]],
  bash: [['c', /(?:^|\s)#.*/], ['s', STR], ['v', /\$\w+|\s--?[\w-]+/], ['f', /^\s*[\w./-]+/]],
  json: [['a', /"(?:\\.|[^"\\])*"(?=\s*:)/], ['s', STR], ['k', /\b(?:true|false|null)\b/], ['n', /-?\d+(?:\.\d+)?/]],
  text: [],
}

function paint(line: string, rules: Tok[]): (Node | string)[] {
  if (!rules.length) return [line]
  const re = new RegExp(rules.map(([, r]) => `(${r.source})`).join('|'), 'g')
  const out: (Node | string)[] = []
  let last = 0
  for (const m of line.matchAll(re)) {
    const k = m.slice(1).findIndex((g) => g !== undefined)
    if (!m[0]) continue
    out.push(line.slice(last, m.index), h('span', { class: `p2x-${rules[k][0]}` }, m[0]))
    last = m.index + m[0].length
  }
  out.push(line.slice(last))
  return out
}

/**
 * B.7.7 Cuộn mã: short code as a hanging scroll — lightly tinted, line numbers, a Vietnamese note beside each block
 * (a block runs from a note's line to the next note), and a copy button. Plain DOM: put it in any scene or page.
 */
export function codeScroll(data: CodeScroll, o: { title?: string } = {}): HTMLElement {
  const lines = data.code.replace(/\n$/, '').split('\n')
  const notes = [...data.notes].sort((a, b) => a.line - b.line)
  const starts = [...new Set([1, ...notes.map((x) => x.line)])].filter((l) => l >= 1 && l <= lines.length)
  const rules = RULES[data.lang] ?? []
  const blocks = starts.map((from, i) => {
    const to = (starts[i + 1] ?? lines.length + 1) - 1
    const note = notes.find((x) => x.line === from)
    const code = h('pre', { class: 'p2x-code' }, h('code', null,
      ...lines.slice(from - 1, to).map((ln, j) => h('span', { class: 'p2x-line' }, h('span', { class: 'p2x-ln', 'aria-hidden': 'true' }, String(from + j)), ...paint(ln, rules), '\n'))))
    return h('div', { class: `p2x-block${note ? ' noted' : ''}` }, code,
      note ? h('p', { class: 'p2x-note' }, h('span', { class: 'p2x-at' }, fill(L.codeLine, { n: from })), note.text) : null)
  })
  const raw = h('pre', { class: 'visually-hidden', 'aria-hidden': 'true' }, data.code) // what the fallback selects
  const label = h('span', null, L.copy)
  const btn = h('button', { class: 'btn p2k-copy p2x-copy', type: 'button' },
    s('svg', { class: 'p2k-ico', viewBox: '0 0 24 24', 'aria-hidden': 'true' }, s('path', { d: 'M8 8h9.5a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 19V9.5A1.5 1.5 0 0 1 8 8zM4.5 15.5V5A1.5 1.5 0 0 1 6 3.5h9.5' })), label)
  const status = h('span', { class: 'visually-hidden', role: 'status' })
  let timer = 0
  btn.addEventListener('click', async () => {
    const how = await copyText(data.code, raw)
    clearTimeout(timer)
    label.textContent = how === 'copied' ? L.copied : L.copySelected
    status.textContent = label.textContent
    btn.classList.toggle('done', how === 'copied')
    timer = window.setTimeout(() => ((label.textContent = L.copy), btn.classList.remove('done'), (status.textContent = '')), 2400)
  })
  return h('figure', { class: 'p2x', 'data-lang': data.lang },
    h('span', { class: 'p2x-rod', 'aria-hidden': 'true' }),
    h('div', { class: 'p2x-paper' },
      h('figcaption', { class: 'p2x-head' },
        h('span', { class: 'p2-eyebrow' }, `${L.code} · ${data.lang}`),
        o.title ? h('span', { class: 'p2x-file' }, o.title) : null,
        btn, status),
      h('div', { class: 'p2x-blocks', tabindex: '0', role: 'region', 'aria-label': `${L.code} ${o.title ?? data.lang}` }, ...blocks),
      raw),
    h('span', { class: 'p2x-rod', 'aria-hidden': 'true' }))
}
