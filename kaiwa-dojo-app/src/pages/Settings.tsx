import { useState, useEffect, type FormEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useLanguage, type Language } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { useConfirmedSignOut } from '../contexts/ConfirmContext'
import { getAdminWhatsAppDeleteAccountUrl } from '../lib/whatsappService'
import ModalPortal from '../components/ModalPortal'

type ThemeMode = 'light' | 'dark' | 'system'
type TextSize = 'small' | 'normal' | 'large' | 'xlarge'

const TEXT_SIZE_PX: Record<TextSize, string> = { small: '14px', normal: '16px', large: '18px', xlarge: '20px' }

const CARD = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm'
const inputClass =
  'w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors'

const SECTIONS = [
  { id: 'tampilan', label: 'Tampilan', d: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01' },
  { id: 'bahasa', label: 'Bahasa', d: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129' },
  { id: 'keamanan', label: 'Keamanan', d: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
  { id: 'akun', label: 'Akun', d: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
]

function SectionHeader({ id, title, description }: { id: string; title: string; description: string }) {
  const section = SECTIONS.find(s => s.id === id)
  return (
    <div className="flex items-start gap-3 mb-4">
      <span className="size-10 shrink-0 rounded-xl bg-primary/10 text-primary dark:text-primary-lighter flex items-center justify-center">
        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={section?.d} /></svg>
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>
      </div>
    </div>
  )
}

function OptionCard({
  selected,
  onClick,
  children,
  label,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      onClick={onClick}
      className={`relative rounded-xl border-2 p-2 text-left cursor-pointer transition-colors bg-white dark:bg-slate-900 ${
        selected ? 'border-primary' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      {children}
      {selected && (
        <span className="absolute top-1.5 right-1.5 size-5 rounded-full bg-primary text-white flex items-center justify-center">
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </span>
      )}
    </button>
  )
}

/** Kekuatan kata sandi sederhana: 0–4 */
function passwordStrength(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 6) score++
  if (pw.length >= 10) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++
  return pw.length < 6 ? Math.min(score, 1) : Math.min(score, 4)
}
const STRENGTH_LABEL = ['', 'Lemah', 'Cukup', 'Kuat', 'Sangat kuat']
const STRENGTH_COLOR = ['bg-slate-200', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-emerald-600']

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const { toast } = useToast()
  const handleSignOut = useConfirmedSignOut(() => signOut())

  // ── Preferensi ──
  const [theme, setTheme] = useState<ThemeMode>(() => (localStorage.getItem('kaiwa_theme') as ThemeMode) || 'light')
  const [textSize, setTextSize] = useState<TextSize>(() => (localStorage.getItem('kaiwa_text_size') as TextSize) || 'normal')

  // ── Kata sandi ──
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)

  // ── Hapus akun ──
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)

  // Terapkan tema (termasuk mengikuti perubahan tema sistem saat mode "Ikuti sistem")
  useEffect(() => {
    const root = document.documentElement
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => root.classList.toggle('dark', theme === 'dark' || (theme === 'system' && mql.matches))
    apply()
    localStorage.setItem('kaiwa_theme', theme)
    if (theme !== 'system') return
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [theme])

  // Sinkron bila tema diganti dari tombol di navbar
  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      const stored = localStorage.getItem('kaiwa_theme') as ThemeMode | null
      if (stored && stored !== theme) setTheme(stored)
    })
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [theme])

  // Terapkan ukuran teks langsung (seluruh UI memakai rem, jadi ikut membesar/mengecil)
  useEffect(() => {
    document.documentElement.style.fontSize = TEXT_SIZE_PX[textSize]
    localStorage.setItem('kaiwa_text_size', textSize)
  }, [textSize])

  function handleLanguageChange(newLang: Language) {
    if (newLang === language) return
    setLanguage(newLang)
    if (newLang === 'id') toast.success('Bahasa aplikasi diubah ke Bahasa Indonesia.', 'Pengaturan')
    else if (newLang === 'en') toast.success('Language changed to English.', 'Settings')
    else if (newLang === 'ja') toast.success('言語が日本語に変更されました。', '設定')
  }

  const strength = passwordStrength(newPassword)
  const tooShort = newPassword.length > 0 && newPassword.length < 6
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword
  const canSubmitPassword = newPassword.length >= 6 && newPassword === confirmPassword && !isChangingPassword

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword.length < 6) {
      toast.error('Kata sandi minimal 6 karakter.', 'Pengaturan')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi kata sandi tidak cocok.', 'Pengaturan')
      return
    }
    setIsChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      toast.success('Kata sandi berhasil diperbarui.', 'Pengaturan')
    } catch (err: any) {
      console.error('Gagal mengubah kata sandi:', err)
      toast.error(err?.message || 'Gagal mengubah kata sandi.', 'Pengaturan')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const effectiveUsername = profile?.username || user?.user_metadata?.username || ''
  const effectiveFullName = profile?.full_name || user?.user_metadata?.full_name || ''
  const effectiveEmail = profile?.email || user?.email || ''
  const deleteAccountWaUrl = getAdminWhatsAppDeleteAccountUrl(effectiveUsername, effectiveFullName, effectiveEmail)
  const initials = effectiveFullName
    ? effectiveFullName.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  function scrollToSection(id: string) {
    document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const themeOptions: { id: ThemeMode; label: string }[] = [
    { id: 'light', label: t('theme_light', 'Terang') },
    { id: 'dark', label: t('theme_dark', 'Gelap') },
    { id: 'system', label: t('theme_system', 'Ikuti sistem') },
  ]
  const sizeOptions: { id: TextSize; label: string; sample: string }[] = [
    { id: 'small', label: 'Kecil', sample: 'text-[13px]' },
    { id: 'normal', label: 'Normal', sample: 'text-[15px]' },
    { id: 'large', label: 'Besar', sample: 'text-[17px]' },
    { id: 'xlarge', label: 'Sangat besar', sample: 'text-[19px]' },
  ]
  const languageOptions: { id: Language; native: string; label: string; flag: string }[] = [
    { id: 'id', native: 'Bahasa Indonesia', label: 'Indonesia', flag: '🇮🇩' },
    { id: 'en', native: 'English', label: 'Inggris', flag: '🇬🇧' },
    { id: 'ja', native: '日本語', label: 'Jepang', flag: '🇯🇵' },
  ]

  return (
    <main className="flex-1 px-4 py-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full min-w-0 animate-page-slide">
      {/* Judul halaman */}
      <header className="mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{t('settings_title', 'Pengaturan')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          {t('settings_subtitle', 'Atur tampilan, bahasa, dan keamanan akunmu. Perubahan tampilan tersimpan otomatis.')}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[12rem_minmax(0,1fr)] gap-4 sm:gap-6 items-start">
        {/* Navigasi bagian */}
        <nav aria-label="Bagian pengaturan" className="lg:sticky lg:top-20 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
          <ul className="flex lg:flex-col gap-1.5 lg:gap-1 w-max lg:w-auto">
            {SECTIONS.map(s => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className="h-10 px-3.5 lg:w-full rounded-xl flex items-center gap-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-white lg:bg-transparent dark:bg-slate-900 lg:dark:bg-transparent border border-slate-200 lg:border-transparent dark:border-slate-800 lg:dark:border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors whitespace-nowrap"
                >
                  <svg className="size-[18px] shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={s.d} /></svg>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex flex-col gap-4 sm:gap-6 min-w-0">
          {/* ── Tampilan ── */}
          <section id="settings-tampilan" className={`${CARD} p-4 sm:p-6 scroll-mt-20`}>
            <SectionHeader id="tampilan" title="Tampilan" description="Sesuaikan tema dan ukuran teks agar nyaman di mata." />

            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{t('theme_title', 'Tema')}</p>
            <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-2 sm:gap-3 max-w-lg">
              {themeOptions.map(opt => (
                <OptionCard key={opt.id} selected={theme === opt.id} onClick={() => setTheme(opt.id)} label={opt.label}>
                  {/* Pratinjau mini */}
                  <span className={`block h-14 sm:h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 ${
                    opt.id === 'light' ? 'bg-slate-50' : opt.id === 'dark' ? 'bg-slate-900' : 'bg-gradient-to-r from-slate-50 from-50% to-slate-900 to-50%'
                  }`}>
                    <span className="flex h-full gap-1 p-1.5">
                      <span className={`w-1/4 rounded ${opt.id === 'dark' ? 'bg-slate-800' : 'bg-white'} `} />
                      <span className="flex-1 flex flex-col gap-1">
                        <span className="h-2 w-3/4 rounded bg-primary/70" />
                        <span className={`h-2 w-1/2 rounded ${opt.id === 'dark' ? 'bg-slate-700' : 'bg-slate-200'}`} />
                        <span className={`flex-1 rounded ${opt.id === 'light' ? 'bg-white' : opt.id === 'dark' ? 'bg-slate-800' : 'bg-slate-400/40'}`} />
                      </span>
                    </span>
                  </span>
                  <span className="block mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100 text-center">{opt.label}</span>
                </OptionCard>
              ))}
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800 my-5" />

            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">{t('text_size_title', 'Ukuran teks')}</p>
            <div role="radiogroup" aria-label="Ukuran teks" className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 max-w-lg">
              {sizeOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={textSize === opt.id}
                  onClick={() => setTextSize(opt.id)}
                  className={`h-12 rounded-lg flex flex-col items-center justify-center border-none cursor-pointer transition-colors ${
                    textSize === opt.id ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <span className={`font-bold leading-none ${opt.sample}`}>Aa</span>
                  <span className="text-[11px] mt-1 leading-none">{opt.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 max-w-lg rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-3">
              <p className="text-xs text-slate-400 mb-1">Pratinjau</p>
              <p className="text-base text-slate-800 dark:text-slate-100"><span className="font-serif font-bold">日本語を勉強しています。</span> Saya sedang belajar bahasa Jepang.</p>
            </div>
          </section>

          {/* ── Bahasa ── */}
          <section id="settings-bahasa" className={`${CARD} p-4 sm:p-6 scroll-mt-20`}>
            <SectionHeader id="bahasa" title={t('language_title', 'Bahasa')} description="Bahasa yang dipakai di menu dan tombol aplikasi." />
            <div role="radiogroup" aria-label="Bahasa aplikasi" className="flex flex-col gap-2 max-w-lg">
              {languageOptions.map(lang => {
                const selected = language === lang.id
                return (
                  <button
                    key={lang.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => handleLanguageChange(lang.id)}
                    className={`h-14 px-3.5 rounded-xl border-2 flex items-center gap-3 text-left cursor-pointer transition-colors bg-white dark:bg-slate-900 ${
                      selected ? 'border-primary' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="text-2xl leading-none" aria-hidden="true">{lang.flag}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">{lang.native}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{lang.label}</span>
                    </span>
                    <span className={`size-5 shrink-0 rounded-full border-2 flex items-center justify-center ${selected ? 'border-primary' : 'border-slate-300 dark:border-slate-600'}`}>
                      {selected && <span className="size-2.5 rounded-full bg-primary" />}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* ── Keamanan ── */}
          <section id="settings-keamanan" className={`${CARD} p-4 sm:p-6 scroll-mt-20`}>
            <SectionHeader id="keamanan" title={t('security_title', 'Ubah kata sandi')} description="Gunakan kata sandi yang kuat dan tidak dipakai di situs lain." />
            <form onSubmit={handleChangePassword} className="flex flex-col gap-4 max-w-lg">
              <div>
                <label htmlFor="new-password" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{t('new_password', 'Kata sandi baru')}</label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder={t('pw_min_char', 'Minimal 6 karakter')}
                    aria-invalid={tooShort}
                    className={`${inputClass} pr-12`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 size-10 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-transparent border-none cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map(i => (
                        <span key={i} className={`h-1 flex-1 rounded-full ${i <= strength ? STRENGTH_COLOR[strength] : 'bg-slate-200 dark:bg-slate-700'}`} />
                      ))}
                    </div>
                    <p className={`text-xs mt-1 ${tooShort ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                      {tooShort ? `Kurang ${6 - newPassword.length} karakter lagi` : `Kekuatan: ${STRENGTH_LABEL[strength]}`}
                      {!tooShort && strength < 3 && ' · tambahkan huruf besar, angka, atau simbol'}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{t('confirm_password', 'Ulangi kata sandi baru')}</label>
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t('pw_repeat_ph', 'Ketik ulang kata sandi baru')}
                  aria-invalid={mismatch}
                  className={`${inputClass} ${mismatch ? '!border-red-400' : ''}`}
                />
                {confirmPassword && (
                  <p className={`text-xs mt-1 ${mismatch ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {mismatch ? 'Kata sandi belum sama.' : 'Kata sandi cocok.'}
                  </p>
                )}
              </div>

              <div>
                <button
                  type="submit"
                  disabled={!canSubmitPassword}
                  className="h-11 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isChangingPassword && <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                  {isChangingPassword ? 'Menyimpan…' : t('update_password', 'Perbarui kata sandi')}
                </button>
              </div>
            </form>
          </section>

          {/* ── Akun ── */}
          <section id="settings-akun" className={`${CARD} p-4 sm:p-6 scroll-mt-20`}>
            <SectionHeader id="akun" title="Akun" description="Kelola profil dan sesi masukmu." />
            <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/profile')}
                  className="w-full py-3 flex items-center gap-3 text-left bg-transparent border-none cursor-pointer group"
                >
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="size-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="size-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold shrink-0">{initials}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">{effectiveFullName || 'Profil saya'}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{effectiveEmail || `@${effectiveUsername}`}</span>
                  </span>
                  <span className="text-sm font-semibold text-primary dark:text-primary-lighter shrink-0 group-hover:underline">Edit profil</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-3 flex items-center gap-3 text-left bg-transparent border-none cursor-pointer group"
                >
                  <span className="size-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center">
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-900 dark:text-white">Keluar</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">Akhiri sesi di perangkat ini</span>
                  </span>
                </button>
              </li>
            </ul>

            {/* Zona berbahaya */}
            <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50/50 dark:bg-red-950/20 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">{t('danger_zone', 'Hapus akun')}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5">
                  {t('danger_desc', 'Menghapus profil, riwayat, dan progres belajar secara permanen. Demi keamanan, permintaan diproses bersama admin melalui WhatsApp.')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="h-11 px-4 shrink-0 rounded-xl bg-white dark:bg-slate-900 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-sm font-semibold cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              >
                {t('delete_account', 'Ajukan hapus akun')}
              </button>
            </div>
          </section>
        </div>
      </div>

      {/* ── Sheet konfirmasi hapus akun ── */}
      {isDeleteModalOpen && (
        <ModalPortal>
          <div
            className="modal-overlay fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-account-title"
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl px-5 pt-3 sm:pt-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 animate-fade-in-up"
            >
              <div className="sm:hidden mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex flex-col items-center text-center">
                <span className="size-12 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </span>
                <h3 id="delete-account-title" className="mt-3 text-lg font-bold text-slate-900 dark:text-white">{t('delete_modal_title', 'Ajukan hapus akun?')}</h3>
                <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t('delete_modal_prompt', 'Untuk verifikasi kepemilikan, permintaan dikirim ke admin kaiwadojo lewat WhatsApp. Data yang dihapus tidak bisa dikembalikan.')}
                </p>
              </div>

              <dl className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Username</dt><dd className="font-semibold text-slate-900 dark:text-white truncate">@{effectiveUsername || 'user'}</dd></div>
                {effectiveFullName && <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Nama</dt><dd className="font-semibold text-slate-900 dark:text-white truncate">{effectiveFullName}</dd></div>}
                {effectiveEmail && <div className="flex justify-between gap-3"><dt className="text-slate-500 dark:text-slate-400">Email</dt><dd className="font-semibold text-slate-900 dark:text-white truncate">{effectiveEmail}</dd></div>}
              </dl>

              <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold border-none cursor-pointer"
                >
                  {t('cancel', 'Batal')}
                </button>
                <a
                  href={deleteAccountWaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold flex items-center justify-center gap-2 no-underline transition-colors"
                >
                  {t('delete_modal_wa_btn', 'Lanjut ke WhatsApp')}
                </a>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </main>
  )
}
