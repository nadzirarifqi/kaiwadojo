import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import CustomAlertModal, { type AlertModalConfig } from '../components/CustomAlertModal'
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

type QuestionMode = 'prompt_image_meaning' | 'prompt_japanese_romaji' | 'prompt_japanese_meaning'

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

/* ── Image Compressor Helper for Fast DB Saves ── */
async function compressImageDataUrl(dataUrl: string, maxWidth = 800, quality = 0.75): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      } else {
        resolve(dataUrl)
      }
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export default function SetoranKotobaPage() {
  const { user, profile } = useAuth()
  const { t } = useLanguage()
  const effectiveUserId = profile?.id || user?.id || 'active_user'
  const [kotobaList, setKotobaList] = useState<UserKotoba[]>([])
  const [loading, setLoading]       = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState<'all' | 'unmastered' | 'mastered'>('all')
  const [showGuide, setShowGuide]   = useState(true)

  // Modal Create/Edit State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<UserKotoba | null>(null)
  const [formData, setFormData]       = useState({
    japanese: '',
    romaji: '',
    meaning: '',
    image_url: '',
  })
  const [saving, setSaving]           = useState(false)

  // Flashcard Test Mode State
  const [isTestActive, setIsTestActive]       = useState(false)
  const [testItems, setTestItems]             = useState<UserKotoba[]>([])
  const [currentTestIndex, setCurrentTestIndex] = useState(0)
  const [questionMode, setQuestionMode]       = useState<QuestionMode>('prompt_japanese_meaning')
  const [userAnswerInput, setUserAnswerInput] = useState('')
  const [showAnswerKey, setShowAnswerKey]     = useState(false)
  const [testResults, setTestResults]         = useState<{ mastered: number; difficult: number }>({ mastered: 0, difficult: 0 })
  const [isTestFinished, setIsTestFinished]   = useState(false)

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
    loadKotobaList()

    const handleSync = () => {
      loadKotobaList()
    }
    window.addEventListener('storage', handleSync)

    // Realtime Postgres listener for user_kotoba_submissions across all devices
    const channel = supabase
      .channel('kotoba_realtime_' + (effectiveUserId || 'all'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_kotoba_submissions' }, () => {
        loadKotobaList()
      })
      .subscribe()

    return () => {
      window.removeEventListener('storage', handleSync)
      supabase.removeChannel(channel)
    }
  }, [user, profile?.id, effectiveUserId])

  async function loadKotobaList() {
    const storageKey = `kaiwa_user_kotoba_${effectiveUserId}`
    const globalKey = `kaiwa_user_kotoba_active_global`

    // 1. Instant local cache render
    const localData = localStorage.getItem(storageKey) || localStorage.getItem(globalKey)
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

    // 2. Auto-migrate any local-only items (id starting with 'kotoba-') to Supabase
    if (effectiveUserId && effectiveUserId !== 'guest' && effectiveUserId !== 'active_user') {
      const unsyncedLocals = localItems.filter(item => item.id.startsWith('kotoba-'))
      if (unsyncedLocals.length > 0) {
        for (const un of unsyncedLocals) {
          try {
            await supabase.from('user_kotoba_submissions').insert({
              user_id: effectiveUserId,
              japanese: un.japanese,
              romaji: un.romaji,
              meaning: un.meaning,
              image_url: un.image_url || null,
              is_mastered: un.is_mastered || false,
            })
          } catch (e) {
            console.warn('Auto-sync kotoba note:', e)
          }
        }
      }
    }

    // 3. Fetch authoritative DB records from Supabase
    let dbItems: UserKotoba[] = []
    if (user?.id || profile?.id || effectiveUserId) {
      const { data, error } = await supabase
        .from('user_kotoba_submissions')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })

      if (!error && data) {
        dbItems = data as UserKotoba[]
      }
    }

    if (dbItems.length > 0 || (effectiveUserId && effectiveUserId !== 'guest' && effectiveUserId !== 'active_user')) {
      setKotobaList(dbItems)
      localStorage.setItem(storageKey, JSON.stringify(dbItems))
      localStorage.setItem(globalKey, JSON.stringify(dbItems))
    } else if (localItems.length > 0) {
      setKotobaList(localItems)
    }
    setLoading(false)
  }

  function saveToLocal(updatedList: UserKotoba[]) {
    setKotobaList(updatedList)
    const storageKey = `kaiwa_user_kotoba_${effectiveUserId}`
    const globalKey = `kaiwa_user_kotoba_active_global`
    localStorage.setItem(storageKey, JSON.stringify(updatedList))
    localStorage.setItem(globalKey, JSON.stringify(updatedList))
    window.dispatchEvent(new Event('kaiwa_mission_progress_updated'))
    window.dispatchEvent(new Event('storage'))
  }

  function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onloadend = async () => {
      const rawUrl = reader.result as string
      const compressed = await compressImageDataUrl(rawUrl, 900, 0.8)
      setFormData(prev => ({ ...prev, image_url: compressed }))
    }
    reader.readAsDataURL(file)
  }

  function handleOpenCreateModal() {
    setEditingItem(null)
    setFormData({
      japanese: '',
      romaji: '',
      meaning: '',
      image_url: '',
    })
    setIsModalOpen(true)
  }

  function handleOpenEditModal(item: UserKotoba) {
    setEditingItem(item)
    setFormData({
      japanese: item.japanese,
      romaji: item.romaji,
      meaning: item.meaning,
      image_url: item.image_url || '',
    })
    setIsModalOpen(true)
  }

  async function handleSubmitForm(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.japanese.trim() || !formData.romaji.trim() || !formData.meaning.trim()) {
      setAlertConfig({
        isOpen: true,
        title: 'Formulir Belum Lengkap ⚠️',
        message: 'Mohon lengkapi Huruf Jepang, Romaji, dan Makna/Arti dari kosakata yang disetorkan.',
        type: 'warning',
        buttonText: 'Lengkapi Data',
        onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
      })
      return
    }

    setSaving(true)

    const processedImageUrl = formData.image_url.trim()
      ? await compressImageDataUrl(formData.image_url.trim())
      : undefined

    const targetUid = profile?.id || user?.id || effectiveUserId

    if (editingItem) {
      const updated = kotobaList.map(item =>
        item.id === editingItem.id
          ? {
              ...item,
              japanese: formData.japanese.trim(),
              romaji: formData.romaji.trim(),
              meaning: formData.meaning.trim(),
              image_url: processedImageUrl,
            }
          : item
      )
      saveToLocal(updated)
      setIsModalOpen(false)
      setSaving(false)

      try {
        await supabase
          .from('user_kotoba_submissions')
          .update({
            japanese: formData.japanese.trim(),
            romaji: formData.romaji.trim(),
            meaning: formData.meaning.trim(),
            image_url: processedImageUrl || null,
          })
          .eq('id', editingItem.id)
      } catch (err) {
        console.warn('Update kotoba DB error:', err)
      }
    } else {
      let finalId = `kotoba-${Date.now()}`

      // Attempt DB Insert
      if (targetUid && targetUid !== 'guest' && targetUid !== 'active_user') {
        try {
          const { data, error } = await supabase
            .from('user_kotoba_submissions')
            .insert({
              user_id: targetUid,
              japanese: formData.japanese.trim(),
              romaji: formData.romaji.trim(),
              meaning: formData.meaning.trim(),
              image_url: processedImageUrl || null,
              is_mastered: false,
            })
            .select()
            .single()

          if (!error && data?.id) {
            finalId = data.id
          } else if (error) {
            console.warn('Insert kotoba DB note:', error)
          }
        } catch (err) {
          console.warn('Insert kotoba DB catch:', err)
        }
      }

      const newItem: UserKotoba = {
        id: finalId,
        user_id: targetUid,
        japanese: formData.japanese.trim(),
        romaji: formData.romaji.trim(),
        meaning: formData.meaning.trim(),
        image_url: processedImageUrl,
        is_mastered: false,
        created_at: new Date().toISOString(),
      }

      const updated = [newItem, ...kotobaList]
      saveToLocal(updated)
      setIsModalOpen(false)
      setSaving(false)

      // Update lesson progress & daily missions
      if (targetUid && targetUid !== 'guest' && targetUid !== 'active_user') {
        try {
          await supabase.from('lesson_progress').upsert({
            student_id: targetUid,
            lesson_id: `user_kotoba_${finalId}`,
            is_completed: true,
            last_watched_at: new Date().toISOString(),
          }, { onConflict: 'student_id,lesson_id' })

          const todayStr = new Date().toISOString().split('T')[0]
          const mission = (await fetchDailyMission(targetUid, todayStr)) || getDailyMission(targetUid, todayStr)
          if (mission) {
            await calculateMissionProgress(targetUid, mission)
          }
        } catch (e) {
          console.warn('Mission sync note:', e)
        }
      }
    }
  }

  async function handleToggleMastered(item: UserKotoba) {
    const updatedStatus = !item.is_mastered
    const updated = kotobaList.map(k => k.id === item.id ? { ...k, is_mastered: updatedStatus } : k)
    saveToLocal(updated)

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
    if (!confirm('Apakah kamu yakin ingin menghapus kosakata ini dari catatanmu?')) return
    const updated = kotobaList.filter(k => k.id !== id)
    saveToLocal(updated)

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
        title: 'Jurnal Masih Kosong 💡',
        message: 'Kamu belum memiliki catatan di "Jurnal Kosakata". Tambah beberapa kosakata terlebih dahulu untuk memulai fitur "Uji Hafalan Kosakata"!',
        type: 'info',
        buttonText: 'Tambah Kosakata',
        onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
      })
      return
    }

    // Shuffle kotoba list for the test session
    const shuffled = [...kotobaList].sort(() => Math.random() - 0.5)
    setTestItems(shuffled)
    setCurrentTestIndex(0)
    setTestResults({ mastered: 0, difficult: 0 })
    setIsTestFinished(false)
    setIsTestActive(true)

    setupQuestionMode(shuffled[0])
  }

  function setupQuestionMode(item: UserKotoba) {
    setUserAnswerInput('')
    setShowAnswerKey(false)

    // Randomize question mode based on item features
    const modes: QuestionMode[] = ['prompt_japanese_meaning', 'prompt_japanese_romaji']
    if (item.image_url) {
      modes.push('prompt_image_meaning')
    }
    const chosenMode = modes[Math.floor(Math.random() * modes.length)]
    setQuestionMode(chosenMode)
  }

  async function handleSelfAssessment(isMasteredChoice: boolean) {
    const currentItem = testItems[currentTestIndex]
    if (!currentItem) return

    // Update is_mastered status in DB & Local
    const updated = kotobaList.map(k => k.id === currentItem.id ? { ...k, is_mastered: isMasteredChoice } : k)
    saveToLocal(updated)

    if (user) {
      await supabase
        .from('user_kotoba_submissions')
        .update({ is_mastered: isMasteredChoice })
        .eq('id', currentItem.id)
    }

    // Update test session score
    if (isMasteredChoice) {
      setTestResults(prev => ({ ...prev, mastered: prev.mastered + 1 }))
    } else {
      setTestResults(prev => ({ ...prev, difficult: prev.difficult + 1 }))
    }

    // Move to next question or finish test
    if (currentTestIndex + 1 < testItems.length) {
      const nextIndex = currentTestIndex + 1
      setCurrentTestIndex(nextIndex)
      setupQuestionMode(testItems[nextIndex])
    } else {
      setIsTestFinished(true)
    }
  }

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
      <header className="relative overflow-hidden bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 rounded-2xl sm:rounded-3xl p-4 sm:p-8 mb-4 sm:mb-6 text-white shadow-xl animate-fade-in">
        <div className="absolute -top-12 -right-12 size-56 bg-white/10 rounded-full pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-1 sm:mb-2">
              <span className="text-[0.65rem] sm:text-xs font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full backdrop-blur-xs">
                🔤 Catatan Kosakata Mandiri
              </span>
            </div>
            <h1 className="text-xl sm:text-3xl font-black tracking-tight mb-1 sm:mb-2">
              {t('sk_title', 'Jurnal Kosakata (Kotoba) Saya')}
            </h1>
            <p className="text-white/90 text-xs sm:text-sm leading-relaxed">
              {t('sk_subtitle', 'Catat dan simpan setiap kosakata Bahasa Jepang baru yang kamu temukan. Uji hafalanmu secara berkala untuk menentukan kata yang sudah kamu kuasai!')}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0">
            <button
              onClick={handleStartTest}
              className="px-4 py-2.5 sm:px-5 sm:py-3.5 bg-amber-900/40 hover:bg-amber-900/60 border border-white/30 text-white text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl cursor-pointer transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>{t('sk_test_btn', '🧠 Uji Hafalan Kosakata')}</span>
            </button>

            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 sm:px-6 sm:py-3.5 bg-white text-amber-600 hover:bg-amber-50 text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl border-none cursor-pointer transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <span className="text-base">＋</span>
              <span>{t('sk_add_btn', 'Tambah Kosakata Baru')}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Guide Banner: Panduan Cara Mengisi */}
      {showGuide && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 mb-4 sm:mb-6 text-slate-800 dark:text-slate-100 flex flex-col md:flex-row gap-3 sm:gap-5 justify-between items-start">
          <div className="space-y-1.5 sm:space-y-2 flex-1">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-extrabold text-xs sm:text-sm">
              <span>{t('sk_guide_title', '💡 Panduan Menambah & Menguji Kosakata')}</span>
            </div>
            <p className="text-[0.72rem] sm:text-xs text-slate-600 dark:text-slate-300">
              1. Catat kata baru dengan tombol <strong>"Tambah Kosakata Baru"</strong>.<br />
              2. Tekan <strong>"🧠 Uji Hafalan Kosakata"</strong> untuk melakukan tes evaluasi mandiri.
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
            className="text-[0.68rem] sm:text-xs text-amber-600 hover:text-amber-800 dark:text-amber-400 font-bold border-none bg-transparent cursor-pointer shrink-0"
          >
            {t('sk_guide_hide', 'Sembunyikan ✕')}
          </button>
        </div>
      )}

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center sm:gap-4 text-center sm:text-left">
          <div className="size-8 sm:size-12 rounded-lg sm:rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm sm:text-xl font-bold shrink-0 mb-1 sm:mb-0">
            🔤
          </div>
          <div>
            <div className="text-base sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">{totalCount}</div>
            <div className="text-[0.62rem] sm:text-xs text-slate-400 font-medium">{t('sk_stat_total', 'Total Kosakata')}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center sm:gap-4 text-center sm:text-left">
          <div className="size-8 sm:size-12 rounded-lg sm:rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm sm:text-xl font-bold shrink-0 mb-1 sm:mb-0">
            ✅
          </div>
          <div>
            <div className="text-base sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">{masteredCount}</div>
            <div className="text-[0.62rem] sm:text-xs text-slate-400 font-medium">{t('sk_stat_mastered', 'Dikuasai')}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl sm:rounded-2xl p-2.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center sm:gap-4 text-center sm:text-left">
          <div className="size-8 sm:size-12 rounded-lg sm:rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-sm sm:text-xl font-bold shrink-0 mb-1 sm:mb-0">
            🔥
          </div>
          <div>
            <div className="text-base sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">
              {totalCount > 0 ? `${Math.round((masteredCount / totalCount) * 100)}%` : '0%'}
            </div>
            <div className="text-[0.62rem] sm:text-xs text-slate-400 font-medium">{t('sk_stat_memorization', 'Tingkat Hafal')}</div>
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-3 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm mb-4 sm:mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
        {/* Filter Pills */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-none shrink-0 ${
              filterMode === 'all'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-amber-500'
            }`}
          >
            {t('sk_filter_all', 'Semua')} ({totalCount})
          </button>
          <button
            onClick={() => setFilterMode('unmastered')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-none shrink-0 ${
              filterMode === 'unmastered'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-amber-500'
            }`}
          >
            {t('sk_filter_unmastered', '📖 Masih Dipelajari')} ({totalCount - masteredCount})
          </button>
          <button
            onClick={() => setFilterMode('mastered')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-none shrink-0 ${
              filterMode === 'mastered'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-emerald-500'
            }`}
          >
            {t('sk_filter_mastered', '✅ Sudah Dikuasai')} ({masteredCount})
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-72">
          <input
            type="text"
            placeholder={t('sk_search_placeholder', 'Cari kanji, romaji, atau arti...')}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-amber-500 transition-all font-medium"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
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
            <span className="text-4xl">🔤</span>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">Belum Ada Catatan Kosakata</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {searchTerm
                ? 'Tidak ada kosakata yang cocok dengan pencarianmu.'
                : 'Kamu belum menambah kosakata baru. Klik tombol di bawah untuk mencatat kata Jepang pertamamu!'}
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="mt-2 px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-2xl border-none cursor-pointer transition-all shadow-md active:scale-95"
            >
              ＋ Tambah Kosakata Pertama →
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map(item => (
            <div
              key={item.id}
              className={`p-4 rounded-3xl bg-white dark:bg-slate-900 border transition-all shadow-sm flex flex-col justify-between gap-4 group ${
                item.is_mastered
                  ? 'border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/30 dark:bg-emerald-950/10'
                  : 'border-slate-200 dark:border-slate-800 hover:border-amber-500/60'
              }`}
            >
              {/* Image Preview */}
              {item.image_url && (
                <div className="relative h-36 w-full rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0">
                  <img
                    src={item.image_url}
                    alt={item.romaji}
                    className="size-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={e => {
                      ;(e.target as HTMLElement).style.display = 'none'
                    }}
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleMastered(item)}
                      className={`px-2.5 py-1 rounded-xl text-[0.65rem] font-black backdrop-blur-md cursor-pointer border-none transition-all ${
                        item.is_mastered
                          ? 'bg-emerald-500/90 text-white shadow-xs'
                          : 'bg-slate-900/60 text-white hover:bg-emerald-500'
                      }`}
                    >
                      {item.is_mastered ? t('sk_badge_mastered', '✅ Dikuasai') : t('sk_badge_mark_mastered', '⭕ Tandai Dikuasai')}
                    </button>
                  </div>
                </div>
              )}

              {/* Japanese & Romaji Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">
                      {item.japanese}
                    </h3>
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                      {item.romaji}
                    </div>
                  </div>

                  {!item.image_url && (
                    <button
                      onClick={() => handleToggleMastered(item)}
                      className={`px-2.5 py-1 rounded-xl text-[0.65rem] font-black cursor-pointer border-none transition-all shrink-0 ${
                        item.is_mastered
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-emerald-100 hover:text-emerald-700'
                      }`}
                    >
                      {item.is_mastered ? t('sk_badge_mastered', '✅ Dikuasai') : t('sk_badge_mark_mastered', '⭕ Tandai Dikuasai')}
                    </button>
                  )}
                </div>

                {/* Indonesian Meaning */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="text-xs text-slate-400 font-semibold mb-0.5">{t('sk_meaning_label', 'Makna / Arti:')}</div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">
                    🇮🇩 {item.meaning}
                  </div>
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => handleOpenEditModal(item)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer transition-all"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 border-none cursor-pointer transition-all"
                >
                  🗑️ Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Flashcard Test Modal Screen */}
      {isTestActive && (
        <div className="fixed inset-0 z-[999] flex flex-col p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-up max-h-[90dvh] overflow-y-auto my-auto mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  🧠 Tes Evaluasi Hafalan
                </span>
                <h3 className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
                  {isTestFinished
                    ? 'Hasil Tes Evaluasi Hafalan'
                    : `Soal ${currentTestIndex + 1} dari ${testItems.length}`}
                </h3>
              </div>
              <button
                onClick={() => setIsTestActive(false)}
                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 border-none cursor-pointer flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            {/* Test Content */}
            {isTestFinished ? (
              <div className="space-y-6 text-center">
                <div className="size-20 bg-amber-100 dark:bg-amber-950/60 rounded-full flex items-center justify-center text-4xl mx-auto">
                  🏆
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-800 dark:text-white">Latihan Selesai!</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                    Status hafalan kosakata milikmu telah diperbarui di catatan akunmu.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-900 text-center">
                    <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
                      {testResults.mastered}
                    </div>
                    <div className="text-[0.68rem] text-emerald-800 dark:text-emerald-300 font-bold">Sudah Dikuasai</div>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900 text-center">
                    <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
                      {testResults.difficult}
                    </div>
                    <div className="text-[0.68rem] text-amber-800 dark:text-amber-300 font-bold">Masih Sulit</div>
                  </div>
                </div>

                <button
                  onClick={() => setIsTestActive(false)}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs sm:text-sm rounded-2xl border-none cursor-pointer shadow-md transition-all"
                >
                  Tutup Tes & Kembali ke Jurnal →
                </button>
              </div>
            ) : activeTestItem ? (
              <div className="space-y-5">
                {/* Progress bar */}
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                    style={{ width: `${((currentTestIndex + 1) / testItems.length) * 100}%` }}
                  />
                </div>

                {/* Prompt Card */}
                <div className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-center space-y-3">
                  {questionMode === 'prompt_image_meaning' && activeTestItem.image_url ? (
                    <div className="space-y-2">
                      <span className="text-[0.68rem] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2.5 py-1 rounded-full">
                        Tebak Huruf Jepang dari Gambar / Makna Berikut:
                      </span>
                      <div className="h-40 w-full rounded-xl overflow-hidden bg-slate-200 mx-auto max-w-xs">
                        <img src={activeTestItem.image_url} alt="Prompt" className="size-full object-cover" />
                      </div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                        Makna: 🇮🇩 {activeTestItem.meaning}
                      </div>
                    </div>
                  ) : questionMode === 'prompt_japanese_romaji' ? (
                    <div className="space-y-2">
                      <span className="text-[0.68rem] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2.5 py-1 rounded-full">
                        Tebak Cara Baca (Romaji) kata ini:
                      </span>
                      <div className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-white pt-2">
                        {activeTestItem.japanese}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <span className="text-[0.68rem] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950 px-2.5 py-1 rounded-full">
                        Tebak Makna / Arti kata ini:
                      </span>
                      <div className="text-3xl sm:text-4xl font-black text-slate-800 dark:text-white pt-2">
                        {activeTestItem.japanese}
                      </div>
                    </div>
                  )}

                  {/* Input area */}
                  <div className="pt-2">
                    <input
                      type="text"
                      placeholder="Ketik tebakan jawabanmu di sini..."
                      value={userAnswerInput}
                      onChange={e => setUserAnswerInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs sm:text-sm font-bold text-slate-800 dark:text-white outline-none focus:border-amber-500 transition-all text-center"
                    />
                  </div>

                  {!showAnswerKey && (
                    <button
                      onClick={() => setShowAnswerKey(true)}
                      className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border-none cursor-pointer transition-all"
                    >
                      🔍 Periksa Kunci Jawaban
                    </button>
                  )}
                </div>

                {/* Answer Key Display & Self Assessment */}
                {showAnswerKey && (
                  <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-3 animate-fade-in">
                    <div className="text-xs font-extrabold text-amber-800 dark:text-amber-300 flex items-center justify-between">
                      <span>🔑 Kunci Jawaban Lengkap:</span>
                      {userAnswerInput && (
                        <span className="text-[0.68rem] font-normal text-slate-500">
                          Jawabanmu: "{userAnswerInput}"
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs bg-white dark:bg-slate-900 p-3 rounded-xl border border-amber-100 dark:border-amber-950">
                      <div>
                        <div className="text-[0.65rem] text-slate-400 font-semibold">Huruf Jepang</div>
                        <div className="font-extrabold text-slate-800 dark:text-white">{activeTestItem.japanese}</div>
                      </div>
                      <div>
                        <div className="text-[0.65rem] text-slate-400 font-semibold">Romaji</div>
                        <div className="font-extrabold text-amber-600 dark:text-amber-400">{activeTestItem.romaji}</div>
                      </div>
                      <div>
                        <div className="text-[0.65rem] text-slate-400 font-semibold">Makna / Arti</div>
                        <div className="font-extrabold text-slate-800 dark:text-slate-100">{activeTestItem.meaning}</div>
                      </div>
                    </div>

                    <div className="text-xs text-center font-bold text-slate-700 dark:text-slate-200 pt-1">
                      Bagaimana tingkat kesulitan soal ini untukmu?
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button
                        onClick={() => handleSelfAssessment(false)}
                        className="py-3 px-3 bg-red-500 hover:bg-red-600 text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1"
                      >
                        <span>{t('sk_test_difficult_btn', '🔴 Masih Sulit')}</span>
                      </button>
                      <button
                        onClick={() => handleSelfAssessment(true)}
                        className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1"
                      >
                        <span>{t('sk_test_mastered_btn', '🟢 Sudah Mudah / Dikuasai')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal Form Setor Kotoba */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[999] flex flex-col p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-7 max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-up max-h-[90dvh] overflow-y-auto my-auto mx-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white">
                {editingItem ? '✏️ Edit Kosakata' : '🔤 Tambah Kosakata Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="size-7 sm:size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 border-none cursor-pointer flex items-center justify-center font-bold text-xs sm:text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-3 sm:space-y-4">
              {/* Field 1: Kanji / Katakana / Hiragana */}
              <div>
                <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    1. {t('sk_input_japanese', 'Huruf Jepang (Kanji / Katakana / Hiragana)')} <span className="text-red-500">*</span>
                  </label>
                  {formData.japanese.trim() && (
                    <span className={`text-[0.62rem] sm:text-[0.65rem] font-bold px-2 py-0.5 rounded-full border transition-all ${
                      detectJapaneseScript(formData.japanese).isValid
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200'
                    }`}>
                      {detectJapaneseScript(formData.japanese).isValid
                        ? `✅ Terdeteksi: ${detectJapaneseScript(formData.japanese).detectedSummary}`
                        : '⚠️ Wajib mengandung Hiragana/Katakana/Kanji'}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  required
                  placeholder={t('sk_input_japanese_ph', 'Contoh: 食べる atau たべる atau ラーメン')}
                  value={formData.japanese}
                  onChange={e => setFormData({ ...formData, japanese: e.target.value })}
                  className={`w-full px-3 py-2 sm:py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-white outline-none transition-all font-medium ${
                    formData.japanese.trim()
                      ? detectJapaneseScript(formData.japanese).isValid
                        ? 'border-emerald-400 focus:border-emerald-500'
                        : 'border-amber-400 focus:border-amber-500'
                      : 'border-slate-200 dark:border-slate-700 focus:border-amber-500'
                  }`}
                />
                <p className="text-[0.62rem] sm:text-[0.68rem] text-slate-400 font-medium mt-0.5 sm:mt-1">
                  Sistem otomatis memverifikasi karakter Hiragana (あ), Katakana (ア), atau Kanji (日).
                </p>
              </div>

              {/* Field 2: Romaji */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  2. {t('sk_input_romaji', 'Cara Baca (Romaji)')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('sk_input_romaji_ph', 'Contoh: taberu atau raamen')}
                  value={formData.romaji}
                  onChange={e => setFormData({ ...formData, romaji: e.target.value })}
                  className="w-full px-3 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-white outline-none focus:border-amber-500 transition-all font-medium"
                />
              </div>

              {/* Field 3: Meaning */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  3. {t('sk_input_meaning', 'Makna / Terjemahan')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('sk_input_meaning_ph', 'Contoh: Makan (Kata Kerja)')}
                  value={formData.meaning}
                  onChange={e => setFormData({ ...formData, meaning: e.target.value })}
                  className="w-full px-3 py-2 sm:py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs sm:text-sm text-slate-800 dark:text-white outline-none focus:border-amber-500 transition-all font-medium"
                />
              </div>

              {/* Field 4: Image File Upload (Optional) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  4. {t('sk_input_image', 'Upload Gambar (Opsional)')}
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="w-full px-3 py-1.5 sm:py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-amber-500 transition-all file:mr-2.5 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[0.68rem] file:font-extrabold file:bg-amber-500 file:text-white hover:file:bg-amber-600 cursor-pointer"
                />

                {formData.image_url && (
                  <div className="mt-2 relative w-full h-24 sm:h-36 rounded-xl sm:rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800">
                    <img src={formData.image_url} alt="Preview" className="size-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, image_url: '' }))}
                      className="absolute top-1.5 right-1.5 px-2 py-0.5 bg-red-600/90 hover:bg-red-700 text-white text-[0.62rem] font-extrabold rounded-lg border-none cursor-pointer backdrop-blur-xs transition-all shadow-xs"
                    >
                      ✕ Hapus Gambar
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 border-none cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white border-none cursor-pointer transition-all shadow-md"
                >
                  {saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : '＋ Simpan Kosakata'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Beautiful Custom Alert Modal */}
      <CustomAlertModal {...alertConfig} />
    </main>
  )
}
