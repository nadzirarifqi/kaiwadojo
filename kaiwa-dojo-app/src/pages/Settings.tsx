import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useLanguage, type Language } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { getAdminWhatsAppDeleteAccountUrl } from '../lib/whatsappService'

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const { toast } = useToast()

  // ── 1. Preferences State ──────────────────────────────
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('kaiwa_theme') as any) || 'light'
  })

  const [textSize, setTextSize] = useState<'small' | 'normal' | 'large' | 'xlarge'>(() => {
    return (localStorage.getItem('kaiwa_text_size') as any) || 'normal'
  })

  const handleLanguageChange = (newLang: Language) => {
    setLanguage(newLang)
    if (newLang === 'id') showToast('success', 'Bahasa aplikasi berhasil diubah ke Bahasa Indonesia 🇮🇩')
    else if (newLang === 'en') showToast('success', 'Language successfully updated to English 🇬🇧')
    else if (newLang === 'ja') showToast('success', '言語が日本語に変更されました 🇯🇵')
  }

  // ── 2. Password Form State ────────────────────────────
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // ── 3. Delete Account Modal State ─────────────────────
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  const showToast = (type: 'success' | 'error', text: string) => {
    if (type === 'success') {
      toast.success(text, 'Pengaturan')
    } else {
      toast.error(text, 'Pengaturan')
    }
  }

  // Apply Theme Mode (Light / Dark / System)
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (prefersDark) root.classList.add('dark')
      else root.classList.remove('dark')
    }
    localStorage.setItem('kaiwa_theme', theme)
  }, [theme])

  // Apply Text Size Scaling
  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('text-size-small', 'text-size-normal', 'text-size-large', 'text-size-xlarge')
    root.classList.add(`text-size-${textSize}`)
    localStorage.setItem('kaiwa_text_size', textSize)
  }, [textSize])

  // Handle Password Update
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()

    if (!newPassword || newPassword.length < 6) {
      showToast('error', 'Kata sandi minimal harus 6 karakter.')
      return
    }

    if (newPassword !== confirmPassword) {
      showToast('error', 'Konfirmasi kata sandi tidak cocok.')
      return
    }

    setIsChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setNewPassword('')
      setConfirmPassword('')
      showToast('success', 'Kata sandi Anda berhasil diperbarui!')
    } catch (err: any) {
      console.error('Gagal mengubah kata sandi:', err)
      showToast('error', err.message || 'Gagal mengubah kata sandi.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const effectiveUsername = profile?.username || user?.user_metadata?.username || ''
  const effectiveFullName = profile?.full_name || user?.user_metadata?.full_name || ''
  const effectiveEmail = profile?.email || user?.email || ''
  const deleteAccountWaUrl = getAdminWhatsAppDeleteAccountUrl(
    effectiveUsername,
    effectiveFullName,
    effectiveEmail
  )

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full animate-page-slide space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
          <span className="p-2.5 rounded-2xl bg-primary/10 text-primary dark:bg-primary/20 shrink-0">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          <span>{t('settings_title', 'Pengaturan Akun & Tampilan')}</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
          {t('settings_subtitle', 'Sesuaikan kenyamanan belajar, tema, bahasa, dan keamanan akun Anda')}
        </p>
      </div>

      {/* ── BAGIAN 1: PREFERENSI TAMPILAN & BAHASA ────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <h2 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <svg className="size-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4 4 4 0 014-4h1a2 2 0 002-2V9a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 002 2h1a4 4 0 014 4 4 4 0 01-4 4H7z" />
          </svg>
          <span>Preferensi Tampilan</span>
        </h2>

        {/* 1.1 Tema Aplikasi */}
        <div>
          <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-3">
            {t('theme_title', 'Tema Aplikasi (Light / Dark)')}
          </label>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {[
              {
                id: 'light',
                label: t('theme_light', 'Terang (Light)'),
                icon: (
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ),
              },
              {
                id: 'dark',
                label: t('theme_dark', 'Gelap (Dark)'),
                icon: (
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ),
              },
              {
                id: 'system',
                label: t('theme_system', 'Ikuti Sistem'),
                icon: (
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                ),
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id as any)}
                className={`py-3 px-2 rounded-2xl border text-xs font-extrabold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  theme === item.id
                    ? 'border-primary bg-primary/10 text-primary dark:border-red-400 dark:bg-red-400/10 dark:text-red-400 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50'
                }`}
              >
                <span>{item.icon}</span>
                <span className="text-[0.72rem] text-center leading-tight">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 1.2 Ukuran Teks */}
        <div>
          <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-3">
            {t('text_size_title', 'Ukuran Teks Aplikasi')}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { id: 'small', label: 'Kecil', desc: 'Ringkas (14px)' },
              { id: 'normal', label: 'Normal', desc: 'Standar (16px)' },
              { id: 'large', label: 'Besar', desc: 'Jelas (18px)' },
              { id: 'xlarge', label: 'Ekstra Besar', desc: 'Maksimal (20px)' },
            ].map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => setTextSize(size.id as any)}
                className={`py-3 px-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  textSize === size.id
                    ? 'border-primary bg-primary/10 text-primary dark:border-red-400 dark:bg-red-400/10 dark:text-red-400 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50'
                }`}
              >
                <div className="text-xs font-extrabold">{size.label}</div>
                <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 font-medium mt-0.5">{size.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 1.3 Bahasa Aplikasi */}
        <div>
          <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-3">
            {t('language_title', 'Bahasa Antarmuka Aplikasi')}
          </label>
          <div className="grid grid-cols-3 gap-3 max-w-md">
            {[
              { id: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩' },
              { id: 'en', label: 'English', flag: '🇬🇧' },
              { id: 'ja', label: '日本語 (Jepang)', flag: '🇯🇵' },
            ].map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => handleLanguageChange(lang.id as Language)}
                className={`py-3 px-2 rounded-2xl border text-xs font-extrabold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  language === lang.id
                    ? 'border-primary bg-primary/10 text-primary dark:border-red-400 dark:bg-red-400/10 dark:text-red-400 shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/50'
                }`}
              >
                <span className="text-xl">{lang.flag}</span>
                <span className="text-[0.72rem] text-center leading-tight">{lang.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── BAGIAN 2: KEAMANAN & UBAH KATA SANDI ──────────────── */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
        <h2 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-800 pb-3">
          <svg className="size-5 text-primary dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>{t('security_title', 'Keamanan & Ubah Kata Sandi')}</span>
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('new_password', 'Kata Sandi Baru')}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('pw_min_char', 'Minimal 6 karakter')}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-white text-xs font-medium focus:outline-none focus:border-primary dark:focus:border-red-400 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">
              {t('confirm_password', 'Konfirmasi Kata Sandi Baru')}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('pw_repeat_ph', 'Ulangi kata sandi baru')}
              required
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-800 dark:text-white text-xs font-medium focus:outline-none focus:border-primary dark:focus:border-red-400 transition-all"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="px-6 py-3 rounded-xl bg-primary hover:bg-primary-dark dark:bg-red-500 dark:hover:bg-red-600 text-white font-extrabold text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer flex items-center gap-2 group"
            >
              <span>{isChangingPassword ? 'Memperbarui...' : t('update_password', 'Perbarui Kata Sandi')}</span>
              {!isChangingPassword && (
                <span className="size-4.5 rounded-full bg-white/20 flex items-center justify-center text-[0.6rem] font-black group-hover:translate-x-0.5 transition-transform">
                  &gt;
                </span>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* ── BAGIAN 3: ZONA BAHAYA / HAPUS AKUN (DANGER ZONE) ──── */}
      <section className="bg-red-500/5 dark:bg-red-950/20 rounded-3xl p-6 sm:p-8 border border-red-200 dark:border-red-900 shadow-sm space-y-4">
        <h2 className="text-lg font-extrabold text-red-600 dark:text-red-400 flex items-center gap-3">
          <span className="size-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-xs">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          <span>{t('danger_zone', 'Zona Bahaya & Hapus Akun')}</span>
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-2xl">
          {t('danger_desc', 'Penghapusan akun akan menghapus data profil, histori pembelajaran, dan progres belajar secara permanen. Untuk keamanan, proses ini dikonfirmasi langsung dengan Admin via WhatsApp.')}
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer flex items-center gap-2"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>{t('delete_account', 'Ajukan Hapus Akun')}</span>
          </button>
        </div>
      </section>

      {/* ── MODAL KONFIRMASI HAPUS AKUN VIA WHATSAPP ─────────── */}
      {isDeleteModalOpen && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-extrabold text-red-600 dark:text-red-400 flex items-center gap-2.5">
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>{t('delete_modal_title', 'Konfirmasi Hapus Akun via WhatsApp')}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 font-extrabold flex items-center justify-center border-none cursor-pointer"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t('delete_modal_prompt', 'Untuk alasan keamanan dan verifikasi kepemilikan akun, permohonan penghapusan akun diproses melalui konfirmasi langsung dengan Admin kaiwadojo melalui WhatsApp.')}
            </p>

            {/* Account Detail Card */}
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Username:</span>
                <span className="font-extrabold text-slate-800 dark:text-white">@{effectiveUsername || 'user'}</span>
              </div>
              {effectiveFullName && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Nama:</span>
                  <span className="font-extrabold text-slate-800 dark:text-white">{effectiveFullName}</span>
                </div>
              )}
              {effectiveEmail && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Email:</span>
                  <span className="font-extrabold text-slate-800 dark:text-white">{effectiveEmail}</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <a
                href={deleteAccountWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2.5 transition-all text-center no-underline cursor-pointer"
              >
                <svg className="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span>{t('delete_modal_wa_btn', 'Hubungi Admin via WhatsApp')}</span>
              </a>

              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="w-full py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer border-none"
              >
                {t('cancel', 'Batal')}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
