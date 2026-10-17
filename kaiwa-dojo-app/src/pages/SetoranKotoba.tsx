import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import CustomAlertModal, { type AlertModalConfig } from '../components/CustomAlertModal'
import { validateKotobaInput } from '../lib/kotobaValidation'
import {
  fetchDailyMission,
  getDailyMission,
  calculateMissionProgress,
} from '../lib/dailyMission'

export interface UserKotoba {
  id: string
  user_id: string
  japanese: string
  romaji: string
  meaning: string
  image_url?: string
  is_mastered: boolean
  created_at?: string
}

// Sisi depan flashcard: huruf Jepang (tebak arti & cara baca) atau arti (tebak huruf Jepang)
type CardFront = 'japanese' | 'meaning'
type TestDirection = CardFront | 'mixed'
type TestPhase = 'setup' | 'playing' | 'finished'

const TEST_COUNT_PRESETS = [5, 10, 20, 30]

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export function detectJapaneseScript(text: string) {
  const clean = text.trim()
  const hasHiragana = /[\u3040-\u309F]/.test(clean)
  const hasKatakana = /[\u30A0-\u30FF\uFF65-\uFF9F]/.test(clean)
  const hasKanji    = /[\u4E00-\u9FAF\u3400-\u4DBF]/.test(clean)

  const isValid = hasHiragana || hasKatakana || hasKanji

  const scripts: string[] = []
  if (hasKanji) scripts.push('Kanji (漢字)')
  if (hasHiragana) scripts.push('Hiragana (ひらがな)')
  if (hasKatakana) scripts.push('Katakana (カタカナ)')

  return {
    isValid,
    hasHiragana,
    hasKatakana,
    hasKanji,
    scripts,
    detectedSummary: scripts.length > 0 ? scripts.join(', ') : 'Belum ada karakter Jepang',
  }
}

/**
 * Gambar kotoba yang selalu tampil utuh (object-contain) — tidak terpotong apa pun rasio fotonya.
 * Sisa ruang diisi versi blur dari foto yang sama agar tetap terlihat rapi.
 */
function KotobaImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-400 ${className}`}>
        <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-[11px] font-medium">Gambar tidak dapat dimuat</span>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden bg-slate-100 dark:bg-slate-800 ${className}`}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="absolute inset-0 size-full object-cover scale-110 blur-xl opacity-60 dark:opacity-40"
      />
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="relative size-full object-contain"
      />
    </div>
  )
}

/* ── High-Performance Image Upload & Compressor Helpers ── */

/**
 * Mengunggah file gambar ke server PHP (/upload_kotoba.php).
 * File otomatis dioptimasi dan disimpan ke /uploads/kotoba/ sehingga DB hanya menyimpan URL pendek.
 * Jika endpoint gagal / offline, fallback ke base64 thumbnail yang sangat ringan.
 */
async function uploadKotobaImage(file: File): Promise<string> {
  try {
    const formData = new FormData()
    formData.append('image', file)

    const endpoints = ['/upload_kotoba.php', '/api/upload_kotoba.php']
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          method: 'POST',
          body: formData,
        })
        if (res.ok) {
          const json = await res.json()
          if (json.success && (json.relative_url || json.url)) {
            return json.relative_url || json.url
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('Upload kotoba direct note, fallback to fast client compressor:', err)
  }

  // Fallback cepat single-pass jika server endpoint tidak terjangkau (misal mode offline / local dev)
  return compressImageFileFast(file, 480, 0.6)
}

function compressImageFileFast(file: File, maxWidth = 480, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const raw = reader.result as string
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width
        let h = img.height
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w)
          w = maxWidth
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h)
          try {
            const webp = canvas.toDataURL('image/webp', quality)
            if (webp && webp.startsWith('data:image/webp') && webp.length < 40 * 1024) {
              resolve(webp)
              return
            }
          } catch {}
          resolve(canvas.toDataURL('image/jpeg', quality))
        } else {
          resolve(raw)
        }
      }
      img.onerror = () => resolve(raw)
      img.src = raw
    }
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

