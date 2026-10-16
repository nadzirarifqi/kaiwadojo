import { useState, useEffect } from 'react'
import { JAPAN_FACTS, getDailyFactIndex, type JapanFactCategory } from '../data/japanFacts'
import { getTodayDateString } from '../lib/dailyMission'

const CATEGORY_STYLE: Record<JapanFactCategory, string> = {
  Bahasa: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  Budaya: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  Sejarah: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  Kuliner: 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300',
  Alam: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  Teknologi: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  Etiket: 'bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
  Kehidupan: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
  Tradisi: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300',
  'Pop Culture': 'bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300',
}

function loadSeen(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key)
    return new Set(raw ? (JSON.parse(raw) as number[]) : [])
  } catch {
    return new Set()
  }
}

/**
 * Kartu "Fakta Jepang Hari Ini": satu fakta berganti tiap hari, bisa dijelajahi (‹ › / acak),
 * detail panjang disembunyikan di balik "Selengkapnya", dan jumlah fakta yang sudah dibaca dicatat.
 */
export default function JapanFactCard({ userId }: { userId?: string | null }) {
  const todayStr = getTodayDateString()
  const dailyIndex = getDailyFactIndex(todayStr)
  const seenKey = `kaiwa_seen_facts_${userId || 'guest'}`

  const [index, setIndex] = useState(dailyIndex)
  const [expanded, setExpanded] = useState(false)
  const [seen, setSeen] = useState<Set<number>>(() => loadSeen(seenKey))

  const fact = JAPAN_FACTS[index]
  const total = JAPAN_FACTS.length
  const isDaily = index === dailyIndex

  // Catat fakta yang sudah dilihat (per user, di perangkat ini)
  useEffect(() => {
    setSeen(prev => {
      if (prev.has(fact.id)) return prev
      const next = new Set(prev).add(fact.id)
      try { localStorage.setItem(seenKey, JSON.stringify([...next])) } catch { /* storage penuh/diblokir */ }
      return next
    })
  }, [fact.id, seenKey])

  function go(nextIndex: number) {
    setIndex(((nextIndex % total) + total) % total)
    setExpanded(false)
  }

  function goRandom() {
    // Utamakan fakta yang belum pernah dibaca
    const unseen = JAPAN_FACTS.map((_, i) => i).filter(i => !seen.has(JAPAN_FACTS[i].id) && i !== index)
    const pool = unseen.length > 0 ? unseen : JAPAN_FACTS.map((_, i) => i).filter(i => i !== index)
    go(pool[Math.floor(Math.random() * pool.length)])
  }

  const navBtn = 'size-10 shrink-0 rounded-xl flex items-center justify-center border-none cursor-pointer transition-colors bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'

  return (
    <section aria-label="Fakta Jepang" className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="p-4 sm:p-5 flex gap-3.5 sm:gap-4">
        <div className="shrink-0 size-14 sm:size-16 rounded-2xl bg-gradient-to-br from-rose-600 via-rose-700 to-indigo-900 text-white flex items-center justify-center shadow-sm">
          <span className="font-serif font-black text-xl sm:text-2xl leading-none">{Array.from(fact.kanji)[0]}</span>
        </div>

        <div className="min-w-0 flex-1" aria-live="polite">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1">
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              {isDaily ? 'Fakta Jepang Hari Ini' : 'Fakta Jepang'}
            </span>
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_STYLE[fact.category]}`}>
              {fact.category}
            </span>
            <span className="ml-auto text-[11px] font-semibold text-slate-400 tabular-nums">#{fact.id}/{total}</span>
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">{fact.title}</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            <span className="font-serif font-semibold text-slate-700 dark:text-slate-300">{fact.kanji}</span> · {fact.reading}
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed mt-2">{fact.fact}</p>

          {expanded && (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border-l-4 border-rose-400 animate-fade-in">
              {fact.detail}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60">
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
          aria-expanded={expanded}
          className="h-10 px-2 -ml-2 rounded-lg text-sm font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 bg-transparent border-none cursor-pointer flex items-center gap-1.5"
        >
          {expanded ? 'Tutup' : 'Selengkapnya'}
          <svg className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline text-xs text-slate-500 dark:text-slate-400 mr-1.5">
            {seen.size}/{total} fakta dijelajahi
          </span>
          <button type="button" onClick={() => go(index - 1)} aria-label="Fakta sebelumnya" className={navBtn}>
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button type="button" onClick={goRandom} aria-label="Fakta acak" title="Fakta acak" className={navBtn}>
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Fakta berikutnya" className={navBtn}>
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
          {!isDaily && (
            <button
              type="button"
              onClick={() => go(dailyIndex)}
              className="h-10 px-3 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 bg-transparent border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
            >
              Hari ini
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
