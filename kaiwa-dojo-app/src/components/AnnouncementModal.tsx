import { useState, useEffect, useRef, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  type Announcement,
  type AnnouncementCategory,
  CATEGORY_CONFIG,
  markAnnouncementAsRead,
  markAllAnnouncementsAsRead,
} from '../lib/announcementService'
import { useAuth } from '../hooks/useAuth'

interface AnnouncementModalProps {
  isOpen: boolean
  onClose: () => void
  announcements: Announcement[]
  onMarkRead?: (id: string) => void
  onMarkAllRead?: () => void
  autoAdvance?: boolean
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return formatDate(dateStr)
  const diffMin = Math.round((Date.now() - d.getTime()) / 60000)
  if (diffMin < 1) return 'Baru saja'
  if (diffMin < 60) return `${diffMin} menit lalu`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour} jam lalu`
  const diffDay = Math.round(diffHour / 24)
  if (diffDay === 1) return 'Kemarin'
  if (diffDay < 7) return `${diffDay} hari lalu`
  return formatDate(dateStr)
}

/**
 * Sanitasi konten pengumuman agar bebas dari penulisan panah (->, →) dan simbol ceklis (✓, ✔).
 */
function sanitizeNoticeText(text: string): string {
  if (!text) return ''
  return text
    .replace(/-->/g, ' — ')
    .replace(/->/g, ' — ')
    .replace(/→/g, ' — ')
    .replace(/=>/g, ' — ')
    .replace(/[✓✔☑✅]/g, '• ')
}

/** Ubah URL di dalam teks menjadi tautan yang bisa diklik (teks lain tetap di-escape oleh React). */
function linkify(text: string): ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g)
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary dark:text-primary-lighter font-semibold underline underline-offset-2 break-all"
      >
        {part}
      </a>
    ) : (
      part
    ),
  )
}

const CATEGORY_TONE: Record<AnnouncementCategory, { tile: string; chip: string }> = {
  important: { tile: 'bg-rose-500 text-white', chip: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
  update: { tile: 'bg-indigo-500 text-white', chip: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' },
  event: { tile: 'bg-amber-500 text-white', chip: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
  info: { tile: 'bg-teal-500 text-white', chip: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300' },
  maintenance: { tile: 'bg-slate-600 text-white', chip: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
}

function CategoryIcon({ category }: { category: AnnouncementCategory }) {
  const common = { className: 'size-5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2 } as const
  if (category === 'important') {
    return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
  }
  if (category === 'update') {
    return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
  }
  if (category === 'event') {
    return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  }
  if (category === 'maintenance') {
    return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
  }
  return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}

/**
 * Papan pengumuman: bottom sheet di HP, dialog di desktop.
 * Beberapa pengumuman bisa dijelajahi dengan tombol ‹ ›, titik indikator, atau geser (swipe) di HP.
 */
export default function AnnouncementModal({
  isOpen,
  onClose,
  announcements,
  onMarkRead,
  onMarkAllRead,
}: AnnouncementModalProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  // Posisi dilacak per id (bukan indeks) agar tidak melompat saat daftar berubah setelah ditandai dibaca
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)
  const touchStartX = useRef<number | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) setCurrentId(announcements[0]?.id ?? null)
    // hanya saat modal dibuka
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Kembali ke atas saat berpindah pengumuman
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: 0 })
  }, [currentId])

  if (!isOpen || announcements.length === 0) {
    return null
  }

  const foundIndex = announcements.findIndex(a => a.id === currentId)
  const currentIndex = foundIndex >= 0 ? foundIndex : 0
  const current = announcements[currentIndex]
  const catConfig = CATEGORY_CONFIG[current.category] || CATEGORY_CONFIG.info
  const tone = CATEGORY_TONE[current.category] || CATEGORY_TONE.info
  const total = announcements.length
  const isMultiple = total > 1
  const isLast = currentIndex === total - 1
  const unreadCount = announcements.filter(a => !a.is_read).length

  function goTo(index: number) {
    const next = announcements[(index + total) % total]
    if (next) setCurrentId(next.id)
  }

  async function handleDismissCurrent() {
    const nextItem = !isLast ? announcements[currentIndex + 1] : null
    if (profile?.id && current?.id && !current.is_read) {
      setMarking(true)
      await markAnnouncementAsRead(profile.id, current.id)
      if (onMarkRead) onMarkRead(current.id)
      setMarking(false)
    }
    if (nextItem) setCurrentId(nextItem.id)
    else onClose()
  }

  async function handleAcknowledgeAll() {
    if (profile?.id && announcements.length > 0) {
      setMarking(true)
      await markAllAnnouncementsAsRead(profile.id, announcements.map(a => a.id))
      if (onMarkAllRead) onMarkAllRead()
      setMarking(false)
    }
    onClose()
  }

  function handleActionClick(url: string) {
    if (!url) return
    onClose()
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      navigate(url)
    }
  }

  function handleTouchEnd(e: ReactTouchEvent) {
    if (!isMultiple || touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 60) return
    goTo(dx < 0 ? currentIndex + 1 : currentIndex - 1)
  }

  const navBtn = 'size-10 shrink-0 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer transition-colors'

  const modalElement = (
    <div
      className="modal-overlay fixed inset-0 z-[99999] flex items-end sm:items-center justify-center sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
        className="relative w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[85dvh] animate-fade-in-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-3 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-3">
            <span className="size-10 shrink-0 rounded-xl bg-primary/10 text-primary dark:text-primary-lighter flex items-center justify-center">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">Papan Pengumuman</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                <span className="font-serif">掲示板</span>
                {unreadCount > 0 ? ` · ${unreadCount} belum dibaca` : ' · Semua sudah dibaca'}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Tutup pengumuman" className={navBtn}>
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* Navigasi antar pengumuman */}
          {isMultiple && (
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={() => goTo(currentIndex - 1)} aria-label="Pengumuman sebelumnya" className={navBtn}>
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </button>
              <div className="flex-1 min-w-0 flex flex-col items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {currentIndex + 1} dari {total}
                </span>
                <div className="flex items-center gap-1 max-w-full overflow-hidden">
                  {announcements.map((a, idx) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => goTo(idx)}
                      aria-label={`Pengumuman ${idx + 1}${a.is_read ? '' : ' (belum dibaca)'}`}
                      aria-current={idx === currentIndex ? 'true' : undefined}
                      className="p-1 bg-transparent border-none cursor-pointer"
                    >
                      <span className={`block h-1.5 rounded-full transition-all ${
                        idx === currentIndex
                          ? 'w-5 bg-primary'
                          : a.is_read ? 'w-1.5 bg-slate-300 dark:bg-slate-700' : 'w-1.5 bg-primary/40'
                      }`} />
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => goTo(currentIndex + 1)} aria-label="Pengumuman berikutnya" className={navBtn}>
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}
        </div>

        {/* Isi pengumuman */}
        <div
          ref={bodyRef}
          className="flex-1 min-h-0 overflow-y-auto px-5 py-5"
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
          onTouchEnd={handleTouchEnd}
        >
          <article key={current.id} className="animate-fade-in">
            <div className="flex items-start gap-3">
              <span className={`size-11 shrink-0 rounded-2xl flex items-center justify-center ${tone.tile}`}>
                <CategoryIcon category={current.category} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${tone.chip}`}>{catConfig.label}</span>
                  {current.is_pinned && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 flex items-center gap-1">
                      <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                      Disematkan
                    </span>
                  )}
                  {!current.is_read && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-primary text-white">Baru</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5" title={formatDate(current.created_at)}>
                  {current.author_name || 'Admin Dojo'} · {formatRelative(current.created_at)}
                </p>
              </div>
            </div>

            <h2 id="announcement-title" className="mt-4 text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {sanitizeNoticeText(current.title)}
            </h2>

            <div className="mt-2.5 text-[15px] leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-line break-words">
              {linkify(sanitizeNoticeText(current.content))}
            </div>

            {current.expires_at && (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Berlaku hingga {formatDate(current.expires_at)}
              </p>
            )}

            {current.action_url && current.action_text && (
              <button
                type="button"
                onClick={() => handleActionClick(current.action_url!)}
                className="mt-4 w-full h-11 px-4 rounded-xl bg-white dark:bg-slate-900 border border-primary/40 text-primary dark:text-primary-lighter hover:bg-primary/5 dark:hover:bg-primary/10 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <span className="truncate">{sanitizeNoticeText(current.action_text)}</span>
                <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            )}
          </article>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
          {isMultiple && unreadCount > 1 && (
            <button
              type="button"
              onClick={handleAcknowledgeAll}
              disabled={marking}
              className="h-11 px-3.5 rounded-xl bg-transparent border-none text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-50"
            >
              Tandai semua dibaca
            </button>
          )}
          <button
            type="button"
            onClick={handleDismissCurrent}
            disabled={marking}
            className="ml-auto flex-1 sm:flex-none h-11 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            {marking ? 'Menyimpan…' : isLast ? 'Mengerti' : (
              <>
                Mengerti, lanjut
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modalElement, document.body)
}
