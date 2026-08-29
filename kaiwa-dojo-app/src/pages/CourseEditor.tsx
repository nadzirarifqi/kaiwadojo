import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import AdaptiveIcon from '../components/AdaptiveIcon'
import {
  getChapterSettingsMap,
  saveChapterSetting,
  saveBatchChapterSettings,
  getCourseHeaderSettings,
  saveCourseHeaderSettings,
  detectVideoDuration,
  CHAPTER_UPDATE_EVENT,
  subscribeToChapterRealtime,
  type ChapterSetting,
  type CourseHeaderSettings,
} from '../lib/chapterService'
import { CourseCardSkeleton } from '../components/Skeleton'

export default function CourseEditor() {
  const { profile } = useAuth()
  const isInstructor = profile?.role === 'pemateri' || profile?.role === 'admin'

  const [selectedJilid, setSelectedJilid] = useState<1 | 2>(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'visible' | 'hidden'>('all')

  const [chapterMap, setChapterMap] = useState<Record<number, ChapterSetting>>({})
  const [_headerSettings, setHeaderSettings] = useState<CourseHeaderSettings>({
    page_title: '📚 Buku Kursus Minna no Nihongo',
    page_subtitle: 'Pilih jilid buku dan pelajari 5 video materi + 1 kuis di setiap babnya',
  })

  const [loading, setLoading] = useState(true)
  const [savingBab, setSavingBab] = useState<number | null>(null)
  const [detectingBab, setDetectingBab] = useState<number | null>(null)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Edit Header Modal / Card
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [editPageTitle, setEditPageTitle] = useState('')
  const [editPageSubtitle, setEditPageSubtitle] = useState('')

  async function handleAutoDetectDurations(babNum: number) {
    setDetectingBab(babNum)
    const chap = chapterMap[babNum] || { bab_number: babNum, title: `Bab ${babNum}`, is_hidden: false }

    let detectedCount = 0
    let d1 = chap.duration_s1
    let d2 = chap.duration_s2
    let d3 = chap.duration_s3

    // S1
    try {
      const res1 = await detectVideoDuration(chap.custom_video_s1 || '', babNum, 1)
      d1 = res1
      detectedCount++
    } catch {}

    // S2
    try {
      const res2 = await detectVideoDuration(chap.custom_video_s2 || '', babNum, 2)
      d2 = res2
      detectedCount++
    } catch {}

    // S3
    try {
      const res3 = await detectVideoDuration(chap.custom_video_s3 || '', babNum, 3)
      d3 = res3
      detectedCount++
    } catch {}

    const updated: ChapterSetting = {
      ...chap,
      duration_s1: d1,
      duration_s2: d2,
      duration_s3: d3,
    }

    setChapterMap(prev => ({
      ...prev,
      [babNum]: updated,
    }))

    // Save directly to Supabase so students get the live duration immediately
    await saveChapterSetting(updated)

    setDetectingBab(null)
    if (detectedCount > 0) {
      showToast(`Berhasil mendeteksi ${detectedCount} durasi video & tersimpan ke database! ⏱️`)
    } else {
      showToast(`Video belum siap di server Rumahweb atau periksa nama/lokasi file video.`, 'error')
    }
  }

  async function handleSaveBab(babNum: number) {
    setSavingBab(babNum)
    try {
      const chap = chapterMap[babNum] || {
        bab_number: babNum,
        title: `Bab ${babNum}`,
        subtitle: '',
        is_hidden: false,
      }
      await saveChapterSetting(chap)
      showToast(`Pengaturan & durasi Bab ${babNum} berhasil disimpan ke database! 💾`)
    } catch (err: any) {
      showToast(`Gagal menyimpan Bab ${babNum}: ${err?.message || 'Error'}`, 'error')
    } finally {
      setSavingBab(null)
    }
  }

  useEffect(() => {
    loadData()

    const handleSync = () => loadData()
    window.addEventListener(CHAPTER_UPDATE_EVENT, handleSync)
    window.addEventListener('storage', handleSync)
    const unsubscribeRealtime = subscribeToChapterRealtime(handleSync)

    return () => {
      window.removeEventListener(CHAPTER_UPDATE_EVENT, handleSync)
      window.removeEventListener('storage', handleSync)
      unsubscribeRealtime()
    }
  }, [])

  async function loadData() {
    setLoading(true)
    const [map, header] = await Promise.all([
      getChapterSettingsMap(),
      getCourseHeaderSettings(),
    ])
    setChapterMap(map)
    setHeaderSettings(header)
    setEditPageTitle(header.page_title)
    setEditPageSubtitle(header.page_subtitle)
    setLoading(false)
  }

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 3500)
  }

  async function handleToggleHide(babNum: number) {
    const current = chapterMap[babNum] || {
      bab_number: babNum,
      title: `Bab ${babNum}`,
      subtitle: '',
      is_hidden: false,
    }

    const nextHidden = !current.is_hidden

    const updated: ChapterSetting = {
      ...current,
      is_hidden: nextHidden,
      has_video: !nextHidden,
    }

    setChapterMap(prev => ({ ...prev, [babNum]: updated }))
    await saveChapterSetting(updated)
    showToast(
      updated.is_hidden
        ? `Bab ${babNum} kini DISEMBUNYIKAN dari siswa 🔴`
        : `Bab ${babNum} kini DITAMPILKAN ke siswa 🟢`
    )
  }

  async function handleBulkToggleVisibility(hide: boolean) {
    const startBab = selectedJilid === 1 ? 1 : 26
    const endBab   = selectedJilid === 1 ? 25 : 50

    const updatedList: ChapterSetting[] = []
    const updatedMap = { ...chapterMap }

    for (let bab = startBab; bab <= endBab; bab++) {
      const current = updatedMap[bab] || {
        bab_number: bab,
        title: `Bab ${bab}`,
        subtitle: '',
        is_hidden: false,
      }

      const updated: ChapterSetting = {
        ...current,
        is_hidden: hide,
      }

      updatedMap[bab] = updated
      updatedList.push(updated)
    }

    setChapterMap(updatedMap)
    await saveBatchChapterSettings(updatedList)

    showToast(
      hide
        ? `Semua Bab di Jilid ${selectedJilid} kini DISEMBUNYIKAN dari siswa 🔴`
        : `Semua Bab di Jilid ${selectedJilid} kini DITAMPILKAN ke siswa 🟢`
    )
  }

  const [isDetectingAll, setIsDetectingAll] = useState(false)

  async function handleBatchAutoDetectAll() {
    setIsDetectingAll(true)
    showToast(`Mulai mendeteksi durasi semua bab Jilid ${selectedJilid} dari server Rumahweb... ⏱️`)

    const startBab = selectedJilid === 1 ? 1 : 26
    const babs = Array.from({ length: 25 }, (_, i) => startBab + i)
    let updatedMap = { ...chapterMap }
    let successCount = 0

    for (const b of babs) {
      const chap = updatedMap[b] || { bab_number: b, title: `Bab ${b}`, is_hidden: false }
      let d1 = chap.duration_s1
      let d2 = chap.duration_s2
      let d3 = chap.duration_s3

      try {
        const r1 = await detectVideoDuration(chap.custom_video_s1 || '', b, 1)
        d1 = r1
        successCount++
      } catch {}

      try {
        const r2 = await detectVideoDuration(chap.custom_video_s2 || '', b, 2)
        d2 = r2
        successCount++
      } catch {}

      try {
        const r3 = await detectVideoDuration(chap.custom_video_s3 || '', b, 3)
        d3 = r3
        successCount++
      } catch {}

      updatedMap[b] = {
        ...chap,
        duration_s1: d1,
        duration_s2: d2,
        duration_s3: d3,
      }
    }

    setChapterMap(updatedMap)
    setIsDetectingAll(false)

    const listToSave = babs.map(b => updatedMap[b]).filter(Boolean)
    await saveBatchChapterSettings(listToSave)
    showToast(`Selesai! Terdeteksi ${successCount} durasi video & tersimpan ke database! 🚀`)
  }

  async function handleSaveHeader() {
    const newHeader: CourseHeaderSettings = {
      page_title: editPageTitle,
      page_subtitle: editPageSubtitle,
    }
    setHeaderSettings(newHeader)
    await saveCourseHeaderSettings(newHeader)
    setIsEditingHeader(false)
    showToast('Header halaman Kursus Saya berhasil diperbarui! ??')
  }

  // Filter bab items
  const startBab = selectedJilid === 1 ? 1 : 26

  const filteredBabNumbers = Array.from({ length: 25 }, (_, i) => startBab + i).filter(babNum => {
    const chap = chapterMap[babNum]
    if (!chap) return true

    // Search filter
    const matchesSearch =
      chap.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      chap.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `bab ${babNum}`.includes(searchTerm.toLowerCase())

    // Status filter
    if (statusFilter === 'visible') return matchesSearch && !chap.is_hidden
    if (statusFilter === 'hidden') return matchesSearch && chap.is_hidden

    return matchesSearch
  })

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col gap-6 animate-fade-in">
      {/* Toast Alert */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-[600] px-5 py-3 rounded-2xl shadow-xl border text-xs sm:text-sm font-bold flex items-center gap-2 animate-slide-fade ${
          toastMessage.type === 'success'
            ? 'bg-emerald-600 text-white border-emerald-500'
            : 'bg-rose-600 text-white border-rose-500'
        }`}>
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Panel */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="flex items-start gap-4 z-10">
          <div className="size-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-3xl shrink-0 shadow-md">
            ??
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 bg-amber-500/20 px-3 py-0.5 rounded-full border border-amber-500/30">
                Panel Kelola Pengajar
              </span>
              {!isInstructor && (
                <span className="text-xs font-bold text-rose-300 bg-rose-500/20 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                  Mode Simulasi Admin
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
              Kelola Judul & Visibilitas Kursus
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Atur judul bab, subtitle materi, dan tentukan bab mana yang ingin **ditampilkan ??** atau **disembunyikan ??** dari tampilan siswa di halaman <strong>Kursus Saya</strong>.
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsEditingHeader(prev => !prev)}
          className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 cursor-pointer transition-all shrink-0 z-10 flex items-center justify-center gap-2"
        >
          <span>?? {isEditingHeader ? 'Tutup Edit Header' : 'Edit Header Halaman'}</span>
        </button>
      </div>

      {/* Edit Header Form Card */}
      {isEditingHeader && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md flex flex-col gap-4 animate-slide-down">
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
            <span>??</span>
            <span>Ubah Judul Utama & Subtitle Halaman Kursus Saya</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Judul Utama Halaman
              </label>
              <input
                type="text"
                value={editPageTitle}
                onChange={e => setEditPageTitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">
                Subtitle Deskripsi Halaman
              </label>
              <input
                type="text"
                value={editPageSubtitle}
                onChange={e => setEditPageSubtitle(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsEditingHeader(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border-none cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleSaveHeader}
              className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-extrabold border-none cursor-pointer shadow-sm hover:bg-primary-dark"
            >
              Simpan Header
            </button>
          </div>
        </div>
      )}

      {/* Jilid Switcher + Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4">
        {/* Jilid Tabs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setSelectedJilid(1)}
            className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between ${
              selectedJilid === 1
                ? 'bg-gradient-to-r from-primary to-primary-light text-white border-primary shadow-md'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">??</span>
              <div>
                <div className="font-extrabold text-sm sm:text-base">Minna no Nihongo Jilid 1</div>
                <div className="text-xs opacity-80">Bab 1 s/d Bab 25 (Tingkat Dasar I)</div>
              </div>
            </div>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-white/20">25 Bab</span>
          </button>

          <button
            onClick={() => setSelectedJilid(2)}
            className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex items-center justify-between ${
              selectedJilid === 2
                ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-indigo-600 shadow-md'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">??</span>
              <div>
                <div className="font-extrabold text-sm sm:text-base">Minna no Nihongo Jilid 2</div>
                <div className="text-xs opacity-80">Bab 26 s/d Bab 50 (Tingkat Dasar II)</div>
              </div>
            </div>
            <span className="text-xs font-black px-2.5 py-1 rounded-full bg-white/20">25 Bab</span>
          </button>
        </div>

        {/* Bulk Toggle Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <span>⚡ Aksi Massal (Jilid {selectedJilid}):</span>
            <span className="text-slate-400 font-normal">Aktifkan atau sembunyikan 25 Bab sekaligus dalam 1 klik</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleBatchAutoDetectAll}
              disabled={isDetectingAll}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-extrabold border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>⏱️ {isDetectingAll ? 'Mendeteksi Semua Video...' : `Deteksi & Simpan Durasi Semua Bab Jilid ${selectedJilid}`}</span>
            </button>

            <button
              onClick={() => handleBulkToggleVisibility(false)}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>🟢 Tampilkan Semua Jilid {selectedJilid}</span>
            </button>

            <button
              onClick={() => handleBulkToggleVisibility(true)}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>🔴 Sembunyikan Semua Jilid {selectedJilid}</span>
            </button>
          </div>
        </div>

        {/* Search & Status Filter */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full relative">
            <input
              type="text"
              placeholder="Cari nomor bab, judul bab, atau penjelasan..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">??</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-400 shrink-0">Filter Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="flex-1 sm:flex-initial px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">Semua Status (Tampil & Sembunyi)</option>
              <option value="visible">?? Hanya Ditampilkan (Published)</option>
              <option value="hidden">?? Hanya Disembunyikan (Hidden)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chapters Editor List */}
      {loading ? (
        <CourseCardSkeleton count={5} />
      ) : filteredBabNumbers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3">
          <span className="text-4xl">??</span>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Tidak ada bab ditemukan</h3>
          <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau filter status.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredBabNumbers.map(babNum => {
            const chap = chapterMap[babNum] || {
              bab_number: babNum,
              title: `Bab ${babNum}`,
              subtitle: '',
              is_hidden: false,
            }

            return (
              <div
                key={babNum}
                className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border transition-all flex flex-col gap-4 shadow-sm ${
                  chap.is_hidden
                    ? 'border-rose-300/80 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                {/* Header Row: Bab Title + Visibility Toggle Switch */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`size-11 rounded-2xl flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs ${
                      chap.is_hidden
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200'
                        : 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-400 border border-primary/20'
                    }`}>
                      {babNum}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                          第{babNum}課: {chap.title.replace(/^Bab\s+(\d+):\s*/i, '').replace(/^第\d+課:\s*/i, '')}
                        </h3>
                        <span className={`text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full border ${
                          chap.is_hidden
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                        }`}>
                          {chap.is_hidden ? '?? Disembunyikan dari Siswa' : '?? Tampil ke Siswa'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-medium truncate mt-0.5">
                        {chap.subtitle || 'Belum ada penjelasan bab.'}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => handleToggleHide(babNum)}
                      className={`px-4 py-2 rounded-xl text-xs font-black transition-all border cursor-pointer flex items-center gap-1.5 ${
                        chap.is_hidden
                          ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                          : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      }`}
                    >
                      <span>{chap.is_hidden ? '?? Sembunyi (Klik untuk Tampilkan)' : '?? Tampil (Klik untuk Sembunyikan)'}</span>
                    </button>
                  </div>
                </div>

                {/* Form Fields: Edit Title & Subtitle */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Judul Bab (Bahasa Indonesia / Topik Bab)
                    </label>
                    <input
                      type="text"
                      value={chap.title}
                      onChange={e => {
                        const val = e.target.value
                        setChapterMap(prev => ({
                          ...prev,
                          [babNum]: { ...prev[babNum], title: val },
                        }))
                      }}
                      placeholder="Contoh: Perkenalan Diri"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                      Subtitle / Tata Bahasa Kunci (Kotoba / Pola Kalimat)
                    </label>
                    <input
                      type="text"
                      value={chap.subtitle}
                      onChange={e => {
                        const val = e.target.value
                        setChapterMap(prev => ({
                          ...prev,
                          [babNum]: { ...prev[babNum], subtitle: val },
                        }))
                      }}
                      placeholder="Contoh: わたしはエンジニアです (Saya adalah insinyur)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {/* Duration Form Fields: Video 1, 2, 3 Durations */}
                <div className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <span>⏱️ Durasi Video Pembelajaran (S1, S2, S3):</span>
                      <span className="text-[0.68rem] text-slate-400 font-normal">(Format standar hosting Rumahweb)</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleAutoDetectDurations(babNum)}
                      disabled={detectingBab === babNum}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold border-none cursor-pointer transition-all shadow-2xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto disabled:opacity-50"
                    >
                      <span>{detectingBab === babNum ? '⏳ Mendeteksi Video...' : '🔍 Deteksi Otomatis Durasi dari File'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                        🎥 Durasi Video 1 (S1)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 15.00"
                        value={chap.duration_s1 ?? '15.00'}
                        onChange={e => {
                          const val = e.target.value
                          setChapterMap(prev => ({
                            ...prev,
                            [babNum]: { ...prev[babNum], duration_s1: val },
                          }))
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                        🎥 Durasi Video 2 (S2)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 15.00"
                        value={chap.duration_s2 ?? '15.00'}
                        onChange={e => {
                          const val = e.target.value
                          setChapterMap(prev => ({
                            ...prev,
                            [babNum]: { ...prev[babNum], duration_s2: val },
                          }))
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                        🎥 Durasi Video 3 (S3)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: 12.00"
                        value={chap.duration_s3 ?? '12.00'}
                        onChange={e => {
                          const val = e.target.value
                          setChapterMap(prev => ({
                            ...prev,
                            [babNum]: { ...prev[babNum], duration_s3: val },
                          }))
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:border-primary text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* Video File Auto-Path Preview Info & Save Bab Button */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[0.72rem]">
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <AdaptiveIcon src="/video.png" alt="Video Path" className="size-4 object-contain shrink-0" />
                    <span>File Video di Hosting:</span>
                    <code className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono text-primary dark:text-red-400">
                      {selectedJilid === 1 ? '/kaiwa-1-courses' : '/kaiwa-2-courses'}/BAB {babNum}/Kaiwa Dojo - BAB {babNum} S1.mov, S2.mov, S3.mov
                    </code>
                  </div>

                  <button
                    onClick={() => handleSaveBab(babNum)}
                    disabled={savingBab === babNum}
                    className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary-dark text-white font-extrabold border-none cursor-pointer transition-all self-end sm:self-auto shrink-0 shadow-2xs disabled:opacity-50"
                  >
                    {savingBab === babNum ? 'Menyimpan...' : '💾 Simpan Bab Ini'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
