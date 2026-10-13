import { h, nextId } from '../core/dom'
import { L, type Quiz } from '../core/content'
import { progress } from '../core/progress'
import { gsap } from '../core/anim'
import type { SceneDef } from '../stations/types'

/** Quiz as a scene: answers are stones on raked sand. Right → ripples + explanation; wrong → the stone sinks. */
export function quizScene(id: number, q: Quiz): SceneDef {
  return {
    label: L.quizEyebrow,
    mount(ctx) {
      const qid = nextId('quiz')
      const stones = q.options.map((text, i) =>
        h('button', { class: 'qstone', type: 'button', style: `--i:${i}`, onClick: () => pick(i) },
          h('span', { class: 'qstone-ripples', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')),
          h('span', { class: 'qstone-key', 'aria-hidden': 'true' }, String.fromCharCode(65 + i)),
          h('span', { class: 'qstone-text' }, text)))
      const passed = progress.isPassed(id)
      ctx.art.append(h('div', { class: 'quiz' },
        h('p', { class: 'quiz-label' }, L.quizEyebrow),
        h('h2', { id: qid, class: 'quiz-q' }, q.q),
        h('div', { class: 'quiz-stones', role: 'group', 'aria-labelledby': qid }, ...stones),
        passed ? h('p', { class: 'quiz-note' }, L.quizPassed) : null))
      if (!passed) ctx.prompt(L.quizPrompt)
      if (!ctx.reduced)
        gsap.from(stones, { opacity: 0, y: 24, stagger: 0.12, duration: 1.1, ease: 'power3.out', delay: 0.2, clearProps: 'opacity,transform,translate,rotate,scale' })

      function pick(i: number) {
        stones.forEach((b) => b.classList.remove('wrong'))
        if (i === q.answer) {
          stones.forEach((b, j) => {
            b.classList.toggle('right', j === i)
            b.disabled = j !== i
          })
          ctx.insight(`${L.quizRight} ${q.explain}`)
          progress.pass(id)
          ctx.chime('ok')
        } else {
          stones[i].classList.add('wrong')
          ctx.prompt(L.quizWrong)
          ctx.chime('low')
        }
      }
    },
  }
}
