import type { Fact, StationContent } from '../core/content'
import type { Quality } from '../core/prefs'
import type { chime } from '../core/sound'
import type { fact, tag } from '../ui/fact'

/**
 * A station is a short sequence of full-viewport SCENES, flipped like keynote slides.
 * Each scene follows: image → interaction → insight. It opens with only art + a tiny prompt;
 * the knowledge sentence appears only after the visitor has done something.
 */
export interface SceneCtx {
  readonly reduced: boolean
  readonly quality: Quality
  /** The art area: fills the viewport between the top chrome and the insight/rail zone. Has an explicit size. */
  readonly art: HTMLElement
  /** The whole scene root (art + foot). */
  readonly el: HTMLElement
  /** Short instruction pill (≤ 6 words, e.g. "Chạm và giữ"). Fades on the first interaction or when insight() is called. */
  prompt(text: string): void
  /** Reveal the knowledge sentence with an ink fade-in (replaces the previous one) and mark the scene explored. */
  insight(f: Fact | string, detail?: Fact | string): HTMLElement
  /** Mark the scene explored without showing text (the next arrow starts to glow). */
  complete(): void
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
  /** Build the scene. Called when the scene is entered; return a cleanup (WebGL, listeners, timers). */
  mount(ctx: SceneCtx): void | (() => void)
}

export interface StationModule {
  content: StationContent
  /** The frame appends a quiz scene (content.quiz) and a one-sentence summary scene (content.summary). */
  scenes: SceneDef[]
}
