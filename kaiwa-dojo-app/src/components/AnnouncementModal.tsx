import { useState, useEffect } from 'react'
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

  // Reset index when modal opens or announcements change
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0)
    }
  }, [isOpen, announcements.length])

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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="announcement-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Modal Card */}
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] transition-all transform scale-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Japanese Dojo Accent Banner */}
        <div className={`h-2.5 w-full bg-gradient-to-r ${catConfig.bgGradient.replace('to-transparent', 'to-primary')} bg-primary`} />

        {/* Modal Header */}
        <div className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800/80 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-gradient-to-br from-primary/15 to-red-500/20 text-primary dark:text-red-400 flex items-center justify-center text-xl shadow-xs border border-primary/20 shrink-0">
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
                <span className="text-[11px] font-black uppercase tracking-wider text-primary dark:text-red-400 font-jp">
                  お知らせ • PENGUMUMAN DOJO
                </span>
                {current.is_pinned && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <svg className="size-2.5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                    <span>Di-Pin</span>
                  </span>
                )}
                <span
                  className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${catConfig.badgeClass}`}
                >
                  {catConfig.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
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

        {/* Multiple announcements pagination tabs */}
        {isMultiple && (
          <div className="px-6 py-2 bg-slate-50/80 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold">
              Pengumuman {currentIndex + 1} dari {total}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePrev}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer flex items-center gap-1"
              >
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                <span>Sebelumnya</span>
              </button>
              <button
                onClick={handleNext}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer flex items-center gap-1"
              >
                <span>Berikutnya</span>
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* Modal Body / Content */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-700 dark:text-slate-200 space-y-4">
          <h2
            id="announcement-title"
            className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight"
          >
            {current.title}
          </h2>

          <div className="text-sm sm:text-base leading-relaxed whitespace-pre-line break-words font-normal text-slate-700 dark:text-slate-200 space-y-2.5 bg-slate-50/70 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80">
            {current.content}
          </div>

          {/* Optional Action Button */}
          {current.action_url && current.action_text && (
            <div className="pt-2">
              <button
                onClick={() => handleActionClick(current.action_url!)}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-primary text-white font-bold text-sm shadow-md hover:shadow-lg hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
              >
                <span>{current.action_text}</span>
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center sm:text-left">
            {current.is_read ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Sudah pernah Anda baca</span>
              </span>
            ) : (
              <span>Pengumuman resmi dari manajemen KaiwaDojo.</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isMultiple && (
              <button
                onClick={handleAcknowledgeAll}
                disabled={marking}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-750 transition-all cursor-pointer"
              >
                Tandai Semua Dibaca
              </button>
            )}

            <button
              onClick={handleDismissCurrent}
              disabled={marking}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-dark active:scale-95 text-white text-xs font-black shadow-sm transition-all border-none cursor-pointer flex items-center justify-center gap-1.5"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              <span>{marking ? 'Menyimpan...' : 'Saya Mengerti'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
