// Tiny element helpers. Props: `class`, `text`, `style`, aria-*/data-*, and `onXxx` listeners.
type Child = Node | string | number | null | undefined | false
type Props = Record<string, unknown>

const SVG_NS = 'http://www.w3.org/2000/svg'

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  setProps(el, props)
  append(el, kids)
  return el
}

export function s<K extends keyof SVGElementTagNameMap>(tag: K, props?: Props | null, ...kids: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  setProps(el, props)
  append(el, kids)
  return el
}

function setProps(el: Element, props?: Props | null) {
  if (!props) return
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener)
    else if (k === 'text') el.textContent = String(v)
    else el.setAttribute(k, v === true ? '' : String(v))
  }
}

function append(el: Element, kids: Child[]) {
  for (const k of kids) if (k != null && k !== false) el.append(k instanceof Node ? k : String(k))
}

/** "{n}/{total}" style templating for strings that live in JSON. */
export function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
}

/** "2026-10-12" → "12/10/2026" */
export function viDate(iso?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (__LOCALE__ === 'en' && m) {
    // English edition: "Oct 12, 2026" / "Oct 2026"
    const dt = new Date(Date.UTC(+y, +m - 1, d ? +d : 1))
    return dt.toLocaleDateString('en-US', d ? { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' } : { month: 'short', year: 'numeric', timeZone: 'UTC' })
  }
  return d ? `${d}/${m}/${y}` : m ? `${m}/${y}` : y
}

let uid = 0
export const nextId = (p = 'id') => `${p}-${++uid}`
