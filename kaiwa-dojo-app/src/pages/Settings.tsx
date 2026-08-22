import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  // ── 1. Preferences State ──────────────────────────────
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('kaiwa_theme') as any) || 'light'
  })

  const [textSize, setTextSize] = useState<'small' | 'normal' | 'large' | 'xlarge'>(() => {
    return (localStorage.getItem('kaiwa_text_size') as any) || 'normal'
  })

  const [language, setLanguage] = useState<'id' | 'en' | 'ja'>(() => {
    return (localStorage.getItem('kaiwa_language') as any) || 'id'
  })

  // ── 2. Password Form State ────────────────────────────
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // ── 3. Delete Account Modal State ─────────────────────
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('')
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  // ── UI Toast Notification ─────────────────────────────
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Apply Theme effect
  useEffect(() => {
    localStorage.setItem('kaiwa_theme', theme)
    const root = document.documentElement
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }, [theme])

  // Apply Text Size effect
  useEffect(() => {
    localStorage.setItem('kaiwa_text_size', textSize)
    const root = document.documentElement
    if (textSize === 'small') root.style.fontSize = '14px'
    else if (textSize === 'normal') root.style.fontSize = '16px'
    else if (textSize === 'large') root.style.fontSize = '18px'
    else if (textSize === 'xlarge') root.style.fontSize = '20px'
  }, [textSize])

  // Save Language
  useEffect(() => {
    localStorage.setItem('kaiwa_language', language)
  }, [language])

  // Handle Password Update via Supabase Auth
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!newPassword) {
      showToast('error', 'Silakan masukkan kata sandi baru.')
      return
    }
    if (newPassword.length < 6) {
      showToast('error', 'Kata sandi minimal 6 karakter.')
      return
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'Konfirmasi kata sandi tidak cocok.')
      return
    }

    setIsChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
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

  // Handle Account Deletion
  async function handleDeleteAccount() {
    if (deleteConfirmationText.trim().toUpperCase() !== 'HAPUS AKUN') {
      showToast('error', 'Tuliskan "HAPUS AKUN" dengan benar untuk mengonfirmasi.')
      return
    }

    if (!user) return
    setIsDeletingAccount(true)

    try {
      // Delete user row from profiles table
      const { error: profileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)

      if (profileErr) console.warn('Peringatan hapus profil:', profileErr)

      // Sign out user and redirect to login
      await signOut()
      showToast('success', 'Akun Anda telah berhasil dihapus.')
      navigate('/login')
    } catch (err: any) {
      console.error('Gagal menghapus akun:', err)
      showToast('error', err.message || 'Gagal menghapus akun.')
    } finally {
      setIsDeletingAccount(false)
      setIsDeleteModalOpen(false)
    }
  }

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full animate-fade-in space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border text-sm font-bold animate-slide-fade ${
          toastMessage.type === 'success'
            ? 'bg-emerald-500 text-white border-emerald-600'
            : 'bg-red-500 text-white border-red-600'
        }`}>
          <span>{toastMessage.type === 'success' ? '✅' : '❌'}</span>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
            <span className="size-10 sm:size-11 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center text-xl shrink-0 font-serif shadow-xs">
              設
            </span>
            <span>Pengaturan Akun</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">
            Atur preferensi tampilan, bahasa, kata sandi, dan privasi akun KaiwaDoJo Anda
          </p>
        </div>
      </div>

      {/* ── BAGIAN 1: TAMPILAN & BAHASA (APPEARANCE & LANGUAGE) ──── */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <h2 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <span className="size-8 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300 flex items-center justify-center text-base shrink-0 shadow-xs">
            🎨
          </span>
          <span>Tampilan & Preferensi</span>
        </h2>

        <div className="space-y-6">
          {/* 1. Light / Dark Theme */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Tema Aplikasi (Light / Dark Mode)
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col items-center gap-2 ${
                  theme === 'light'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20 text-primary dark:text-red-400'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="size-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 flex items-center justify-center text-xl shrink-0 border border-amber-500/20">
                  ☀️
                </span>
                <span className="font-extrabold text-xs sm:text-sm">Terang (Light)</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col items-center gap-2 ${
                  theme === 'dark'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20 text-primary dark:text-red-400'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="size-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-400/20 dark:text-indigo-300 flex items-center justify-center text-xl shrink-0 border border-indigo-500/20">
                  🌙
                </span>
                <span className="font-extrabold text-xs sm:text-sm">Gelap (Dark)</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col items-center gap-2 ${
                  theme === 'system'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20 text-primary dark:text-red-400'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                <span className="size-9 rounded-2xl bg-purple-500/10 text-purple-600 dark:bg-purple-400/20 dark:text-purple-300 flex items-center justify-center text-xl shrink-0 border border-purple-500/20">
                  💻
                </span>
                <span className="font-extrabold text-xs sm:text-sm">Ikuti Sistem</span>
              </button>
            </div>
          </div>

          {/* 2. Ukuran Teks (Text Size) */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Ukuran Teks Aplikasi
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'small', label: 'Kecil', desc: '14px', sample: 'Aa' },
                { id: 'normal', label: 'Normal', desc: '16px (Default)', sample: 'Aa' },
                { id: 'large', label: 'Besar', desc: '18px', sample: 'Aa' },
                { id: 'xlarge', label: 'Sangat Besar', desc: '20px', sample: 'Aa' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTextSize(item.id as any)}
                  className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col items-center text-center gap-1 ${
                    textSize === item.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20 text-primary dark:text-red-400'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <span className="font-black text-lg">{item.sample}</span>
                  <span className="font-extrabold text-xs">{item.label}</span>
                  <span className="text-[0.65rem] text-slate-400 font-semibold">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Bahasa Aplikasi (Language) */}
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Bahasa Antarmuka Aplikasi
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'id', label: 'Bahasa Indonesia', flag: '🇮🇩', sub: 'Utama' },
                { id: 'en', label: 'English', flag: '🇬🇧', sub: 'International' },
                { id: 'ja', label: '日本語 (Japanese)', flag: '🇯🇵', sub: 'Nihongo' },
              ].map((lang) => (
                <button
                  key={lang.id}
                  type="button"
                  onClick={() => setLanguage(lang.id as any)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer flex items-center gap-3 ${
                    language === lang.id
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800'
                  }`}
                >
                  <span className="text-3xl">{lang.flag}</span>
                  <div>
                    <div className="font-extrabold text-sm text-slate-800 dark:text-white">{lang.label}</div>
                    <div className="text-xs text-slate-400 font-semibold">{lang.sub}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── BAGIAN 2: KEAMANAN & UBAH KATA SANDI (SECURITY) ────── */}
      <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <h2 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <span className="size-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-base shrink-0 shadow-xs">
            🔒
          </span>
          <span>Keamanan & Ubah Kata Sandi</span>
        </h2>

        <form onSubmit={handleChangePassword} className="space-y-5 max-w-xl">
          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Kata Sandi Baru
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Konfirmasi Kata Sandi Baru
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ulangi kata sandi baru"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="px-5 py-2.5 sm:py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs sm:text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2.5"
            >
              {isChangingPassword ? (
                <>
                  <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memperbarui...</span>
                </>
              ) : (
                <>
                  <div className="size-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <span className="text-base">🔑</span>
                  </div>
                  <span>Perbarui Kata Sandi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* ── BAGIAN 3: ZONA BAHAYA / HAPUS AKUN (DANGER ZONE) ──── */}
      <section className="bg-red-500/5 dark:bg-red-950/20 rounded-3xl p-6 sm:p-8 border border-red-200 dark:border-red-900 shadow-sm space-y-4">
        <h2 className="text-lg font-extrabold text-red-600 dark:text-red-400 flex items-center gap-3">
          <span className="size-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-base shrink-0 shadow-xs">
            ⚠️
          </span>
          <span>Zona Bahaya</span>
        </h2>
        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed max-w-2xl">
          Menghapus akun Anda akan menghapus data profil, histori pembelajaran, dan progres streak secara permanen. Tindakan ini tidak dapat dibatalkan.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmationText('')
              setIsDeleteModalOpen(true)
            }}
            className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer flex items-center gap-2.5"
          >
            <span className="text-base">🗑️</span>
            <span>Hapus Akun Saya</span>
          </button>
        </div>
      </section>

      {/* ── MODAL KONFIRMASI HAPUS AKUN ──────────────────────── */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-xl font-extrabold text-red-600 dark:text-red-400 flex items-center gap-2.5">
                <span className="text-2xl">⚠️</span>
                <span>Konfirmasi Hapus Akun</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 font-extrabold flex items-center justify-center border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Apakah Anda yakin ingin menghapus akun <strong>{profile?.full_name}</strong> (@{profile?.username})?
              Semua data Anda akan dihapus secara permanen dari KaiwaDoJo.
            </p>

            <div>
              <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 mb-2">
                Ketik <span className="text-red-600 dark:text-red-400 font-black">HAPUS AKUN</span> untuk mengonfirmasi:
              </label>
              <input
                type="text"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                placeholder="HAPUS AKUN"
                className="w-full px-4 py-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/30 text-slate-800 dark:text-white text-sm font-extrabold focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleteConfirmationText.trim().toUpperCase() !== 'HAPUS AKUN' || isDeletingAccount}
                onClick={handleDeleteAccount}
                className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs transition-all disabled:opacity-40 cursor-pointer flex items-center gap-2"
              >
                {isDeletingAccount ? 'Deleting...' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
