import { useState } from 'react'
import FeedbackModal from './FeedbackModal'

export default function WhatsAppWidget() {
  const [isWaOpen, setIsWaOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

  const rawAdminNumber = import.meta.env.VITE_ADMIN_WA_NUMBER || '6287875018001'
  let adminWaNumber = rawAdminNumber.replace(/[^0-9]/g, '')
  if (adminWaNumber.startsWith('0')) {
    adminWaNumber = '62' + adminWaNumber.slice(1)
  }

  const defaultMessage = encodeURIComponent('Halo Admin KaiwaDojo, saya ingin bertanya mengenai aplikasi...')
  const waUrl = `https://wa.me/${adminWaNumber}?text=${defaultMessage}`

  function handleOpenWhatsApp() {
    window.open(waUrl, '_blank', 'noopener,noreferrer')
    setIsWaOpen(false)
  }

  return (
    <>
      {/* Floating Action Buttons Group (Bottom Right) */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2.5 sm:gap-3">
        
        {/* 1. Floating Feedback & Saran Trigger Button */}
        <div className="flex items-center gap-2 group">
          {/* Tooltip on desktop */}
          <span className="hidden md:inline-block px-3 py-1.5 rounded-xl bg-slate-900/90 dark:bg-slate-800/90 text-white text-xs font-bold shadow-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap border border-slate-700/50">
            💡 Kirim Masukan & Saran
          </span>

          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
            aria-label="Kirim Masukan & Saran untuk Website KaiwaDojo"
            className="relative size-12 sm:size-13 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center border-none overflow-visible group/btn"
          >
            {/* Ambient Pulse Ring */}
            <span className="absolute -inset-1 rounded-full bg-amber-500/25 animate-pulse [animation-duration:4s] pointer-events-none" />

            {/* Sparkle Notification Dot */}
            <span className="absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-amber-300 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[0.55rem]">
              ✨
            </span>

            {/* Lightbulb Icon */}
            <span className="text-xl sm:text-2xl relative z-10 select-none group-hover/btn:rotate-12 transition-transform duration-200">
              💡
            </span>
          </button>
        </div>

        {/* 2. Floating WhatsApp Trigger Button */}
        <div className="flex items-center gap-2 group">
          {/* Tooltip on desktop */}
          <span className="hidden md:inline-block px-3 py-1.5 rounded-xl bg-slate-900/90 dark:bg-slate-800/90 text-white text-xs font-bold shadow-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap border border-slate-700/50">
            💬 Hubungi Admin via WhatsApp
          </span>

          <button
            type="button"
            onClick={() => setIsWaOpen(true)}
            aria-label="Hubungi Admin KaiwaDojo via WhatsApp"
            className="relative size-13 sm:size-14 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center border-none overflow-visible"
          >
            {/* Ambient Pulse Ring */}
            <span className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-pulse [animation-duration:3.5s] pointer-events-none" />

            {/* Online Notification Dot */}
            <span className="absolute top-0.5 right-0.5 size-3.5 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900" />

            {/* WhatsApp SVG Icon */}
            <svg className="size-6 sm:size-7 fill-current relative z-10" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
            </svg>
          </button>
        </div>

      </div>

      {/* Feedback Modal */}
      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
      />

      {/* WhatsApp Confirmation Modal */}
      {isWaOpen && (
        <div className="fixed inset-0 z-[999] flex flex-col p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-up text-center relative overflow-hidden my-auto mx-auto max-h-[90dvh] overflow-y-auto">

            {/* Header Icon */}
            <div className="size-16 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-4 border border-emerald-200 dark:border-emerald-800/80">
              💬
            </div>

            {/* Title & Body */}
            <h3 className="text-lg font-black text-slate-800 dark:text-white mb-2">
              Hubungi Admin via WhatsApp?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-medium">
              Apakah kamu ingin menghubungi Tim Admin KaiwaDojo untuk informasi pendaftaran, materi, atau bantuan akun?
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl border-none cursor-pointer transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>💬</span>
                <span>Buka Chat WhatsApp →</span>
              </button>

              <button
                type="button"
                onClick={() => setIsWaOpen(false)}
                className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-2xl border-none cursor-pointer transition-all"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
