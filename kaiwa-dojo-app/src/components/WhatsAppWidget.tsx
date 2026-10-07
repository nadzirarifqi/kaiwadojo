import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import FeedbackModal from './FeedbackModal'
import { AppConfig } from '../config/appConfig'

export default function WhatsAppWidget() {
  const location = useLocation()
  const [isWaOpen, setIsWaOpen] = useState(false)
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false)

  // Hide feedback button specifically on landing page, login, and registration pages
  const normalizedPath = location.pathname.toLowerCase().replace(/\/+$/, '') || '/'
  const isAuthOrLandingPage = ['/', '/login', '/register', '/admin'].includes(normalizedPath)

  const adminWaNumber = AppConfig.contacts.getAdminWaFormatted()
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
        
        {/* 1. Floating Feedback & Saran Trigger Button (Hidden on Landing, Login, Register) */}
        {!isAuthOrLandingPage && (
          <div className="flex items-center gap-2 group">
            <span className="hidden md:inline-block px-3 py-1.5 rounded-xl bg-slate-900/90 dark:bg-slate-800/90 text-white text-xs font-bold shadow-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap border border-slate-700/50">
              Kirim Masukan & Saran
            </span>

            <button
              type="button"
              onClick={() => setIsFeedbackOpen(true)}
              aria-label="Kirim Masukan & Saran untuk Website KaiwaDojo"
              className="relative size-12 sm:size-13 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center border-none overflow-visible"
            >
              <svg className="size-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </button>
          </div>
        )}

        {/* 2. Floating WhatsApp Trigger Button */}
        <div className="flex items-center gap-2 group">
          <span className="hidden md:inline-block px-3 py-1.5 rounded-xl bg-slate-900/90 dark:bg-slate-800/90 text-white text-xs font-bold shadow-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap border border-slate-700/50">
            Hubungi Admin WhatsApp
          </span>

          <button
            type="button"
            onClick={() => setIsWaOpen(true)}
            aria-label="Hubungi Admin KaiwaDojo via WhatsApp"
            className="relative size-12 sm:size-13 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer flex items-center justify-center border-none overflow-visible"
          >
            {/* Ambient Pulse Ring */}
            <span className="absolute -inset-1 rounded-full bg-emerald-500/25 animate-pulse [animation-duration:3.5s] pointer-events-none" />

            {/* Online Status Dot */}
            <span className="absolute top-0 right-0 size-3 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-900" />

            {/* WhatsApp SVG Icon */}
            <svg className="size-6 fill-current relative z-10" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.983.536 1.776.814 2.791.814 3.18 0 5.766-2.587 5.767-5.766.001-3.18-2.585-5.766-5.767-5.766zm3.376 8.21c-.141.396-.704.723-1.077.781-.354.055-.788.083-2.316-.549-1.954-.809-3.21-2.799-3.308-2.929-.098-.13-1.229-1.636-1.229-3.12 0-1.484.776-2.213 1.053-2.518.277-.306.604-.383.805-.383.201 0 .402.002.578.01.186.009.434-.07.679.519.255.612.868 2.119.943 2.273.076.153.126.333.025.534-.1.2-.15.326-.299.499-.148.174-.313.388-.447.521-.148.147-.303.307-.13.606.173.299.769 1.269 1.651 2.054 1.135 1.01 2.091 1.323 2.39 1.472.298.149.472.13.647-.07.175-.2.753-.878.955-1.179.201-.301.402-.251.678-.151.276.1.175.776.85 1.151.675.375.141.574.226.772.085.198-.056.704-.381 1.077z" />
            </svg>
          </button>
        </div>

      </div>

      {/* Feedback Modal */}
      {!isAuthOrLandingPage && (
        <FeedbackModal
          isOpen={isFeedbackOpen}
          onClose={() => setIsFeedbackOpen(false)}
        />
      )}

      {/* WhatsApp Confirmation Modal */}
      {isWaOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-up text-center relative overflow-hidden">
            
            <div className="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
              <svg className="size-7 fill-current" viewBox="0 0 24 24">
                <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.598 2.669-.699c.983.536 1.776.814 2.791.814 3.18 0 5.766-2.587 5.767-5.766.001-3.18-2.585-5.766-5.767-5.766zm3.376 8.21c-.141.396-.704.723-1.077.781-.354.055-.788.083-2.316-.549-1.954-.809-3.21-2.799-3.308-2.929-.098-.13-1.229-1.636-1.229-3.12 0-1.484.776-2.213 1.053-2.518.277-.306.604-.383.805-.383.201 0 .402.002.578.01.186.009.434-.07.679.519.255.612.868 2.119.943 2.273.076.153.126.333.025.534-.1.2-.15.326-.299.499-.148.174-.313.388-.447.521-.148.147-.303.307-.13.606.173.299.769 1.269 1.651 2.054 1.135 1.01 2.091 1.323 2.39 1.472.298.149.472.13.647-.07.175-.2.753-.878.955-1.179.201-.301.402-.251.678-.151.276.1.175.776.85 1.151.675.375.141.574.226.772.085.198-.056.704-.381 1.077z" />
              </svg>
            </div>

            <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white mb-2">
              Hubungi Admin WhatsApp
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6 font-medium">
              Hubungi Tim Admin KaiwaDojo untuk informasi jadwal, pendaftaran, atau bantuan akun.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleOpenWhatsApp}
                className="group w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm rounded-xl border-none cursor-pointer transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>Buka Chat WhatsApp</span>
                <span className="size-5 rounded-full bg-white/20 flex items-center justify-center text-[0.65rem] font-black group-hover:translate-x-0.5 transition-transform">
                  &gt;
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsWaOpen(false)}
                className="w-full py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
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
