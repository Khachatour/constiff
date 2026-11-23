import { Count, Follow, Stage, Window, type Act } from '../../kit'
import data from './data.json'
import './hero.css'

// constiff: a GitHub-style diff of Armenia's current Constitution against the
// 2026 draft. Story (how it feels to use): the reader picks draft Article 49
// in the sidebar, the article's diff swaps in, and the changed words light up
// in reading order: who elects the President, then the age (40 → 35) and the
// residency years (6 → 5). The loop returns by clicking Article 48 again.
//
// Real strings: the product title, the sidebar's article titles, and the diff
// lines, all taken verbatim from constiff's own diff engine (data.json).
// Fidelity is realistic: a diff is the subject, so its lines are real.

type Seg = string | (string | number)[]
type Line = { k: string; n: number; m?: number; hdr: boolean; s: Seg[] }
type Art = { add: number; del: number; from: string[]; label: string; rows: Line[] }

const A48 = (data as unknown as Record<string, Art>)['p-48']
const A49 = (data as unknown as Record<string, Art>)['p-49']
const SIDE = data.side as { n: string; t: string; ch: number; add: number; del: number; st: string }[]
const CHAPTERS = data.chapters as { n: number; t: string }[]

type S = { art: '48' | '49'; lit: number }
const initial: S = { art: '48', lit: 9 }
const POSTER: S = { art: '49', lit: 3 }

// Which light-up step reveals each row of Article 49: the heading pair, then
// the first part, then the second part (the age and residency change).
const levelOf = (i: number) => (i < 2 ? 1 : i < 4 ? 2 : 3)

async function script(a: Act<S>) {
  if (a.layout === 'compact') {
    // No sidebar on a phone: the words light up in turn, hold, and clear.
    await a.set({ art: '49', lit: 0 })
    await a.wait(900)
    for (const lit of [1, 2, 3]) {
      await a.set({ lit })
      await a.wait(lit === 3 ? 400 : 650)
    }
    a.mark('payoff')
    await a.wait(2600)
    for (const lit of [2, 1, 0]) {
      await a.set({ lit })
      await a.wait(80)
    }
    await a.wait(700)
    return
  }
  await a.wait(1000)
  await a.move({ at: 'row-49', x: 0.55, y: 0.5 })
  await a.wait(150)
  await a.click()
  a.mark('swap')
  await a.set({ art: '49', lit: 0 })
  // Off the list, to quiet surface beside the heading line
  await a.move('rest', { duration: 650 })
  await a.wait(250)
  for (const lit of [1, 2, 3]) {
    await a.set({ lit })
    await a.wait(lit === 3 ? 300 : 700)
  }
  a.mark('payoff')
  await a.wait(2600)
  await a.move({ at: 'row-48', x: 0.55, y: 0.5 })
  await a.wait(150)
  await a.click()
  await a.set({ art: '48', lit: 9 })
  await a.move('rest', { duration: 650 })
  await a.wait(900)
}

function Segs({ segs, on }: { segs: Seg[]; on: boolean }) {
  return (
    <>
      {segs.map((g, i) =>
        typeof g === 'string' ? <span key={i}>{g}</span> : <mark key={i} data-on={on || undefined}>{g[0]}</mark>,
      )}
    </>
  )
}

function Diff({ art, lit, staticLit, show }: { art: Art; lit: number; staticLit: boolean; show: boolean }) {
  return (
    <div className="ch-diff" data-show={show || undefined} aria-hidden={!show}>
      {art.rows.slice(0, 11).map((r, i) => (
        <div key={i} className={`ch-line ch-${r.k}`} data-hdr={r.hdr || undefined}>
          <span className="ch-num">{r.k === 'add' ? '' : r.n}</span>
          <span className="ch-num">{r.k === 'del' ? '' : r.k === 'ctx' ? r.m : r.n}</span>
          <span className="ch-sign">{r.k === 'add' ? '+' : r.k === 'del' ? '−' : ''}</span>
          <span className="ch-code">
            <Segs segs={r.s} on={staticLit || lit >= levelOf(i)} />
          </span>
        </div>
      ))}
    </div>
  )
}

function Title({ art, show, compact }: { art: Art; show: boolean; compact: boolean }) {
  return (
    <span className="ch-title" data-show={show || undefined}>
      {art.label}
      {!compact && (
        <span className="ch-from">
          <span className="ch-arrow">←</span>գործող՝ հոդվ. {art.from.join(', ')}
        </span>
      )}
    </span>
  )
}

function Blocks({ add, del }: { add: number; del: number }) {
  const a = Math.round((add / (add + del)) * 5)
  return (
    <span className="ch-blocks">
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} data-k={i < a ? 'a' : 'd'} />
      ))}
    </span>
  )
}

export default function ConstiffHero({ theme = 'dark' }: { theme?: 'dark' | 'light' }) {
  return (
    <Stage<S>
      theme={theme}
      width={960}
      height={440}
      compact={{ below: 760, width: 358, height: 420 }}
      initial={initial}
      poster={POSTER}
      script={script}
      cursor={{ at: { wide: { x: 760, y: 222 }, compact: { x: 300, y: 380 } } }}
      className="ch"
    >
      {(s, rect, layout) => {
        const compact = layout === 'compact'
        const art = s.art === '49' ? A49 : A48
        let lastCh = 0
        return (
          <>
            <Window url="khachatour.github.io/constiff" urlShape="pill" className="ch-win">
              <div className="ch-page">
                <div className="ch-top">
                  <span className="ch-logo">±</span>
                  <span className="ch-name">Սահմանադրություն․ գործող → նախագիծ</span>
                </div>
                <div className="ch-layout">
                  {!compact && (
                    <aside className="ch-side">
                      {SIDE.map((r) => {
                        const head = r.ch !== lastCh ? CHAPTERS.find((c) => c.n === r.ch) : null
                        lastCh = r.ch
                        return (
                          <div key={r.n} className="ch-group">
                            {head && (
                              <div className="ch-chapter">
                                Գլուխ {head.n}. {head.t}
                              </div>
                            )}
                            <div className="ch-row" data-target={`row-${r.n}`} data-cursor="pointer" data-active={r.n === s.art || undefined}>
                              <span className="ch-badge">{r.st}</span>
                              <span className="ch-nm">
                                {r.n}. {r.t}
                              </span>
                              <span className="ch-st">
                                <span className="ch-plus">+{r.add}</span> <span className="ch-minus">−{r.del}</span>
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </aside>
                  )}
                  <section className="ch-file">
                    <div className="ch-fhead">
                      <span className="ch-caret">▾</span>
                      <span className="ch-badge">M</span>
                      <span className="ch-titles">
                        <Title art={A48} show={s.art === '48'} compact={compact} />
                        <Title art={A49} show={s.art === '49'} compact={compact} />
                      </span>
                      {!compact && (
                        <span className="ch-counts">
                          <span className="ch-plus ch-n">
                            <span>+</span>
                            <Count value={art.add} />
                          </span>
                          <span className="ch-minus ch-n">
                            <span>−</span>
                            <Count value={art.del} />
                          </span>
                          <Blocks add={art.add} del={art.del} />
                        </span>
                      )}
                    </div>
                    <div className="ch-body">
                      <Diff art={A48} lit={9} staticLit show={s.art === '48'} />
                      <Diff art={A49} lit={s.lit} staticLit={false} show={s.art === '49'} />
                    </div>
                  </section>
                </div>
              </div>
            </Window>
            {!compact && <Follow className="ch-sel" to={rect(`row-${s.art}`)} />}
            <span className="ch-rest" data-target="rest" />
          </>
        )
      }}
    </Stage>
  )
}
