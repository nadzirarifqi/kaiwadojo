import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  type Announcement,
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
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
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
    .replace(/[\u2713\u2714\u2611\u2705]/g, '• ')
}

export default function AnnouncementModal({
  isOpen,
  onClose,
  announcements,
  onMarkRead,
  onMarkAllRead,
}: AnnouncementModalProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [marking, setMarking] = useState(false)

  // Reset index saat modal dibuka atau daftar pengumuman berubah
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0)
    }
  }, [isOpen, announcements.length])

  // Kunci scroll halaman belakang dan dukung tombol Escape
  useEffect(() => {
    if (!isOpen) return

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || announcements.length === 0) {
    return null
  }

  const current = announcements[currentIndex] || announcements[0]
  const catConfig = CATEGORY_CONFIG[current.category] || CATEGORY_CONFIG.info
  const total = announcements.length
  const isMultiple = total > 1

  function handlePrev() {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : total - 1))
  }

  function handleNext() {
    setCurrentIndex(prev => (prev < total - 1 ? prev + 1 : 0))
  }

  async function handleDismissCurrent() {
    if (profile?.id && current?.id) {
      setMarking(true)
      await markAnnouncementAsRead(profile.id, current.id)
      if (onMarkRead) onMarkRead(current.id)
      setMarking(false)
    }

    if (isMultiple && currentIndex < total - 1) {
      setCurrentIndex(prev => prev + 1)
    } else {
      onClose()
    }
  }

  async function handleAcknowledgeAll() {
    if (profile?.id && announcements.length > 0) {
      setMarking(true)
      const ids = announcements.map(a => a.id)
      await markAllAnnouncementsAsRead(profile.id, ids)
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

  const modalElement = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200 select-none"
      onClick={onClose}
    >
      {/* ── Modern Notice Board Card (Papan Pengumuman Modern) ── */}
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border-2 border-slate-200/90 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[82vh] transition-all transform scale-100 my-auto select-text"
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative Top Board Pin */}
        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center pointer-events-none">
          <div className="size-3.5 rounded-full bg-gradient-to-br from-primary via-red-500 to-amber-500 shadow-md ring-4 ring-white dark:ring-slate-900 flex items-center justify-center">
            <div className="size-1 rounded-full bg-white/90" />
          </div>
        </div>

        {/* Top Japanese Dojo Accent Strip */}
        <div className={`h-2 w-full bg-gradient-to-r ${catConfig.bgGradient.replace('to-transparent', 'to-primary')} bg-primary`} />

        {/* ── Board Header ── */}
        <div className="pt-5 sm:pt-6 px-5 sm:px-6 pb-3.5 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-3 bg-gradient-to-b from-amber-50/40 via-white to-transparent dark:from-slate-850/60 dark:via-slate-900">
          <div className="flex items-center gap-3">
            <div className="size-10 sm:size-11 rounded-2xl bg-gradient-to-br from-primary/15 to-red-500/20 text-primary dark:text-red-400 flex items-center justify-center text-lg sm:text-xl shadow-xs border border-primary/20 shrink-0">
              {current.category === 'important' ? (
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              ) : current.category === 'update' ? (
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              ) : current.category === 'event' ? (
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ) : current.category === 'maintenance' ? (
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
              ) : (
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-primary dark:text-red-400 font-jp">
                  掲示板 • PAPAN PENGUMUMAN DOJO
                </span>
                {current.is_pinned && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                    <svg className="size-3 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                    <span>Disematkan</span>
                  </span>
                )}
                <span
                  className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${catConfig.badgeClass}`}
                >
                  {catConfig.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                {current.author_name || 'Admin Dojo'} • {formatDate(current.created_at)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Tutup Pengumuman"
            className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-all border-none cursor-pointer shrink-0"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* ── Multiple Announcements Pagination Bar ── */}
        {isMultiple && (
          <div className="px-5 sm:px-6 py-2 bg-slate-50/90 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700 dark:text-slate-200">
                Pengumuman {currentIndex + 1} dari {total}
              </span>
              <div className="flex items-center gap-1 ml-1">
                {announcements.map((_, idx) => (
                  <span
                    key={idx}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentIndex
                        ? 'w-4 bg-primary'
                        : 'w-1.5 bg-slate-300 dark:bg-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrev}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer"
              >
                Sebelumnya
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}

        {/* ── Board Body / Announcement Content ── */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          <h2
            id="announcement-title"
            className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-snug"
          >
            {sanitizeNoticeText(current.title)}
          </h2>

          {/* Styled Notice Sheet on the Board */}
          <div className="bg-gradient-to-br from-slate-50/90 to-amber-50/20 dark:from-slate-950/60 dark:to-slate-900/40 p-4 sm:p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 shadow-xs">
            <div className="text-sm sm:text-base leading-relaxed whitespace-pre-line break-words font-medium text-slate-700 dark:text-slate-200 space-y-2">
              {sanitizeNoticeText(current.content)}
            </div>
          </div>

          {/* Optional Action Button */}
          {current.action_url && current.action_text && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => handleActionClick(current.action_url!)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold text-sm shadow-md hover:shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
              >
                <span>{sanitizeNoticeText(current.action_text)}</span>
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* ── Board Footer ── */}
        <div className="p-4 sm:p-5 bg-slate-50/90 dark:bg-slate-950/70 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left flex items-center gap-2">
            {current.is_read ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>Sudah pernah dibaca</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
                <span className="size-1.5 rounded-full bg-primary" />
                <span>Pengumuman resmi kaiwadojo</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isMultiple && (
              <button
                type="button"
                onClick={handleAcknowledgeAll}
                disabled={marking}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer"
              >
                Tandai Semua Dibaca
              </button>
            )}

            <button
              type="button"
              onClick={handleDismissCurrent}
              disabled={marking}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark active:scale-95 text-white text-xs font-black shadow-sm transition-all border-none cursor-pointer"
            >
              <span>{marking ? 'Menyimpan...' : 'Saya Mengerti'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modalElement, document.body)
}
