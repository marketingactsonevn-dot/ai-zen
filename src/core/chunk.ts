/**
 * Run heavy work in slices of ~`budget` ms, one slice per frame, so a scene can mount without a long task
 * (spec A.10: no frame > 50 ms while changing scene). Write the work as a generator that `yield`s between
 * small steps; the browser paints between slices, so art can appear progressively, like ink soaking in.
 *
 *   const job = sliced(function* () { for (const s of strokes) { draw(s); yield } }())
 *   ctx.onCleanup(job.cancel)
 *
 * Pass `sync: ctx.reduced` so reduced motion still gets everything at once, as before.
 */
export function sliced(steps: Iterator<unknown>, opts: { budget?: number; sync?: boolean } = {}): { done: Promise<void>; cancel(): void } {
  const budget = opts.budget ?? 8
  let raf = 0
  let cancelled = false
  let finish: () => void = () => {}
  const done = new Promise<void>((r) => (finish = r))
  const slice = () => {
    raf = 0
    if (cancelled) return
    const end = performance.now() + budget
    while (performance.now() < end) {
      if (steps.next().done) return finish()
    }
    raf = requestAnimationFrame(slice)
  }
  if (opts.sync) {
    while (!steps.next().done);
    finish()
  } else slice()
  return {
    done,
    cancel() {
      cancelled = true
      cancelAnimationFrame(raf)
    },
  }
}
