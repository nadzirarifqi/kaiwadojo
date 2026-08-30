import { useState, useEffect, useId } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  submitFeedback,
  type FeedbackCategory,
  CATEGORY_META,
} from '../lib/feedbackService'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
}

const RATING_EMOJIS: Record<number, { emoji: string; text: string }> = {
  1: { emoji: '😞', text: 'Sangat Kurang' },
  2: { emoji: '😕', text: 'Perlu Ditingkatkan' },
  3: { emoji: '😐', text: 'Cukup Baik' },
  4: { emoji: '😊', text: 'Bagus & Bermanfaat' },
  5: { emoji: '🤩', text: 'Luar Biasa / Sempurna!' },
}

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
  const { profile } = useAuth()

  const [category, setCategory] = useState<FeedbackCategory>('saran_fitur')
  const [rating, setRating] = useState<number>(5)
  const [hoverRating, setHoverRating] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const titleInputId = useId()
  const messageInputId = useId()
  const nameInputId = useId()
  const emailInputId = useId()
  const phoneInputId = useId()
  const anonymousCheckboxId = useId()

  // Initialize user identity from auth profile
  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false)
      setErrorMsg(null)
      if (profile) {
        setName(profile.full_name || profile.username || '')
        setEmail(profile.email || '')
        setPhoneNumber(profile.phone_number || '')
      } else {
        setName('')
        setEmail('')
        setPhoneNumber('')
      }
    }
  }, [isOpen, profile])

  // ESC key handler to close modal
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const activeRating = hoverRating || rating

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) {
      setErrorMsg('Harap tuliskan isi masukan atau saran Anda terlebih dahulu.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    const senderName = isAnonymous ? 'Anonim' : (name.trim() || 'Pengguna KaiwaDojo')
    const senderEmail = isAnonymous ? null : (email.trim() || null)
    const senderPhone = isAnonymous ? null : (phoneNumber.trim() || null)
    const senderRole = isAnonymous ? 'tamu' : (profile?.role || 'pelajar')

    const res = await submitFeedback({
      user_id: isAnonymous ? null : (profile?.id || null),
      name: senderName,
      email: senderEmail,
      phone_number: senderPhone,
      role: senderRole,
      category,
      rating,
      title: title.trim() || null,
      message: message.trim(),
      page_url: window.location.href,
    })

    setSubmitting(false)

    if (res.success) {
      setIsSuccess(true)
      setTitle('')
      setMessage('')
      setTimeout(() => {
        // Automatically close after a short delay if user doesn't click
      }, 3000)
    } else {
      setErrorMsg(res.error || 'Terjadi kesalahan saat mengirim masukan.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-xl w-full border border-slate-200/90 dark:border-slate-800 shadow-2xl animate-scale-up relative overflow-hidden my-auto max-h-[92dvh] flex flex-col text-slate-800 dark:text-slate-100">
        
        {/* Decorative Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-primary to-rose-500" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup form masukan"
          disabled={submitting}
          className="absolute top-4 right-4 size-9 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-lg font-bold border-none cursor-pointer transition-all disabled:opacity-50"
        >
          ✕
        </button>

        {isSuccess ? (
          /* ── SUCCESS STATE ──────────────────────────────────────────────── */
          <div className="py-8 px-2 text-center flex flex-col items-center justify-center animate-fade-in">
            <div className="size-20 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border-2 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-4xl mb-4 shadow-lg shadow-emerald-500/10 animate-bounce">
              ✨
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mb-2">
              Arigatou Gozaimasu! (ありがとうございます)
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-md leading-relaxed font-medium mb-6">
              Masukan & saran berharga Anda telah kami terima dengan baik. Tim KaiwaDojo akan meninjau saran ini untuk terus menyempurnakan platform belajar kita!
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-primary to-primary-light hover:opacity-95 text-white font-extrabold text-xs sm:text-sm rounded-2xl border-none cursor-pointer shadow-md hover:shadow-lg transition-all"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        ) : (
          /* ── FORM STATE ─────────────────────────────────────────────────── */
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
            {/* Header */}
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:bg-amber-400/20 dark:text-amber-300 border border-amber-500/20 text-[0.7rem] font-black uppercase tracking-wider mb-2">
                <span>💡</span>
                <span>Kolom Masukan & Saran Website</span>
              </div>
              <h2 id="feedback-modal-title" className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>Bantu Kami Mengembangkan KaiwaDojo</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Punya saran fitur baru, menemukan kendala (bug), atau ingin memberi masukan materi? Ceritakan kepada kami!
              </p>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 text-rose-600 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Category Selector */}
            <div>
              <label className="block text-[0.75rem] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                1. Kategori Masukan <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(CATEGORY_META) as FeedbackCategory[]).map((catKey) => {
                  const meta = CATEGORY_META[catKey]
                  const isSelected = category === catKey
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setCategory(catKey)}
                      className={`flex items-center gap-2 p-2.5 rounded-2xl text-left border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-primary/10 border-primary text-primary dark:bg-red-500/20 dark:border-red-400 dark:text-red-300 font-bold shadow-xs scale-[1.02]'
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                      }`}
                    >
                      <span className="text-lg shrink-0">{meta.icon}</span>
                      <span className="text-xs leading-tight">{meta.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2. Rating & Satisfaction */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[0.75rem] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  2. Tingkat Kepuasan Pengalaman Anda
                </label>
                <span className="text-xs font-bold text-amber-500 dark:text-amber-400 flex items-center gap-1">
                  <span>{RATING_EMOJIS[activeRating]?.emoji}</span>
                  <span>{RATING_EMOJIS[activeRating]?.text}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 justify-center">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = star <= activeRating
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      aria-label={`Beri nilai ${star} bintang`}
                      className="p-1 text-2xl sm:text-3xl transition-transform hover:scale-125 active:scale-95 border-none bg-transparent cursor-pointer"
                    >
                      <span className={filled ? 'text-amber-400 drop-shadow-xs' : 'text-slate-300 dark:text-slate-600 opacity-60'}>
                        ★
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 3. Title (Optional) */}
            <div>
              <label htmlFor={titleInputId} className="block text-[0.75rem] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                3. Judul / Ringkasan Singkat (Opsional)
              </label>
              <input
                id={titleInputId}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Fitur pengingat kotoba harian atau Tombol download video"
                maxLength={100}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-red-400/40"
              />
            </div>

            {/* 4. Message (Required) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor={messageInputId} className="block text-[0.75rem] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  4. Pesan Masukan, Saran, atau Keluhan <span className="text-rose-500">*</span>
                </label>
                <span className="text-[0.65rem] text-slate-400 font-mono">
                  {message.length}/1000
                </span>
              </div>
              <textarea
                id={messageInputId}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                maxLength={1000}
                rows={4}
                placeholder="Tuliskan masukan atau saran Anda secara rinci di sini... (Misalnya: apa yang menurut Anda bagus, apa yang perlu ditingkatkan, atau ide fitur yang ingin Anda miliki)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40 dark:focus:ring-red-400/40 resize-y"
              />
            </div>

            {/* 5. Sender Identity (Optional toggle) */}
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[0.72rem] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Identitas Pengirim
                </span>
                <label htmlFor={anonymousCheckboxId} className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <input
                    id={anonymousCheckboxId}
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="size-4 rounded accent-primary text-primary"
                  />
                  <span>Kirim sebagai Anonim 👤</span>
                </label>
              </div>

              {!isAnonymous && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 animate-fade-in">
                  <div>
                    <label htmlFor={nameInputId} className="block text-[0.68rem] text-slate-500 dark:text-slate-400 font-bold mb-1">
                      Nama Pengirim
                    </label>
                    <input
                      id={nameInputId}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nama Anda"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor={emailInputId} className="block text-[0.68rem] text-slate-500 dark:text-slate-400 font-bold mb-1">
                      Email
                    </label>
                    <input
                      id={emailInputId}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor={phoneInputId} className="block text-[0.68rem] text-slate-500 dark:text-slate-400 font-bold mb-1">
                      No. WhatsApp
                    </label>
                    <input
                      id={phoneInputId}
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="08123456789"
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 border-none cursor-pointer transition-all"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-light hover:opacity-95 text-white font-extrabold text-xs sm:text-sm border-none cursor-pointer shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <span className="animate-spin text-sm">🔄</span>
                    <span>Mengirimkan...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Kirim Masukan & Saran</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