export default function SetoranKotobaPage() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const { toast } = useToast()
  const effectiveUserId = user?.id || profile?.id || null
  const [kotobaList, setKotobaList] = useState<UserKotoba[]>([])
  const [loading, setLoading]       = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'unmastered' | 'mastered'>('all')
  const [showGuide, setShowGuide]   = useState(true)

  // Modal Create/Edit State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<UserKotoba | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [formData, setFormData]       = useState({
    japanese: '',
    romaji: '',
    meaning: '',
    image_url: '',
  })
  const [saving, setSaving]           = useState(false)
  // Validasi isian form: pesan tampil setelah kolom disentuh atau saat mencoba menyimpan
  const [showFormErrors, setShowFormErrors] = useState(false)
  const [touchedFields, setTouchedFields]   = useState<Partial<Record<'japanese' | 'romaji' | 'meaning', boolean>>>({})
  const formValidation = validateKotobaInput(formData)
  const fieldError = (field: 'japanese' | 'romaji' | 'meaning') =>
    (showFormErrors || touchedFields[field]) ? formValidation.errors[field] : undefined
  const markTouched = (field: 'japanese' | 'romaji' | 'meaning') =>
    setTouchedFields(prev => (prev[field] ? prev : { ...prev, [field]: true }))

  // Ref untuk scroll-to-modal saat form dibuka & sinkronisasi realtime
  const modalRef = useRef<HTMLDivElement>(null)
  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSubmitTimeRef = useRef<number>(0)
  const uploadPromiseRef = useRef<Promise<string> | null>(null)

  // Flashcard Test Mode State
  const [isTestActive, setIsTestActive]       = useState(false)
  const [testPhase, setTestPhase]             = useState<TestPhase>('setup')
  const [testSource, setTestSource]           = useState<'all' | 'unmastered'>('all')
  const [testCount, setTestCount]             = useState(10)
  const [testDirection, setTestDirection]     = useState<TestDirection>('mixed')
  const [testItems, setTestItems]             = useState<{ item: UserKotoba; front: CardFront }[]>([])
  const [currentTestIndex, setCurrentTestIndex] = useState(0)
  const [isCardFlipped, setIsCardFlipped]     = useState(false)
  const [testAnswers, setTestAnswers]         = useState<{ item: UserKotoba; mastered: boolean }[]>([])
  const answeredIndexRef = useRef(-1)

  // Lightbox: lihat foto kotoba layar penuh
  const [previewItem, setPreviewItem] = useState<UserKotoba | null>(null)
  useEffect(() => {
    if (!previewItem) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewItem(null) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [previewItem])

  // Custom Alert Modal State
  const [alertConfig, setAlertConfig] = useState<AlertModalConfig>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    buttonText: 'Mengerti',
    onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
  })

  // Load Kotoba from Database and Local Storage Backup with Realtime Sync
  useEffect(() => {
    localStorage.removeItem('kaiwa_user_kotoba_active_global')
    if (!effectiveUserId) {
      setKotobaList([])
      setLoading(false)
      return
    }

    loadKotobaList()

    // Realtime Postgres listener — debounced so bulk inserts don't trigger N re-fetches
    const channel = supabase
      .channel('kotoba_realtime_' + effectiveUserId)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_kotoba_submissions',
        filter: `user_id=eq.${effectiveUserId}`
      }, () => {
        // Lewati reload jika perubahannya berasal dari submit lokal kita sendiri dalam 2.5 detik terakhir
        if (Date.now() - lastSubmitTimeRef.current < 2500) {
          return
        }
        if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
        realtimeDebounceRef.current = setTimeout(() => loadKotobaList(), 800)
      })
      .subscribe()

    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
      supabase.removeChannel(channel)
    }
  }, [user?.id, profile?.id, effectiveUserId])

  async function loadKotobaList() {
    if (!effectiveUserId) {
      setKotobaList([])
      setLoading(false)
      return
    }

    const storageKey = `kaiwa_user_kotoba_${effectiveUserId}`

    // 1. Baca cache localStorage untuk rendering instan
    const localData = localStorage.getItem(storageKey)
    let localItems: UserKotoba[] = []
    if (localData) {
      try {
        localItems = JSON.parse(localData)
        if (localItems.length > 0) {
          setKotobaList(localItems)
          setLoading(false)
        }
      } catch {}
    }

    if (!localItems.length) {
      setLoading(true)
    }

    if (effectiveUserId === 'guest') {
      setKotobaList(localItems)
      setLoading(false)
      return
    }

    // 2. Ambil daftar dari DB TANPA image_url. Gambar (bisa base64 berukuran besar) diambil
    //    terpisah per batch — sebelumnya satu respons raksasa membuat request gagal/timeout
    //    saat jumlah kotoba sudah banyak (±120), lalu daftar ditimpa kosong.
    const { data, error } = await supabase
      .from('user_kotoba_submissions')
      .select('id, user_id, japanese, romaji, meaning, is_mastered, created_at')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false })

    if (error || !Array.isArray(data)) {
      // JANGAN timpa daftar/cache dengan list kosong saat request gagal — data di server tetap aman
      console.warn('Load kotoba DB error, keeping cached list:', error)
      setKotobaList(localItems)
      setLoading(false)
      if (!localItems.length) {
        toast.error('Gagal memuat daftar kotoba dari server. Data kamu tetap aman, silakan muat ulang halaman.', 'Koneksi Bermasalah')
      }
      return
    }

    const localImageById = new Map(
      localItems.filter(k => k.image_url).map(k => [k.id, k.image_url as string])
    )
    let dbItems: UserKotoba[] = (data as UserKotoba[]).map(k => ({
      ...k,
      image_url: localImageById.get(k.id),
    }))

    // 3. Sinkronkan item lokal yang belum tersimpan (id 'kotoba-*'), lewati yang sudah ada di DB
    const dbWords = new Set(dbItems.map(k => k.japanese.trim().toLowerCase()))
    const unsyncedLocals = localItems.filter(
      item => item.id.startsWith('kotoba-') && !dbWords.has(item.japanese.trim().toLowerCase())
    )
    if (unsyncedLocals.length > 0) {
      const { data: inserted, error: syncErr } = await supabase
        .from('user_kotoba_submissions')
        .insert(
          unsyncedLocals.map(un => ({
            user_id: effectiveUserId,
            japanese: un.japanese,
            romaji: un.romaji,
            meaning: un.meaning,
            image_url: un.image_url || null,
            is_mastered: un.is_mastered || false,
          }))
        )
      if (!syncErr && Array.isArray(inserted)) {
        dbItems = [...(inserted as UserKotoba[]), ...dbItems]
      } else {
        // Tetap tampilkan & simpan item lokal agar tidak hilang; dicoba lagi pada load berikutnya
        console.warn('Auto-sync kotoba batch note:', syncErr)
        dbItems = [...unsyncedLocals, ...dbItems]
      }
    }

    saveToLocal(dbItems)
    setLoading(false)

    // 4. Lengkapi gambar yang belum ada di cache, per batch kecil
    const missingImageIds = dbItems
      .filter(k => !k.image_url && !k.id.startsWith('kotoba-'))
      .map(k => k.id)
    const IMAGE_BATCH_SIZE = 10
    for (let i = 0; i < missingImageIds.length; i += IMAGE_BATCH_SIZE) {
      const batch = missingImageIds.slice(i, i + IMAGE_BATCH_SIZE)
      const { data: imgRows, error: imgErr } = await supabase
        .from('user_kotoba_submissions')
        .select('id, image_url')
        .in('id', batch)
      if (imgErr || !Array.isArray(imgRows)) continue
      const imgById = new Map(
        (imgRows as { id: string; image_url: string | null }[])
          .filter(r => r.image_url)
          .map(r => [r.id, r.image_url as string])
      )
      if (imgById.size === 0) continue
      // Patch state & cache secara terpisah (bukan menimpa dengan snapshot) agar kotoba yang
      // ditambahkan user selama gambar dimuat tidak ikut tertimpa
      const withImages = (list: UserKotoba[]) =>
        list.map(k => imgById.has(k.id) ? { ...k, image_url: imgById.get(k.id) } : k)
      setKotobaList(prev => withImages(prev))
      try {
        const cached = localStorage.getItem(storageKey)
        if (cached) localStorage.setItem(storageKey, JSON.stringify(withImages(JSON.parse(cached))))
      } catch {
        // Kuota localStorage penuh: gambar tetap tampil dari state, cukup tidak di-cache
      }
    }
  }

  function saveToLocal(updatedList: UserKotoba[]) {
    setKotobaList(updatedList)
    if (effectiveUserId) {
      const storageKey = `kaiwa_user_kotoba_${effectiveUserId}`
      try {
        localStorage.setItem(storageKey, JSON.stringify(updatedList))
      } catch (e) {
        console.warn('localStorage save warning (quota exceeded):', e)
        try {
          // Bersihkan data base64 dari cache lokal jika storage browser hampir habis
          const lightweight = updatedList.map(item => ({
            ...item,
            image_url: item.image_url?.startsWith('data:image') ? undefined : item.image_url,
          }))
          localStorage.setItem(storageKey, JSON.stringify(lightweight))
        } catch {}
      }
    }
    // Dispatch mission event only — NOT 'storage' to avoid triggering redundant loadKotobaList
    window.dispatchEvent(new Event('kaiwa_mission_progress_updated'))
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)

    // Tampilkan preview instan 0ms menggunakan Object URL (bebas lag CPU)
    const previewUrl = URL.createObjectURL(file)
    setFormData(prev => ({ ...prev, image_url: previewUrl }))

    // Mulai upload ke server di background selagi user mengisi form
    uploadPromiseRef.current = uploadKotobaImage(file)
  }

  function scrollToModal() {
    // Scroll halaman ke atas agar modal overlay (fixed) terlihat penuh di viewport
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleOpenCreateModal() {
    setEditingItem(null)
    setSelectedFile(null)
    setShowFormErrors(false)
    setTouchedFields({})
    uploadPromiseRef.current = null
    setFormData({
      japanese: '',
      romaji: '',
      meaning: '',
      image_url: '',
    })
    setIsModalOpen(true)
    scrollToModal()
  }

  async function handleOpenEditModal(item: UserKotoba) {
    setSelectedFile(null)
    setShowFormErrors(false)
    setTouchedFields({})
    uploadPromiseRef.current = null

    // Jika image_url tidak ada di state (tidak ter-cache), fetch dari DB dulu
    // agar edit modal selalu menampilkan gambar yang benar
    let imageUrl = item.image_url || ''
    if (!imageUrl && item.id && !item.id.startsWith('kotoba-')) {
      try {
        const { data } = await supabase
          .from('user_kotoba_submissions')
          .select('image_url')
          .eq('id', item.id)
          .maybeSingle()
        if (data?.image_url) {
          imageUrl = data.image_url
          // Update item di state + cache agar tidak perlu fetch lagi nanti
          setKotobaList(prev => prev.map(k => k.id === item.id ? { ...k, image_url: data.image_url } : k))
        }
      } catch (e) {
        console.warn('Fetch image_url for edit note:', e)
      }
    }

    setEditingItem(item)
    setFormData({
      japanese: item.japanese,
      romaji: item.romaji,
      meaning: item.meaning,
      image_url: imageUrl,
    })
    setIsModalOpen(true)
    scrollToModal()
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault()
    // Validasi ketat: huruf Jepang, cara baca, dan arti harus sesuai ketentuan (tidak asal isi)
    const validation = validateKotobaInput(formData)
    if (!validation.isValid) {
      setShowFormErrors(true)
      const messages = [
        validation.errors.japanese && `• Huruf Jepang: ${validation.errors.japanese}`,
        validation.errors.romaji && `• Cara baca: ${validation.errors.romaji}`,
        validation.errors.meaning && `• Arti: ${validation.errors.meaning}`,
      ].filter(Boolean).join('\n')
      setAlertConfig({
        isOpen: true,
        title: 'Periksa Kembali Isianmu',
        message: messages,
        type: 'warning',
        buttonText: 'Perbaiki',
        onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
      })
      return
    }
    const clean = validation.cleaned

    // ── Duplicate Check (CREATE only) ──
    if (!editingItem) {
      const inputJapanese = clean.japanese.toLowerCase()
      const duplicate = kotobaList.find(
        k => k.japanese.trim().toLowerCase() === inputJapanese
      )
      if (duplicate) {
        setAlertConfig({
          isOpen: true,
          title: 'Kosakata Sudah Ada',
          message: `Kosakata "${duplicate.japanese}" (${duplicate.romaji}) sudah pernah kamu catat sebelumnya. Silakan cek daftarmu atau gunakan tombol Edit jika ingin mengubah datanya.`,
          type: 'warning',
          buttonText: 'Mengerti',
          onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
        })
        return
      }
    }

    setSaving(true)
    lastSubmitTimeRef.current = Date.now()

    // Ambil URL gambar yang sudah diupload (atau tunggu background upload selesai)
    let processedImageUrl: string | undefined = undefined
    if (selectedFile) {
      if (uploadPromiseRef.current) {
        processedImageUrl = await uploadPromiseRef.current
      } else {
        processedImageUrl = await uploadKotobaImage(selectedFile)
      }
    } else if (formData.image_url.trim()) {
      // Gambar tidak diubah oleh user, pertahankan URL lama
      processedImageUrl = formData.image_url.trim()
    }

    const targetUid = profile?.id || user?.id || effectiveUserId || ''

    if (editingItem) {
      // ── EDIT: Update local state immediately, then sync DB in background ──
      const updated = kotobaList.map(item =>
        item.id === editingItem.id
          ? {
              ...item,
              japanese: clean.japanese,
              romaji: clean.romaji,
              meaning: clean.meaning,
              image_url: processedImageUrl,
            }
          : item
      )
      saveToLocal(updated)
      setIsModalOpen(false)
      setSaving(false)
      toast.success(`Kosakata "${clean.japanese}" berhasil diperbarui!`, 'Setoran Kotoba')

      // Fire-and-forget DB update — UI is already responsive
      const imageChanged = processedImageUrl !== (editingItem.image_url || '')
      const updatePayload: Record<string, unknown> = {
        japanese: clean.japanese,
        romaji: clean.romaji,
        meaning: clean.meaning,
      }
      if (imageChanged) {
        updatePayload.image_url = processedImageUrl || null
      }

      supabase
        .from('user_kotoba_submissions')
        .update(updatePayload)
        .eq('id', editingItem.id)
        .then(({ error }) => { if (error) console.warn('Update kotoba DB error:', error) })
    } else {
      // ── CREATE: Insert into local state first, then DB in background ──
      const tempId = `kotoba-${Date.now()}`
      const newItem: UserKotoba = {
        id: tempId,
        user_id: targetUid,
        japanese: clean.japanese,
        romaji: clean.romaji,
        meaning: clean.meaning,
        image_url: processedImageUrl,
        is_mastered: false,
        created_at: new Date().toISOString(),
      }

      // UI closes immediately with optimistic local state
      const updated = [newItem, ...kotobaList]
      saveToLocal(updated)
      setIsModalOpen(false)
      setSaving(false)
      toast.success(`Kosakata "${clean.japanese}" berhasil disetor! 📚`, 'Setoran Berhasil')

      // DB insert + mission sync run in background (non-blocking)
      if (targetUid && targetUid !== 'guest' && targetUid !== 'active_user') {
        ;(async () => {
          try {
            const { data, error } = await supabase
              .from('user_kotoba_submissions')
              .insert({
                user_id: targetUid,
                japanese: clean.japanese,
                romaji: clean.romaji,
                meaning: clean.meaning,
                image_url: processedImageUrl || null,
                is_mastered: false,
              })
              .select('id')
              .single()

            if (!error && data?.id) {
              // Replace temp id with real DB id in local state + cache
              const storageKey = `kaiwa_user_kotoba_${targetUid}`
              setKotobaList(prev => prev.map(k => k.id === tempId ? { ...k, id: data.id } : k))
              const cached = localStorage.getItem(storageKey)
              if (cached) {
                try {
                  const parsed: UserKotoba[] = JSON.parse(cached)
                  localStorage.setItem(storageKey, JSON.stringify(
                    parsed.map(k => k.id === tempId ? { ...k, id: data.id } : k)
                  ))
                } catch {}
              }

              // Mission progress sync (also background)
              supabase.from('lesson_progress').upsert({
                student_id: targetUid,
                lesson_id: `user_kotoba_${data.id}`,
                is_completed: true,
                last_watched_at: new Date().toISOString(),
              }, { onConflict: 'student_id,lesson_id' }).then(async () => {
                try {
                  const todayStr = new Date().toISOString().split('T')[0]
                  const mission = (await fetchDailyMission(targetUid, todayStr)) || getDailyMission(targetUid, todayStr)
                  if (mission) await calculateMissionProgress(targetUid, mission)
                } catch {}
              })
            } else if (error) {
              console.warn('Insert kotoba DB note:', error)
              // Show error alert to user so they know the save failed
              setAlertConfig({
                isOpen: true,
                title: 'Gagal Menyimpan ke Server',
                message: `Kosakata berhasil dicatat secara lokal, namun gagal tersimpan ke server database. Kemungkinan penyebab: sesi login berakhir atau koneksi terputus. Silakan coba logout dan login kembali, lalu tambahkan kosakata ulang.\n\nDetail: ${error.message || 'Unknown error'}`,
                type: 'warning',
                buttonText: 'Mengerti',
                onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
              })
            }
          } catch (err) {
            console.warn('Insert kotoba DB catch:', err)
          }
        })()
      } else {
        // User session not found — warn clearly
        setAlertConfig({
          isOpen: true,
          title: 'Sesi Login Tidak Ditemukan',
          message: 'Kosakata berhasil dicatat secara lokal, namun tidak dapat disimpan ke server karena sesi login kamu tidak ditemukan. Silakan logout dan login kembali untuk sinkronisasi data.',
          type: 'warning',
          buttonText: 'Mengerti',
          onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
        })
      }
    }
  }

  async function handleToggleMastered(item: UserKotoba) {
    const updatedStatus = !item.is_mastered
    const updated = kotobaList.map(k => k.id === item.id ? { ...k, is_mastered: updatedStatus } : k)
    saveToLocal(updated)

    if (updatedStatus) {
      toast.success(`Hebat! "${item.japanese}" ditandai sudah hafal 🎉`, 'Progres Kotoba')
    } else {
      toast.info(`Status "${item.japanese}" diubah ke belum hafal`, 'Progres Kotoba')
    }

    try {
      await supabase
        .from('user_kotoba_submissions')
        .update({ is_mastered: updatedStatus })
        .eq('id', item.id)
    } catch (err) {
      console.warn('Toggle mastered DB note:', err)
    }
  }

  async function handleDeleteItem(id: string) {
    const targetItem = kotobaList.find(k => k.id === id)
    const wordLabel = targetItem?.japanese ? `"${targetItem.japanese}"` : 'kosakata ini'
    if (!confirm(`Apakah kamu yakin ingin menghapus ${wordLabel} dari catatan setoran kotoba?`)) return

    const updated = kotobaList.filter(k => k.id !== id)
    saveToLocal(updated)
    toast.info(`Kosakata ${wordLabel} telah dihapus dari catatan.`, 'Dihapus')

    if (effectiveUserId && effectiveUserId !== 'guest' && effectiveUserId !== 'active_user') {
      try {
        await supabase
          .from('user_kotoba_submissions')
          .delete()
          .eq('id', id)

        await supabase
          .from('lesson_progress')
          .delete()
          .eq('student_id', effectiveUserId)
          .eq('lesson_id', `user_kotoba_${id}`)

        const todayStr = new Date().toISOString().split('T')[0]
        const mission = (await fetchDailyMission(effectiveUserId, todayStr)) || getDailyMission(effectiveUserId, todayStr)
        if (mission) {
          await calculateMissionProgress(effectiveUserId, mission)
        }
      } catch (err) {
        console.warn('Delete kotoba DB note:', err)
      }
    }
  }

  /* ── Flashcard Test Logic ── */
  function handleStartTest() {
    if (kotobaList.length === 0) {
      setAlertConfig({
        isOpen: true,
        title: 'Jurnal Masih Kosong',
        message: 'Kamu belum memiliki catatan di "Jurnal Kosakata". Tambah beberapa kosakata terlebih dahulu untuk memulai fitur "Uji Hafalan Kosakata"!',
        type: 'info',
        buttonText: 'Tambah Kosakata',
        onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
      })
      return
    }

    // Buka layar pengaturan: default sumber "masih dipelajari" jika ada, jumlah 10 kartu
    const unmastered = kotobaList.filter(k => !k.is_mastered).length
    const source = unmastered > 0 ? 'unmastered' : 'all'
    const poolSize = source === 'unmastered' ? unmastered : kotobaList.length
    setTestSource(source)
    setTestCount(Math.min(10, poolSize))
    setTestPhase('setup')
    setIsTestActive(true)
  }

  function getTestPool(source: 'all' | 'unmastered') {
    return source === 'unmastered' ? kotobaList.filter(k => !k.is_mastered) : kotobaList
  }

  function changeTestSource(source: 'all' | 'unmastered') {
    setTestSource(source)
    const poolSize = getTestPool(source).length
    setTestCount(prev => Math.max(1, Math.min(prev || 10, poolSize)))
  }

  function beginTestSession(items: UserKotoba[]) {
    if (items.length === 0) return
    const deck = shuffleArray(items).map(item => ({
      item,
      front: (testDirection === 'mixed'
        ? (Math.random() < 0.5 ? 'japanese' : 'meaning')
        : testDirection) as CardFront,
    }))
    answeredIndexRef.current = -1
    setTestItems(deck)
    setCurrentTestIndex(0)
    setIsCardFlipped(false)
    setTestAnswers([])
    setTestPhase('playing')
  }

  function handleBeginTest() {
    const pool = getTestPool(testSource)
    const count = Math.max(1, Math.min(testCount, pool.length))
    beginTestSession(shuffleArray(pool).slice(0, count))
  }

  function handleSelfAssessment(isMasteredChoice: boolean) {
    const current = testItems[currentTestIndex]
    if (!current || !isCardFlipped) return
    // Cegah double-tap menilai kartu yang sama dua kali (dan melompati kartu berikutnya)
    if (answeredIndexRef.current === currentTestIndex) return
    answeredIndexRef.current = currentTestIndex
    const currentItem = current.item

    // Simpan status hafalan (lokal langsung, DB di latar belakang agar kartu berikut tampil instan)
    saveToLocal(kotobaList.map(k => k.id === currentItem.id ? { ...k, is_mastered: isMasteredChoice } : k))
    if (user && !currentItem.id.startsWith('kotoba-')) {
      supabase
        .from('user_kotoba_submissions')
        .update({ is_mastered: isMasteredChoice })
        .eq('id', currentItem.id)
        .then(({ error }) => { if (error) console.warn('Update mastered (test) note:', error) })
    }

    setTestAnswers(prev => [...prev, { item: currentItem, mastered: isMasteredChoice }])

    if (currentTestIndex + 1 < testItems.length) {
      setIsCardFlipped(false)
      setCurrentTestIndex(currentTestIndex + 1)
    } else {
      setTestPhase('finished')
    }
  }

  function closeTest() {
    setIsTestActive(false)
    setIsCardFlipped(false)
  }

  // Keyboard (desktop): Spasi/Enter = balik kartu, ← = masih sulit, → = sudah hafal, Esc = tutup
  useEffect(() => {
    if (!isTestActive) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeTest(); return }
      if (testPhase !== 'playing') return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        setIsCardFlipped(f => !f)
      } else if (isCardFlipped && e.key === 'ArrowLeft') {
        handleSelfAssessment(false)
      } else if (isCardFlipped && e.key === 'ArrowRight') {
        handleSelfAssessment(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [isTestActive, testPhase, isCardFlipped, currentTestIndex, testItems, kotobaList, user])

  // Filter & Search
  const filteredList = kotobaList.filter(item => {
    const matchesSearch =
      item.japanese.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.romaji.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.meaning.toLowerCase().includes(searchTerm.toLowerCase())

    if (filterMode === 'mastered') return matchesSearch && item.is_mastered
    if (filterMode === 'unmastered') return matchesSearch && !item.is_mastered
    return matchesSearch
  })

  const totalCount    = kotobaList.length
  const masteredCount = kotobaList.filter(k => k.is_mastered).length

  const activeTestItem = testItems[currentTestIndex]

  return (
    <main className="flex-1 p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">
      {/* Header Banner */}
      <header className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 mb-4 sm:mb-6 text-white shadow-md animate-fade-in">
        <div className="absolute -top-12 -right-12 size-56 bg-white/10 rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4.5">
          <div className="max-w-2xl">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-xs">
                Catatan Kosakata Mandiri
              </span>
            </div>
            <h1 className="text-base sm:text-xl lg:text-2xl font-bold tracking-tight mb-0.5 leading-tight">
              {t('sk_title', 'Jurnal Kosakata (Kotoba) Saya')}
            </h1>
            <p className="text-white/90 text-[11px] sm:text-xs leading-relaxed">
              {t('sk_subtitle', 'Catat dan simpan setiap kosakata Bahasa Jepang baru yang kamu temukan. Uji hafalanmu secara berkala untuk menentukan kata yang sudah kamu kuasai!')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <button
              onClick={handleStartTest}
              className="group px-3 py-1.5 sm:px-3.5 sm:py-2 bg-amber-900/40 hover:bg-amber-900/60 border border-white/30 text-white text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5 min-h-[30px] sm:min-h-[34px]"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span>{t('sk_test_btn', 'Uji Hafalan Kosakata')}</span>
              <span className="size-4 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:translate-x-0.5 transition-transform">
                <svg className="size-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="group px-3 py-1.5 sm:px-4 sm:py-2 bg-white text-amber-600 hover:bg-amber-50 text-[11px] sm:text-xs font-bold rounded-lg sm:rounded-xl border-none cursor-pointer transition-all shadow-xs hover:scale-105 active:scale-95 flex items-center justify-center gap-1.5 min-h-[30px] sm:min-h-[34px]"
            >
              <svg className="size-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span>{t('sk_add_btn', 'Tambah Kosakata')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Guide Banner: Panduan Cara Mengisi */}
      {showGuide && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 mb-4 sm:mb-6 text-slate-800 dark:text-slate-100 flex flex-col md:flex-row gap-3 sm:gap-5 justify-between items-start">
          <div className="space-y-1.5 sm:space-y-2 flex-1">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-extrabold text-xs sm:text-sm">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{t('sk_guide_title', 'Panduan Menambah & Menguji Kosakata')}</span>
            </div>
            <p className="text-[0.72rem] sm:text-xs text-slate-600 dark:text-slate-300">
              1. Catat kata baru dengan tombol <strong>"Tambah Kosakata"</strong>.<br />
              2. Tekan <strong>"Uji Hafalan Kosakata"</strong> untuk melakukan tes evaluasi mandiri.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-amber-100 dark:border-amber-950 text-[0.68rem] sm:text-xs">
                <span className="font-extrabold text-amber-600 block mb-0.5">1. Huruf Jepang</span>
                Kanji / Kana (e.g. <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">食べる</code>)
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-amber-100 dark:border-amber-950 text-[0.68rem] sm:text-xs">
                <span className="font-extrabold text-amber-600 block mb-0.5">2. Romaji</span>
                Pelafalan latin (e.g. <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">taberu</code>)
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-amber-100 dark:border-amber-950 text-[0.68rem] sm:text-xs">
                <span className="font-extrabold text-amber-600 block mb-0.5">3. Makna / Arti</span>
                Terjemahan (e.g. <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Makan</code>)
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-amber-100 dark:border-amber-950 text-[0.68rem] sm:text-xs">
                <span className="font-extrabold text-amber-600 block mb-0.5">4. Gambar Visual</span>
                Foto visual pendukung
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowGuide(false)}
            className="text-[0.68rem] sm:text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 font-bold border-none bg-transparent cursor-pointer shrink-0 flex items-center gap-1"
          >
            <span>{t('sk_guide_hide', 'Sembunyikan')}</span>
            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center sm:gap-4 text-center sm:text-left">
          <div className="size-8 sm:size-12 rounded-lg sm:rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-serif text-sm sm:text-xl font-black shrink-0 mb-1 sm:mb-0">
            語
          </div>
          <div>
            <div className="text-base sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">{totalCount}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">{t('sk_stat_total', 'Total Kosakata')}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center sm:gap-4 text-center sm:text-left">
          <div className="size-8 sm:size-12 rounded-lg sm:rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-emerald-600 shrink-0 mb-1 sm:mb-0">
            <svg className="size-4 sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <div className="text-base sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">{masteredCount}</div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">{t('sk_stat_mastered', 'Dikuasai')}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center sm:gap-4 text-center sm:text-left">
          <div className="size-8 sm:size-12 rounded-lg sm:rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mb-1 sm:mb-0">
            <svg className="size-4 sm:size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <div className="text-base sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">
              {totalCount > 0 ? `${Math.round((masteredCount / totalCount) * 100)}%` : '0%'}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">{t('sk_stat_memorization', 'Tingkat Hafal')}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-3 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-sm mb-4 sm:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Pills — 3 kolom rata di HP */}
        <div role="tablist" className="grid grid-cols-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full md:w-auto gap-1">
          {([
            { key: 'all', label: t('sk_filter_all', 'Semua'), count: totalCount, active: 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm' },
            { key: 'unmastered', label: t('sk_filter_unmastered_short', 'Dipelajari'), count: totalCount - masteredCount, active: 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm' },
            { key: 'mastered', label: t('sk_filter_mastered_short', 'Dikuasai'), count: masteredCount, active: 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm' },
          ] as const).map(f => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filterMode === f.key}
              onClick={() => setFilterMode(f.key)}
              className={`min-h-10 px-2 md:px-4 rounded-lg text-[13px] sm:text-sm font-semibold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
                filterMode === f.key ? f.active : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <span className="truncate">{f.label}</span>
              <span className="text-[11px] font-bold leading-none px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-700/70">{f.count}</span>
            </button>
          ))}
        </div>

        {/* Search input */}
        <div className="relative w-full md:w-80">
          <input
            type="search"
            enterKeyHint="search"
            placeholder={t('sk_search_placeholder', 'Cari kanji, romaji, atau arti...')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-base sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 transition-all [&::-webkit-search-cancel-button]:hidden"
          />
          <svg className="size-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Hapus pencarian"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 border-none bg-transparent cursor-pointer"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Kotoba Cards Grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <div className="size-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <span>Memuat catatan kosakatamu...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flex flex-col gap-6">
          {/* Empty State Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-3">
            <div className="size-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center font-serif font-black text-2xl">
              語
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {searchTerm || filterMode !== 'all' ? 'Kosakata Tidak Ditemukan' : 'Belum Ada Catatan Kosakata'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
              {searchTerm
                ? 'Tidak ada kosakata yang cocok dengan pencarianmu.'
                : filterMode !== 'all'
                  ? 'Belum ada kosakata di kategori ini.'
                  : 'Kamu belum menambah kosakata baru. Klik tombol di bawah untuk mencatat kata Jepang pertamamu!'}
            </p>
            {searchTerm || filterMode !== 'all' ? (
              <button
                onClick={() => { setSearchTerm(''); setFilterMode('all') }}
                className="mt-1 h-11 px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold rounded-xl border-none cursor-pointer transition-colors"
              >
                Tampilkan Semua Kosakata
              </button>
            ) : (
              <button
                onClick={handleOpenCreateModal}
                className="mt-1 h-11 px-5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-xl border-none cursor-pointer transition-all shadow-md active:scale-95"
              >
                Tambah Kosakata Pertama
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredList.map(item => (
            <article
              key={item.id}
              className={`group flex flex-col rounded-2xl bg-white dark:bg-slate-900 border overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 ${
                item.is_mastered
                  ? 'border-emerald-300 dark:border-emerald-800/70'
                  : 'border-slate-200 dark:border-slate-800 hover:border-amber-400/70'
              }`}
            >
              {/* Media: foto utuh (tap untuk layar penuh) atau placeholder tambah gambar */}
              <div className="relative">
                {item.image_url ? (
                  <button
                    type="button"
                    onClick={() => setPreviewItem(item)}
                    aria-label={`Lihat gambar ${item.japanese}`}
                    className="block w-full p-0 border-none bg-transparent cursor-zoom-in"
                  >
                    <KotobaImage
                      key={item.image_url}
                      src={item.image_url}
                      alt={`${item.japanese} (${item.romaji})`}
                      className="w-full aspect-square sm:aspect-[4/3]"
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(item)}
                    className="relative w-full aspect-square sm:aspect-[4/3] overflow-hidden border-none cursor-pointer bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-slate-900 flex items-center justify-center"
                  >
                    <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-serif font-black text-[5.5rem] sm:text-[6.5rem] leading-none text-amber-500/15 select-none">
                      {Array.from(item.japanese.trim())[0] || '語'}
                    </span>
                    <span className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-amber-700 dark:text-amber-300 text-xs font-semibold shadow-xs opacity-90 group-hover:opacity-100">
                      <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Gambar
                    </span>
                  </button>
                )}

                {item.is_mastered && (
                  <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[11px] font-bold shadow-sm pointer-events-none">
                    <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Hafal
                  </span>
                )}
                {item.id.startsWith('kotoba-') && (
                  <span title="Menunggu tersimpan ke server" className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/70 text-white text-[11px] font-semibold pointer-events-none">
                    <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Sinkron
                  </span>
                )}
              </div>

              {/* Text */}
              <div className="flex-1 p-3 sm:p-4 pb-2 sm:pb-2 min-w-0">
                <h3 className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white leading-tight break-words">
                  {item.japanese}
                </h3>
                <p className="text-[13px] sm:text-sm font-semibold text-amber-600 dark:text-amber-400 mt-0.5 break-words">
                  {item.romaji}
                </p>
                <p className="text-[13px] sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-snug line-clamp-2" title={item.meaning}>
                  {item.meaning}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 p-3 sm:p-4 pt-1 sm:pt-1">
                <button
                  onClick={() => handleToggleMastered(item)}
                  aria-pressed={item.is_mastered}
                  className={`flex-1 min-w-0 h-10 px-2 rounded-xl text-[13px] font-bold cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                    item.is_mastered
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-none'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 hover:text-emerald-600'
                  }`}
                >
                  <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={item.is_mastered ? 3 : 2}>
                    {item.is_mastered
                      ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      : <circle cx="12" cy="12" r="8" />}
                  </svg>
                  <span className="truncate">
                    <span className="sm:hidden">Hafal</span>
                    <span className="hidden sm:inline">{item.is_mastered ? 'Sudah Hafal' : 'Tandai Hafal'}</span>
                  </span>
                </button>
                <button
                  onClick={() => handleOpenEditModal(item)}
                  aria-label={`Edit ${item.japanese}`}
                  title="Edit"
                  className="size-10 shrink-0 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer transition-colors"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  aria-label={`Hapus ${item.japanese}`}
                  title="Hapus"
                  className="size-10 shrink-0 rounded-xl flex items-center justify-center text-red-500 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/50 border-none cursor-pointer transition-colors"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Lightbox: foto kotoba layar penuh */}
      {previewItem?.image_url && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Gambar ${previewItem.japanese}`}
          onClick={() => setPreviewItem(null)}
          className="modal-overlay fixed inset-0 z-[1000] bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in"
        >
          <button
            type="button"
            onClick={() => setPreviewItem(null)}
            aria-label="Tutup"
            className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3 size-11 rounded-full bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer flex items-center justify-center"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={previewItem.image_url}
            alt={`${previewItem.japanese} (${previewItem.romaji})`}
            onClick={e => e.stopPropagation()}
            className="max-w-full max-h-[72dvh] object-contain rounded-xl shadow-2xl"
          />
          <div onClick={e => e.stopPropagation()} className="mt-4 text-center text-white max-w-md">
            <p className="text-2xl font-black">{previewItem.japanese}</p>
            <p className="text-sm font-semibold text-amber-300">{previewItem.romaji}</p>
            <p className="text-sm text-white/80 mt-1">{previewItem.meaning}</p>
          </div>
        </div>
      )}

      {/* Flashcard Test Modal Screen */}
      {isTestActive && (() => {
        const pool = getTestPool(testSource)
        const poolSize = pool.length
        const unmasteredPoolSize = kotobaList.filter(k => !k.is_mastered).length
        const effectiveCount = Math.max(1, Math.min(testCount, poolSize))
        const masteredAnswers = testAnswers.filter(a => a.mastered)
        const difficultAnswers = testAnswers.filter(a => !a.mastered)
        const card = activeTestItem
        const scorePct = testAnswers.length ? Math.round((masteredAnswers.length / testAnswers.length) * 100) : 0
        const optionBase = 'rounded-xl border text-left transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
        const optionOn = 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 ring-2 ring-amber-500/20'
        const optionOff = 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-amber-300'

        return (
          <div className="modal-overlay fixed inset-0 z-[999] bg-slate-900/80 backdrop-blur-md sm:flex sm:items-center sm:justify-center sm:p-6 animate-fade-in">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="flashcard-title"
              className="w-full h-full sm:h-auto sm:max-h-[92dvh] sm:max-w-lg bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl sm:border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-scale-up"
            >
              {/* Header */}
              <div className="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-6 pt-[calc(0.875rem+env(safe-area-inset-top))] sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Flashcard Kotoba
                  </p>
                  <h3 id="flashcard-title" className="text-lg font-bold text-slate-900 dark:text-white leading-tight truncate">
                    {testPhase === 'setup'
                      ? 'Atur Sesi Latihan'
                      : testPhase === 'playing'
                        ? `Kartu ${currentTestIndex + 1} dari ${testItems.length}`
                        : 'Hasil Latihan'}
                  </h3>
                </div>
                <button
                  onClick={closeTest}
                  aria-label="Tutup"
                  className="size-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer flex items-center justify-center transition-colors"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {testPhase === 'playing' && (
                <div className="shrink-0 h-1 bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${(currentTestIndex / Math.max(1, testItems.length)) * 100}%` }}
                  />
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6">
                {/* ── SETUP ── */}
                {testPhase === 'setup' && (
                  <div className="flex flex-col gap-6">
                    {/* Jumlah kartu */}
                    <section>
                      <div className="flex items-baseline justify-between gap-2 mb-2.5">
                        <h4 className="text-sm font-bold text-slate-800 dark:text-white">Jumlah kartu</h4>
                        <span className="text-xs text-slate-500 dark:text-slate-400">dari {poolSize} kosakata</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {TEST_COUNT_PRESETS.filter(p => p < poolSize).map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setTestCount(p)}
                            className={`h-11 min-w-14 px-4 text-sm font-bold ${optionBase} ${testCount === p ? optionOn : optionOff} text-slate-800 dark:text-slate-100 text-center`}
                          >
                            {p}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setTestCount(poolSize)}
                          disabled={poolSize === 0}
                          className={`h-11 px-4 text-sm font-bold ${optionBase} ${testCount >= poolSize && poolSize > 0 ? optionOn : optionOff} text-slate-800 dark:text-slate-100 text-center`}
                        >
                          Semua ({poolSize})
                        </button>
                      </div>

                      {/* Stepper untuk jumlah custom */}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          aria-label="Kurangi jumlah kartu"
                          onClick={() => setTestCount(Math.max(1, effectiveCount - 1))}
                          disabled={effectiveCount <= 1}
                          className="size-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xl font-bold border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={poolSize}
                          value={poolSize === 0 ? 0 : effectiveCount}
                          onChange={e => {
                            const n = parseInt(e.target.value, 10)
                            if (!Number.isNaN(n)) setTestCount(Math.max(1, Math.min(n, poolSize)))
                          }}
                          aria-label="Jumlah kartu"
                          className="w-20 h-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center text-base font-bold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                        />
                        <button
                          type="button"
                          aria-label="Tambah jumlah kartu"
                          onClick={() => setTestCount(Math.min(poolSize, effectiveCount + 1))}
                          disabled={effectiveCount >= poolSize}
                          className="size-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xl font-bold border-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          +
                        </button>
                        <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">kartu</span>
                      </div>
                    </section>

                    {/* Sumber kata */}
                    <section>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2.5">Kosakata yang diuji</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { key: 'unmastered', title: 'Masih dipelajari', count: unmasteredPoolSize },
                          { key: 'all', title: 'Semua kosakata', count: kotobaList.length },
                        ] as const).map(opt => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => changeTestSource(opt.key)}
                            disabled={opt.count === 0}
                            className={`p-3 ${optionBase} ${testSource === opt.key ? optionOn : optionOff}`}
                          >
                            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{opt.title}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.count} kata</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Sisi depan kartu */}
                    <section>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2.5">Sisi depan kartu</h4>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { key: 'mixed', title: 'Acak', desc: 'Campuran' },
                          { key: 'japanese', title: 'Jepang', desc: 'Tebak arti' },
                          { key: 'meaning', title: 'Arti', desc: 'Tebak kata' },
                        ] as const).map(opt => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => setTestDirection(opt.key)}
                            className={`p-3 text-center ${optionBase} ${testDirection === opt.key ? optionOn : optionOff}`}
                          >
                            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{opt.title}</span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                      Ingat jawabannya dalam hati, ketuk kartu untuk membalik, lalu nilai sendiri. Status hafalan tersimpan otomatis ke jurnalmu.
                    </p>

                    <button
                      type="button"
                      onClick={handleBeginTest}
                      disabled={poolSize === 0}
                      className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-base font-bold border-none cursor-pointer shadow-md shadow-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Mulai {poolSize === 0 ? '' : `${effectiveCount} Kartu`}
                    </button>
                  </div>
                )}

                {/* ── PLAYING: flashcard ── */}
                {testPhase === 'playing' && card && (
                  <div className="flex flex-col gap-4">
                    <button
                      type="button"
                      onClick={() => setIsCardFlipped(f => !f)}
                      aria-label={isCardFlipped ? 'Kartu terbuka — ketuk untuk melihat sisi depan' : 'Ketuk untuk membalik kartu'}
                      className="block w-full p-0 border-none bg-transparent cursor-pointer select-none"
                      style={{ perspective: '1200px' }}
                    >
                      <div
                        key={currentTestIndex}
                        className="relative w-full h-[min(58dvh,440px)] min-h-[300px] transition-transform duration-500 ease-out"
                        style={{ transformStyle: 'preserve-3d', transform: isCardFlipped ? 'rotateY(180deg)' : 'none' }}
                      >
                        {/* Front */}
                        <div
                          className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:from-amber-950/50 dark:via-slate-900 dark:to-slate-900 border-2 border-amber-200 dark:border-amber-900/60 shadow-lg flex flex-col items-center p-5 overflow-hidden"
                          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                        >
                          <span className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950 px-3 py-1 rounded-full">
                            {card.front === 'japanese' ? 'Apa arti & cara bacanya?' : 'Apa bahasa Jepangnya?'}
                          </span>
                          <div className="flex-1 min-h-0 w-full flex flex-col items-center justify-center gap-4 text-center">
                            {card.front === 'meaning' && card.item.image_url && (
                              <KotobaImage
                                key={card.item.image_url}
                                src={card.item.image_url}
                                alt="Petunjuk gambar"
                                className="w-full max-w-[16rem] aspect-[4/3] rounded-2xl shrink min-h-0"
                              />
                            )}
                            {card.front === 'japanese' ? (
                              <p className="text-5xl sm:text-6xl font-black text-slate-900 dark:text-white leading-tight break-words max-w-full">
                                {card.item.japanese}
                              </p>
                            ) : (
                              <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-snug break-words max-w-full">
                                {card.item.meaning}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 text-xs text-slate-400 flex items-center gap-1.5">
                            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Ketuk untuk membalik
                          </span>
                        </div>

                        {/* Back */}
                        <div
                          className="absolute inset-0 rounded-3xl bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 shadow-lg flex flex-col items-center p-5 overflow-y-auto"
                          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                        >
                          <span className="shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950 px-3 py-1 rounded-full">
                            Jawaban
                          </span>
                          <div className="flex-1 w-full flex flex-col items-center justify-center gap-3 text-center py-3">
                            {card.front === 'japanese' && card.item.image_url && (
                              <KotobaImage
                                key={card.item.image_url}
                                src={card.item.image_url}
                                alt={card.item.japanese}
                                className="w-full max-w-[14rem] aspect-[4/3] rounded-2xl shrink-0"
                              />
                            )}
                            <p className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white leading-tight break-words max-w-full">
                              {card.item.japanese}
                            </p>
                            <p className="text-lg font-semibold text-amber-600 dark:text-amber-400 break-words max-w-full">
                              {card.item.romaji}
                            </p>
                            <div className="w-12 h-px bg-slate-200 dark:bg-slate-700" />
                            <p className="text-lg sm:text-xl font-bold text-slate-700 dark:text-slate-200 leading-snug break-words max-w-full">
                              {card.item.meaning}
                            </p>
                          </div>
                        </div>
                      </div>
                    </button>

                    {isCardFlipped ? (
                      <div className="grid grid-cols-2 gap-3 animate-fade-in">
                        <button
                          type="button"
                          onClick={() => handleSelfAssessment(false)}
                          className="h-12 rounded-xl bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 border-2 border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 text-[15px] font-bold cursor-pointer transition-colors active:scale-[0.98]"
                        >
                          Masih Sulit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelfAssessment(true)}
                          className="h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[15px] font-bold border-none cursor-pointer transition-colors shadow-md shadow-emerald-600/20 active:scale-[0.98] flex items-center justify-center gap-1.5"
                        >
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Sudah Hafal
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsCardFlipped(true)}
                        className="h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[15px] font-bold border-none cursor-pointer transition-colors shadow-md shadow-amber-500/20 active:scale-[0.98]"
                      >
                        Lihat Jawaban
                      </button>
                    )}

                    <div className="flex items-center justify-center gap-4 text-sm">
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <span className="size-2 rounded-full bg-emerald-500" /> {masteredAnswers.length} hafal
                      </span>
                      <span className="flex items-center gap-1.5 text-red-500 dark:text-red-400 font-semibold">
                        <span className="size-2 rounded-full bg-red-500" /> {difficultAnswers.length} sulit
                      </span>
                    </div>
                    <p className="hidden sm:block text-center text-xs text-slate-400">
                      Spasi: balik kartu · ←: masih sulit · →: sudah hafal
                    </p>
                  </div>
                )}

                {/* ── FINISHED ── */}
                {testPhase === 'finished' && (
                  <div className="flex flex-col gap-5">
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="relative size-32">
                        <svg className="size-full -rotate-90" viewBox="0 0 120 120">
                          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-slate-100 dark:stroke-slate-800" />
                          <circle
                            cx="60" cy="60" r="52" fill="none" strokeWidth="10" strokeLinecap="round"
                            className={scorePct >= 80 ? 'stroke-emerald-500' : scorePct >= 50 ? 'stroke-amber-500' : 'stroke-red-500'}
                            strokeDasharray={2 * Math.PI * 52}
                            strokeDashoffset={2 * Math.PI * 52 * (1 - scorePct / 100)}
                            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-3xl font-black text-slate-900 dark:text-white">{scorePct}%</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">hafal</span>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                          {scorePct >= 80 ? 'Luar biasa!' : scorePct >= 50 ? 'Bagus, terus latihan!' : 'Ayo ulangi lagi!'}
                        </h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {masteredAnswers.length} dari {testAnswers.length} kartu sudah kamu hafal. Status hafalan sudah diperbarui.
                        </p>
                      </div>
                    </div>

                    {difficultAnswers.length > 0 && (
                      <section>
                        <h5 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Perlu diulang ({difficultAnswers.length})</h5>
                        <ul className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                          {difficultAnswers.map(({ item }) => (
                            <li key={item.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                              <div className="min-w-0">
                                <p className="text-base font-bold text-slate-900 dark:text-white truncate">{item.japanese}</p>
                                <p className="text-xs text-amber-600 dark:text-amber-400 truncate">{item.romaji}</p>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-300 text-right line-clamp-2 max-w-[50%]">{item.meaning}</p>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <div className="flex flex-col gap-2">
                      {difficultAnswers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => beginTestSession(difficultAnswers.map(a => a.item))}
                          className="h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[15px] font-bold border-none cursor-pointer shadow-md shadow-amber-500/20 transition-colors"
                        >
                          Ulangi yang Sulit ({difficultAnswers.length})
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const size = getTestPool(testSource).length
                          setTestCount(c => Math.max(1, Math.min(c, size)))
                          setTestPhase('setup')
                        }}
                        className={`h-12 rounded-xl text-[15px] font-bold cursor-pointer transition-colors ${
                          difficultAnswers.length > 0
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 border-none'
                            : 'bg-amber-500 hover:bg-amber-600 text-white border-none shadow-md shadow-amber-500/20'
                        }`}
                      >
                        Latihan Lagi
                      </button>
                      <button
                        type="button"
                        onClick={closeTest}
                        className="h-11 rounded-xl bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-sm font-semibold border-none cursor-pointer"
                      >
                        Kembali ke Jurnal
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal Form Setor Kotoba */}
      {isModalOpen && (
        <div ref={modalRef} className="modal-overlay fixed inset-0 z-[999] overflow-y-auto bg-slate-900/80 backdrop-blur-md animate-fade-in overscroll-contain">
          <div className="flex min-h-full items-start justify-center p-2.5 sm:p-6 pt-4 sm:pt-10 md:pt-12 pb-16 sm:pb-12">
            <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-up max-h-[92dvh] sm:max-h-[88dvh] flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold text-xs">
                  {editingItem ? (
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  ) : (
                    <span className="font-japanese font-bold text-sm">語</span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white">
                  {editingItem ? 'Edit Kosakata' : 'Tambah Kosakata Baru'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="size-8 sm:size-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 border-none cursor-pointer flex items-center justify-center font-bold text-sm touch-manipulation"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {/* Field 1: Kanji / Katakana / Hiragana */}
                {(() => {
                  const err = fieldError('japanese')
                  const script = detectJapaneseScript(formData.japanese)
                  const ok = formData.japanese.trim() && !formValidation.errors.japanese
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                        <label htmlFor="kotoba-japanese" className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                          1. {t('sk_input_japanese', 'Huruf Jepang (Kanji / Katakana / Hiragana)')} <span className="text-red-500">*</span>
                        </label>
                        {ok && (
                          <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full border bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900 flex items-center gap-1">
                            <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            <span>{script.detectedSummary}</span>
                          </span>
                        )}
                      </div>
                      <input
                        id="kotoba-japanese"
                        type="text"
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="next"
                        lang="ja"
                        maxLength={30}
                        aria-invalid={Boolean(err)}
                        aria-describedby="kotoba-japanese-hint"
                        placeholder={t('sk_input_japanese_ph', 'Contoh: 食べる atau たべる atau ラーメン')}
                        value={formData.japanese}
                        onChange={e => setFormData({ ...formData, japanese: e.target.value })}
                        onBlur={() => markTouched('japanese')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-base sm:text-sm text-slate-800 dark:text-white outline-none transition-all font-medium min-h-[44px] ${
                          err ? 'border-red-400 focus:border-red-500' : ok ? 'border-emerald-400 focus:border-emerald-500' : 'border-slate-200 dark:border-slate-700 focus:border-amber-500'
                        }`}
                      />
                      <p id="kotoba-japanese-hint" className={`text-xs mt-1 ${err ? 'text-red-600 dark:text-red-400 font-medium' : 'text-slate-400'}`}>
                        {err || 'Hanya hiragana (あ), katakana (ア), atau kanji (日). Tanpa huruf latin.'}
                      </p>
                    </div>
                  )
                })()}

                {/* Field 2: Romaji */}
                {(() => {
                  const err = fieldError('romaji')
                  const suggestion = formValidation.suggestedRomaji
                  const showSuggestion = suggestion && (!formData.romaji.trim() || formValidation.errors.romaji)
                  return (
                    <div>
                      <label htmlFor="kotoba-romaji" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        2. {t('sk_input_romaji', 'Cara Baca (Romaji)')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="kotoba-romaji"
                        type="text"
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        enterKeyHint="next"
                        maxLength={60}
                        aria-invalid={Boolean(err)}
                        aria-describedby="kotoba-romaji-hint"
                        placeholder={t('sk_input_romaji_ph', 'Contoh: taberu atau raamen')}
                        value={formData.romaji}
                        onChange={e => setFormData({ ...formData, romaji: e.target.value })}
                        onBlur={() => markTouched('romaji')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-base sm:text-sm text-slate-800 dark:text-white outline-none transition-all font-medium min-h-[44px] ${
                          err ? 'border-red-400 focus:border-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-amber-500'
                        }`}
                      />
                      <div id="kotoba-romaji-hint" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        {err ? (
                          <p className="text-xs text-red-600 dark:text-red-400 font-medium">{err}</p>
                        ) : (
                          <p className="text-xs text-slate-400">Tulis cara baca dengan huruf latin. Bacaan dicocokkan dengan tulisan kananya.</p>
                        )}
                        {showSuggestion && (
                          <button
                            type="button"
                            onClick={() => { setFormData({ ...formData, romaji: suggestion! }); markTouched('romaji') }}
                            className="h-8 px-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs font-semibold cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/70"
                          >
                            Pakai “{suggestion}”
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {/* Field 3: Meaning */}
                {(() => {
                  const err = fieldError('meaning')
                  return (
                    <div>
                      <label htmlFor="kotoba-meaning" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        3. {t('sk_input_meaning', 'Makna / Terjemahan')} <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="kotoba-meaning"
                        type="text"
                        required
                        enterKeyHint="done"
                        maxLength={100}
                        aria-invalid={Boolean(err)}
                        aria-describedby="kotoba-meaning-hint"
                        placeholder={t('sk_input_meaning_ph', 'Contoh: Makan (Kata Kerja)')}
                        value={formData.meaning}
                        onChange={e => setFormData({ ...formData, meaning: e.target.value })}
                        onBlur={() => markTouched('meaning')}
                        className={`w-full px-3.5 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-base sm:text-sm text-slate-800 dark:text-white outline-none transition-all font-medium min-h-[44px] ${
                          err ? 'border-red-400 focus:border-red-500' : 'border-slate-200 dark:border-slate-700 focus:border-amber-500'
                        }`}
                      />
                      {err && <p id="kotoba-meaning-hint" className="text-xs mt-1 text-red-600 dark:text-red-400 font-medium">{err}</p>}
                    </div>
                  )
                })()}

                {/* Field 4: Image File Upload (Optional) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    4. {t('sk_input_image', 'Upload Gambar (Opsional)')}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-amber-500 transition-all file:mr-2.5 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-extrabold file:bg-amber-500 file:text-white hover:file:bg-amber-600 cursor-pointer min-h-[44px] flex items-center"
                  />

                  {formData.image_url && (
                    <div className="mt-2 relative w-full rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                      <KotobaImage key={formData.image_url} src={formData.image_url} alt="Preview" className="w-full aspect-[4/3]" />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null)
                          uploadPromiseRef.current = null
                          setFormData(prev => ({ ...prev, image_url: '' }))
                        }}
                        className="absolute top-1.5 right-1.5 px-2.5 py-1 bg-red-600/90 hover:bg-red-700 text-white text-xs font-bold rounded-lg border-none cursor-pointer backdrop-blur-xs transition-all shadow-xs touch-manipulation flex items-center gap-1"
                      >
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Actions Footer */}
              <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-3 sm:py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs sm:text-sm cursor-pointer touch-manipulation hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-3.5 sm:py-3 rounded-xl text-xs sm:text-sm font-extrabold bg-amber-500 hover:bg-amber-600 text-white border-none cursor-pointer transition-all shadow-md min-h-[44px] touch-manipulation active:scale-[0.99] flex items-center justify-center gap-2 group disabled:opacity-50"
                >
                  <span>{saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Simpan Kosakata'}</span>
                  {!saving && (
                    <span className="size-4.5 rounded-full bg-white/20 flex items-center justify-center text-[0.6rem] font-black group-hover:translate-x-0.5 transition-transform">
                      &gt;
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
          </div>
        </div>
      )}
      {/* Beautiful Custom Alert Modal */}
      <CustomAlertModal {...alertConfig} />
    </main>
  )
}
