import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import FeedbackModal from './FeedbackModal'
import { AppConfig } from '../config/appConfig'

/** Ada modal lain yang sedang terbuka? (semua overlay modal memakai class "modal-overlay") */
function isAnyModalInDOM(): boolean {
  if (typeof document === 'undefined') return false
  return Array.from(document.querySelectorAll('.modal-overlay, [aria-modal="true"]')).some(
    el => !el.closest('#floating-action-widgets'),
  )
}

const WA_ICON_PATH =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z'

/**
 * Tombol bantuan melayang (kanan bawah). Satu tombol membuka menu kecil berisi:
 * chat admin via WhatsApp dan kirim masukan. Disembunyikan otomatis saat ada modal lain terbuka.
 */
export default function WhatsAppWidget() {
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)
  const [isDomModalOpen, setIsDomModalOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const checkModal = () => setIsDomModalOpen(isAnyModalInDOM())
    checkModal()
    const observer = new MutationObserver(checkModal)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  // Tutup menu saat pindah halaman, klik di luar, atau menekan Escape
  useEffect(() => { setIsMenuOpen(false) }, [location.pathname])
  useEffect(() => {
    if (!isMenuOpen) return
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsMenuOpen(false) }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [isMenuOpen])

  // Masukan tidak ditampilkan di landing, login, dan registrasi
  const normalizedPath = location.pathname.toLowerCase().replace(/\/+$/, '') || '/'
  const isAuthOrLandingPage = ['/', '/login', '/register', '/admin'].includes(normalizedPath)

  const waUrl = `https://wa.me/${AppConfig.contacts.getAdminWaFormatted()}?text=${encodeURIComponent('Halo Admin kaiwadojo, saya ingin bertanya mengenai aplikasi...')}`

  function handleOpenWhatsApp() {
    window.open(waUrl, '_blank', 'noopener,noreferrer')
    setIsMenuOpen(false)
  }

  function handleOpenFeedback() {
    setIsMenuOpen(false)
    setIsFeedbackOpen(true)
  }

  const isHidden = isDomModalOpen || isFeedbackOpen

  const menuItem =
    'w-full flex items-center gap-3 p-2.5 rounded-xl text-left bg-transparent border-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'

  return (
    <>
      <div
        id="floating-action-widgets"
        ref={rootRef}
        className={`fixed right-4 sm:right-6 bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6 z-50 flex flex-col items-end gap-3 transition-all duration-200 ${
          isHidden ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100'
        }`}
      >
        {/* Menu bantuan */}
        {isMenuOpen && (
          <div
            role="menu"
            aria-label="Bantuan"
            className="w-[min(18rem,calc(100vw-2rem))] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-2 animate-fade-in-up origin-bottom-right"
          >
            <p className="px-2.5 pt-1.5 pb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Butuh bantuan?</p>

            <button type="button" role="menuitem" onClick={handleOpenWhatsApp} className={menuItem}>
              <span className="size-10 shrink-0 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                <svg className="size-5 fill-current" viewBox="0 0 24 24"><path d={WA_ICON_PATH} /></svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">Chat Admin</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Jadwal, pendaftaran, atau akun</span>
              </span>
              <svg className="size-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </button>

            {!isAuthOrLandingPage && (
              <button type="button" role="menuitem" onClick={handleOpenFeedback} className={menuItem}>
                <span className="size-10 shrink-0 rounded-xl bg-amber-500 text-white flex items-center justify-center">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">Kirim Masukan</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">Saran fitur, bug, atau materi</span>
                </span>
              </button>
            )}
          </div>
        )}

        {/* Tombol utama */}
        <button
          type="button"
          onClick={() => setIsMenuOpen(v => !v)}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label={isMenuOpen ? 'Tutup menu bantuan' : 'Buka menu bantuan'}
          className={`h-12 rounded-full shadow-lg hover:shadow-xl border-none cursor-pointer flex items-center justify-center gap-2 transition-all active:scale-95 ${
            isMenuOpen
              ? 'w-12 bg-slate-800 dark:bg-slate-700 text-white'
              : 'w-12 sm:w-auto sm:px-4 bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          {isMenuOpen ? (
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <>
              <svg className="size-6 fill-current shrink-0" viewBox="0 0 24 24"><path d={WA_ICON_PATH} /></svg>
              <span className="hidden sm:inline text-sm font-bold">Bantuan</span>
            </>
          )}
        </button>
      </div>

      {!isAuthOrLandingPage && (
        <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
      )}
    </>
  )
}
