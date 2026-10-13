/**
 * Demo tokenizer — "mô phỏng gần đúng". NOT any real model's vocabulary.
 * It mimics the habits of real byte-pair tokenizers closely enough to teach the idea:
 *  - a leading space belongs to the next word ("Chúc", " bạn", …), punctuation stands alone;
 *  - common English words stay whole, long ones split in two;
 *  - Vietnamese syllables with a tone mark (dấu thanh) are usually cut into onset + rhyme ("tr" + "ời"),
 *    except a handful of very common syllables that a tokenizer would have learnt whole.
 * IDs are a stable hash of the piece, so the same piece always gets the same number.
 */
export interface Tok {
  /** the piece as written, without its leading space */
  t: string
  /** illustrative token ID */
  id: number
  /** the piece starts with a space (shown as a gap in the sentence) */
  lead: boolean
  /** index of the word this piece belongs to (pieces of one word never wrap apart) */
  word: number
}

const TONE = /[̣̀́̃̉]/ // huyền, sắc, ngã, hỏi, nặng (after NFD)
const ONSETS = ['ngh', 'ng', 'nh', 'ch', 'gh', 'gi', 'kh', 'ph', 'qu', 'th', 'tr', 'b', 'c', 'd', 'đ', 'g', 'h', 'k', 'l', 'm', 'n', 'p', 'r', 's', 't', 'v', 'x']
const COMMON = new Set(['là', 'có', 'của', 'và', 'được', 'không', 'người', 'này', 'cho', 'với', 'một', 'các', 'những', 'đến', 'trong', 'bạn', 'đã', 'rồi', 'nhiều', 'hàng', 'cũng', 'để', 'thì', 'mà'])
const VOWEL = /[aeiouy]/i

/** FNV-1a → a 5-digit-ish number, stable across visits. */
function idOf(piece: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < piece.length; i++) {
    h ^= piece.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return 100 + ((h >>> 0) % 99800)
}

/** English: whole if short, otherwise cut near the middle between two consonants. */
function splitAscii(w: string): string[] {
  if (w.length <= 8) return [w]
  const mid = w.length / 2
  let best = Math.round(mid)
  let score = Infinity
  for (let i = 3; i <= w.length - 3; i++) {
    const ok = !VOWEL.test(w[i - 1]) && !VOWEL.test(w[i])
    const sc = Math.abs(i - mid) + (ok ? 0 : 2)
    if (sc < score) (score = sc), (best = i)
  }
  return [...splitAscii(w.slice(0, best)), ...splitAscii(w.slice(best))]
}

function splitViet(w: string): string[] {
  const lower = w.toLowerCase()
  if (!TONE.test(w.normalize('NFD')) || COMMON.has(lower)) return [w]
  const onset = ONSETS.find((o) => lower.startsWith(o) && lower.length > o.length)
  if (onset) return [w.slice(0, onset.length), w.slice(onset.length)]
  return w.length > 2 ? [w.slice(0, 1), w.slice(1)] : [w]
}

export function tokenize(text: string): Tok[] {
  const out: Tok[] = []
  const re = /(\s*)([\p{L}\p{M}]+|\p{N}+|[^\s\p{L}\p{M}\p{N}])/gu
  let word = -1
  for (const m of text.normalize('NFC').matchAll(re)) {
    const lead = m[1].length > 0 && out.length > 0
    const piece = m[2]
    let parts: string[]
    if (/^\p{N}+$/u.test(piece)) parts = piece.match(/.{1,3}/gu) ?? [piece]
    else if (/^[a-z]+$/i.test(piece)) parts = splitAscii(piece)
    else if (/^[\p{L}\p{M}]+$/u.test(piece)) parts = splitViet(piece)
    else parts = [piece]
    // punctuation glued to the previous word stays on its line
    if (lead || !/^[^\p{L}\p{N}]$/u.test(piece) || word < 0) word++
    parts.forEach((p, i) => {
      const sp = lead && i === 0
      out.push({ t: p, id: idOf((sp ? ' ' : '') + p), lead: sp, word })
    })
  }
  return out
}
