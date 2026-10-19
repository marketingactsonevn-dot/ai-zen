import type { Fact, StationContent } from '../core/content'
import type { Quality } from '../core/prefs'
import type { chime } from '../core/sound'
import type { fact, tag } from '../ui/fact'

/**
 * A station is a short sequence of full-viewport SCENES, flipped like keynote slides.
 * Each scene follows: image → interaction → insight. It opens with only art + a tiny prompt;
 * the knowledge sentence appears only after the visitor has done something.
 */
/** The "more" under an insight: one line, or several (each its own paragraph). */
export type Detail = Fact | string | (Fact | string)[]

/**
 * Part 2: the corner where a scene's insight sits on wide screens, chosen opposite the hero (an empty band of sky or
 * water): t = top, b = bottom, l / r = left / right. Without one (and always on phones) it stays in the foot.
 */
export type TextZone = 'tl' | 'tr' | 'bl' | 'br'

export interface SceneCtx {
  readonly reduced: boolean
  readonly quality: Quality
  /** The art area: fills the viewport between the top chrome and the insight/rail zone. Has an explicit size. */
  readonly art: HTMLElement
  /** The whole scene root (art + foot). */
  readonly el: HTMLElement
  /**
   * Short instruction pill (≤ 6 words, e.g. "Chạm và giữ"). Part 1: fades on the first interaction or when insight() is
   * called. Part 2 (H5): stays until insight() / complete() — a missed touch never hides it; call again for each step
   * (the text swaps in place), tone 'wrong' says what to do instead (H6), 'ok' confirms a step.
   */
  prompt(text: string, tone?: 'wrong' | 'ok'): void
  /** Reveal the knowledge sentence with an ink fade-in (replaces the previous one) and mark the scene explored. */
  insight(f: Fact | string, detail?: Detail): HTMLElement
  /** Mark the scene explored without showing text (the next arrow starts to glow). */
  complete(): void
  /** Part 2: move the insight to another corner (or back to the foot with null), e.g. once the hero has moved. */
  textZone(z: TextZone | null): void
  fact: typeof fact
  tag: typeof tag
  chime: typeof chime
  /** Wrap gsap tweens created later (event handlers) so they are reverted when the scene unmounts. */
  anim(fn: () => void): void
  onCleanup(fn: () => void): void
}

export interface SceneDef {
  /** short name for the scene rail (aria / tooltip) */
  label: string
  /** Part 2: where the insight sits on wide screens (see TextZone); default: the foot */
  text?: TextZone
  /** Build the scene. Called when the scene is entered; return a cleanup (WebGL, listeners, timers). */
  mount(ctx: SceneCtx): void | (() => void)
}

export interface StationModule {
  content: StationContent
  /** The frame appends a quiz scene (content.quiz) and a one-sentence summary scene (content.summary). */
  scenes: SceneDef[]
}
