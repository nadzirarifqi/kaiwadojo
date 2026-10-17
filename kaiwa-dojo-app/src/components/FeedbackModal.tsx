import ModalPortal from './ModalPortal'
import { useState, useEffect, useId, type FormEvent } from 'react'
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

const RATING_TEXTS: Record<number, string> = {
  1: 'Sangat kurang',
  2: 'Perlu ditingkatkan',
  3: 'Cukup baik',
  4: 'Bagus',
  5: 'Luar biasa!',
}

const CATEGORY_ICON: Record<FeedbackCategory, string> = {
  saran_fitur: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
  laporan_bug: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  materi: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.328.477-4.5 1.253',
  desain_ui: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01',
  lainnya: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
}

const MESSAGE_PLACEHOLDER: Record<FeedbackCategory, string> = {
  saran_fitur: 'Ceritakan fitur yang kamu inginkan dan bagaimana fitur itu membantu belajarmu…',
  laporan_bug: 'Apa yang terjadi? Langkah apa yang kamu lakukan sebelum kendala muncul?',
  materi: 'Bab atau video mana yang ingin kamu beri masukan? Apa yang perlu diperjelas?',
  desain_ui: 'Bagian tampilan mana yang membingungkan atau kurang nyaman dipakai?',
  lainnya: 'Tulis masukanmu di sini…',
}

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors'

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
  const [editIdentity, setEditIdentity] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const titleInputId = useId()
  const messageInputId = useId()
  const nameInputId = useId()
  const emailInputId = useId()
  const phoneInputId = useId()

  // Isi identitas dari profil saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      setIsSuccess(false)
      setErrorMsg(null)
      setEditIdentity(false)
      setName(profile?.full_name || profile?.username || '')
      setEmail(profile?.email || '')
      setPhoneNumber(profile?.phone_number || '')
    }
  }, [isOpen, profile])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, submitting])

  if (!isOpen) return null

  const activeRating = hoverRating || rating

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!message.trim()) {
      setErrorMsg('Tulis isi masukanmu terlebih dahulu.')
      return
    }

    setSubmitting(true)
    setErrorMsg(null)

    const res = await submitFeedback({
      user_id: isAnonymous ? null : (profile?.id || null),
      name: isAnonymous ? 'Anonim' : (name.trim() || 'Pengguna kaiwadojo'),
      email: isAnonymous ? null : (email.trim() || null),
      phone_number: isAnonymous ? null : (phoneNumber.trim() || null),
      role: isAnonymous ? 'tamu' : (profile?.role || 'pelajar'),
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
      window.dispatchEvent(
        new CustomEvent('kaiwa-toast', {
          detail: { type: 'success', title: 'Masukan terkirim', message: 'Terima kasih! Masukanmu sudah diterima tim kaiwadojo.' },
        })
      )
    } else {
      setErrorMsg(res.error || 'Terjadi kesalahan saat mengirim masukan. Coba lagi.')
    }
  }

  return (
    <ModalPortal>
    <div
      className="modal-overlay fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-5 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88dvh] animate-fade-in-up text-slate-800 dark:text-slate-100"
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-3 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
          <div className="flex items-center gap-3">
            <span className="size-10 shrink-0 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={CATEGORY_ICON.lainnya} /></svg>
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="feedback-modal-title" className="text-base font-bold text-slate-900 dark:text-white leading-tight">Kirim Masukan</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">Bantu kami membuat kaiwadojo lebih baik</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup form masukan"
              disabled={submitting}
              className="size-10 shrink-0 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer transition-colors disabled:opacity-50"
            >
              <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {isSuccess ? (
          /* ── Berhasil ── */
          <div className="px-6 py-10 pb-[calc(2rem+env(safe-area-inset-bottom))] text-center flex flex-col items-center animate-fade-in">
            <span className="size-16 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </span>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-4">Terima kasih!</h3>
            <p className="font-serif text-sm text-slate-500 dark:text-slate-400">ありがとうございます</p>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-3 max-w-sm">
              Masukanmu sudah kami terima dan akan ditinjau tim kaiwadojo untuk menyempurnakan platform ini.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 h-11 px-6 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors"
            >
              Selesai
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 flex flex-col gap-5">
              {errorMsg && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2">
                  <svg className="size-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={CATEGORY_ICON.laporan_bug} /></svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Kategori */}
              <fieldset>
                <legend className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Tentang apa masukanmu?</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(CATEGORY_META) as FeedbackCategory[]).map(catKey => {
                    const isSelected = category === catKey
                    return (
                      <button
                        key={catKey}
                        type="button"
                        onClick={() => setCategory(catKey)}
                        aria-pressed={isSelected}
                        className={`h-10 px-3 rounded-xl border text-sm font-medium flex items-center gap-2 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border-primary/40 text-primary dark:text-primary-lighter font-semibold'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={CATEGORY_ICON[catKey]} /></svg>
                        {CATEGORY_META[catKey].label}
                      </button>
                    )
                  })}
                </div>
              </fieldset>

              {/* Rating */}
              <fieldset>
                <legend className="text-sm font-semibold text-slate-900 dark:text-white mb-1">Seberapa puas kamu dengan kaiwadojo?</legend>
                <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(null)}>
                  {[1, 2, 3, 4, 5].map(star => {
                    const filled = star <= activeRating
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        aria-label={`${star} bintang`}
                        aria-pressed={rating === star}
                        className="size-11 flex items-center justify-center rounded-xl border-none bg-transparent cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
                      >
                        <svg
                          className={`size-7 transition-colors ${filled ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600 fill-transparent'}`}
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.5}
                        >
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      </button>
                    )
                  })}
                  <span className="ml-2 text-sm font-medium text-slate-600 dark:text-slate-300">{RATING_TEXTS[activeRating]}</span>
                </div>
              </fieldset>

              {/* Pesan */}
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label htmlFor={messageInputId} className="text-sm font-semibold text-slate-900 dark:text-white">
                    Ceritakan masukanmu <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-xs text-slate-400 tabular-nums">{message.length}/1000</span>
                </div>
                <textarea
                  id={messageInputId}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required
                  maxLength={1000}
                  rows={5}
                  placeholder={MESSAGE_PLACEHOLDER[category]}
                  className={`${inputClass} resize-y min-h-[120px]`}
                />
              </div>

              <div>
                <label htmlFor={titleInputId} className="block text-sm font-semibold text-slate-900 dark:text-white mb-1.5">
                  Judul singkat <span className="font-normal text-slate-400">(opsional)</span>
                </label>
                <input
                  id={titleInputId}
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Contoh: Pengingat kotoba harian"
                  maxLength={100}
                  className={inputClass}
                />
              </div>

              {/* Identitas pengirim */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {isAnonymous ? 'Dikirim sebagai anonim' : `Dikirim sebagai ${name || 'kamu'}`}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {isAnonymous ? 'Tim tidak bisa menghubungimu kembali' : (email || phoneNumber || 'Tim bisa menghubungimu bila perlu')}
                    </p>
                  </div>
                  {!isAnonymous && (
                    <button
                      type="button"
                      onClick={() => setEditIdentity(v => !v)}
                      className="h-9 px-2.5 rounded-lg text-sm font-semibold text-primary dark:text-primary-lighter bg-transparent border-none cursor-pointer hover:bg-primary/5"
                    >
                      {editIdentity ? 'Tutup' : 'Ubah'}
                    </button>
                  )}
                  {/* Saklar anonim */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAnonymous}
                    aria-label="Kirim sebagai anonim"
                    onClick={() => { setIsAnonymous(v => !v); setEditIdentity(false) }}
                    className={`relative h-6 w-11 shrink-0 rounded-full border-none cursor-pointer transition-colors ${isAnonymous ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition-all ${isAnonymous ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">Aktifkan saklar untuk mengirim tanpa nama.</p>

                {!isAnonymous && editIdentity && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                    <div className="sm:col-span-2">
                      <label htmlFor={nameInputId} className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Nama</label>
                      <input id={nameInputId} type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Nama kamu" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor={emailInputId} className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Email</label>
                      <input id={emailInputId} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor={phoneInputId} className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">No. WhatsApp</label>
                      <input id={phoneInputId} type="tel" inputMode="tel" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="08123456789" className={inputClass} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="hidden sm:block h-11 px-4 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || !message.trim()}
                className="flex-1 sm:flex-none sm:ml-auto h-11 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    Mengirim…
                  </>
                ) : (
                  <>
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    Kirim masukan
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
    </ModalPortal>
  )
}
