import { load, save } from './store'

type P = { visited: number[]; passed: number[]; hints: string[] }

const raw = load<Partial<P>>('progress', {})
const nums = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is number => Number.isInteger(x)) : [])
const p: P = {
  visited: nums(raw.visited),
  passed: nums(raw.passed),
  hints: Array.isArray(raw.hints) ? raw.hints.filter((x): x is string => typeof x === 'string') : [],
}

const listeners = new Set<() => void>()
function persist() {
  save('progress', p)
  listeners.forEach((f) => f())
}

export const progress = {
  visit(id: number) {
    if (!p.visited.includes(id)) (p.visited.push(id), persist())
  },
  pass(id: number) {
    if (!p.passed.includes(id)) (p.passed.push(id), persist())
  },
  isVisited: (id: number) => p.visited.includes(id),
  isPassed: (id: number) => p.passed.includes(id),
  visitedCount: () => p.visited.length,
  lastVisited: () => p.visited[p.visited.length - 1],
  hintSeen: (key: string) => p.hints.includes(key),
  markHint(key: string) {
    if (!p.hints.includes(key)) (p.hints.push(key), persist())
  },
  onChange(fn: () => void) {
    listeners.add(fn)
    return () => void listeners.delete(fn)
  },
}
