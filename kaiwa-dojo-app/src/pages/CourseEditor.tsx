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
  detectDurationFromLocalFile,
  parseVideoFileMeta,
  parseTargetGroups,
  CHAPTER_UPDATE_EVENT,
  subscribeToChapterRealtime,
  type ChapterSetting,
  type CourseHeaderSettings,
} from '../lib/chapterService'
import { fetchGroups, type KaiwaGroup, GROUP_UPDATE_EVENT } from '../lib/groupService'
import { CourseCardSkeleton } from '../components/Skeleton'

export default function CourseEditor() {
  const { profile } = useAuth()
  const isInstructor = profile?.role === 'pemateri' || profile?.role === 'admin'

  const [selectedJilid, setSelectedJilid] = useState<1 | 2>(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [groupFilter, setGroupFilter] = useState<string>('all')

  const [chapterMap, setChapterMap] = useState<Record<number, ChapterSetting>>({})
  const [groups, setGroups] = useState<KaiwaGroup[]>([])
  const [showBulkGroupModal, setShowBulkGroupModal] = useState(false)
  const [bulkSelectedGroups, setBulkSelectedGroups] = useState<string[]>([])
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
      showToast(`Hosting belum dapat merespon metadata. Anda bisa klik tombol '📂 Pilih File Video Komputer' di bawah untuk deteksi instan 100%!`, 'error')
    }
  }

  async function handleLocalFilesDuration(babNum: number, files: FileList | null) {
    if (!files || files.length === 0) return
    setDetectingBab(babNum)

    const chap = chapterMap[babNum] || { bab_number: babNum, title: `Bab ${babNum}`, is_hidden: false }
    let d1 = chap.duration_s1
    let d2 = chap.duration_s2
    let d3 = chap.duration_s3
    let detectedCount = 0

    const fileList = Array.from(files)

    for (const file of fileList) {
      try {
        const meta = parseVideoFileMeta(file.name)
        const dur = await detectDurationFromLocalFile(file)

        if (meta.part === 1 || fileList.length === 1) {
          d1 = dur
          detectedCount++
        } else if (meta.part === 2) {
          d2 = dur
          detectedCount++
        } else if (meta.part === 3) {
          d3 = dur
          detectedCount++
        } else {
          if (!d1 || d1 === '15.00') { d1 = dur; detectedCount++ }
          else if (!d2 || d2 === '15.00') { d2 = dur; detectedCount++ }
          else if (!d3 || d3 === '12.00') { d3 = dur; detectedCount++ }
        }
      } catch (err) {
        console.warn('Error reading local file:', file.name, err)
      }
    }

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

    await saveChapterSetting(updated)
    setDetectingBab(null)

    if (detectedCount > 0) {
      showToast(`Berhasil membaca ${detectedCount} durasi dari file video lokal & tersimpan ke database! ⏱️`)
    } else {
      showToast(`Tidak dapat membaca durasi dari file video yang dipilih.`, 'error')
    }
  }

  async function handleBatchLocalFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setIsDetectingAll(true)
    showToast(`Memproses ${files.length} file video lokal dari komputer... ⏱️`)

    let updatedMap = { ...chapterMap }
    let successCount = 0
    const touchedBabs = new Set<number>()

    for (const file of Array.from(files)) {
      try {
        const meta = parseVideoFileMeta(file.name)
        if (meta.bab && meta.part) {
          const dur = await detectDurationFromLocalFile(file)
          const chap = updatedMap[meta.bab] || { bab_number: meta.bab, title: `Bab ${meta.bab}`, is_hidden: false }

          if (meta.part === 1) chap.duration_s1 = dur
          if (meta.part === 2) chap.duration_s2 = dur
          if (meta.part === 3) chap.duration_s3 = dur

          updatedMap[meta.bab] = chap
          touchedBabs.add(meta.bab)
          successCount++
        }
      } catch (err) {
        console.warn('Batch local file read note:', file.name, err)
      }
    }

    setChapterMap(updatedMap)
    setIsDetectingAll(false)

    if (touchedBabs.size > 0) {
      const listToSave = Array.from(touchedBabs).map(b => updatedMap[b]).filter(Boolean)
      await saveBatchChapterSettings(listToSave)
      showToast(`Sukses! ${successCount} durasi video (${touchedBabs.size} Bab) berhasil diperbarui dari file lokal & tersimpan ke database! 🚀`)
    } else {
      showToast(`Nama file tidak terdeteksi pola "BAB {n} S{p}". Contoh nama: "Kaiwa Dojo - BAB 3 S1.mov"`, 'error')
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
    window.addEventListener(GROUP_UPDATE_EVENT, handleSync)
    window.addEventListener('storage', handleSync)
    const unsubscribeRealtime = subscribeToChapterRealtime(handleSync)

    return () => {
      window.removeEventListener(CHAPTER_UPDATE_EVENT, handleSync)
      window.removeEventListener(GROUP_UPDATE_EVENT, handleSync)
      window.removeEventListener('storage', handleSync)
      unsubscribeRealtime()
    }
  }, [])

  async function loadData() {
    setLoading(true)
    const [map, header, groupList] = await Promise.all([
      getChapterSettingsMap(),
      getCourseHeaderSettings(),
      fetchGroups(true),
    ])
    setChapterMap(map)
    setHeaderSettings(header)
    setGroups(groupList)
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

  async function handleBulkSetGroups(groupNames: string[] | null) {
    const startBab = selectedJilid === 1 ? 1 : 26
    const endBab   = selectedJilid === 1 ? 25 : 50

    const finalVal = groupNames && groupNames.length > 0 ? groupNames.join(', ') : null

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
        target_group: finalVal,
      }

      updatedMap[bab] = updated
      updatedList.push(updated)
    }

    setChapterMap(updatedMap)
    await saveBatchChapterSettings(updatedList)

    showToast(
      finalVal
        ? `Akses semua Bab Jilid ${selectedJilid} diatur KHUSUS ${groupNames?.length} GRUP: "${finalVal}" 👥`
        : `Akses semua Bab Jilid ${selectedJilid} diatur PUBLIK (Semua Siswa) 🌐`
    )
  }

  async function handleToggleChapterGroup(babNum: number, groupName: string) {
    const chap = chapterMap[babNum] || {
      bab_number: babNum,
      title: `Bab ${babNum}`,
      subtitle: '',
      is_hidden: false,
    }
    const current = parseTargetGroups(chap.target_group)
    let nextList: string[] = []
    if (current.includes(groupName)) {
      nextList = current.filter(g => g !== groupName)
    } else {
      nextList = [...current, groupName]
    }
    const nextVal = nextList.length > 0 ? nextList.join(', ') : null
    const updated: ChapterSetting = {
      ...chap,
      target_group: nextVal,
    }

    setChapterMap(prev => ({
      ...prev,
      [babNum]: updated,
    }))

    try {
      await saveChapterSetting(updated)
      showToast(
        nextVal
          ? `Akses Bab ${babNum} diatur ke: ${nextList.join(', ')} 👥`
          : `Akses Bab ${babNum} diatur ke Semua Siswa (Publik) 🌐`
      )
    } catch (err: any) {
      showToast(`Gagal menyimpan restriksi grup Bab ${babNum}: ${err?.message || 'Error'}`, 'error')
    }
  }

  async function handleSetChapterAllPublic(babNum: number) {
    const chap = chapterMap[babNum] || {
      bab_number: babNum,
      title: `Bab ${babNum}`,
      subtitle: '',
      is_hidden: false,
    }
    const updated: ChapterSetting = {
      ...chap,
      target_group: null,
    }

    setChapterMap(prev => ({
      ...prev,
      [babNum]: updated,
    }))

    try {
      await saveChapterSetting(updated)
      showToast(`Akses Bab ${babNum} diatur ke Semua Siswa (Publik) 🌐`)
    } catch (err: any) {
      showToast(`Gagal menyimpan: ${err?.message || 'Error'}`, 'error')
    }
  }

  async function handleSetChapterAllGroups(babNum: number) {
    const chap = chapterMap[babNum] || {
      bab_number: babNum,
      title: `Bab ${babNum}`,
      subtitle: '',
      is_hidden: false,
    }
    const allGroupNames = groups.map(g => g.name).join(', ')
    const updated: ChapterSetting = {
      ...chap,
      target_group: allGroupNames || null,
    }

    setChapterMap(prev => ({
      ...prev,
      [babNum]: updated,
    }))

    try {
      await saveChapterSetting(updated)
      showToast(`Akses Bab ${babNum} diatur ke seluruh ${groups.length} Grup 👥`)
    } catch (err: any) {
      showToast(`Gagal menyimpan: ${err?.message || 'Error'}`, 'error')
    }
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
    showToast('Header halaman Kursus Saya berhasil diperbarui! 💾')
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
      `bab ${babNum}`.includes(searchTerm.toLowerCase()) ||
      (chap.target_group && chap.target_group.toLowerCase().includes(searchTerm.toLowerCase()))

    if (!matchesSearch) return false

    // Status filter
    if (statusFilter === 'visible' && chap.is_hidden) return false
    if (statusFilter === 'hidden' && !chap.is_hidden) return false

    // Group filter (multichoice match)
    if (groupFilter !== 'all') {
      const tgList = parseTargetGroups(chap.target_group)
      if (groupFilter === '__public__') {
        if (tgList.length > 0) return false
      } else {
        if (!tgList.some(g => g.toLowerCase() === groupFilter.toLowerCase())) return false
      }
    }

    return true
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
            <label className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5">
              <span>📂 Ambil Durasi Massal dari Folder Komputer</span>
              <input
                type="file"
                multiple
                accept="video/*,.mov,.mp4,.MOV,.MP4"
                className="hidden"
                onChange={e => handleBatchLocalFiles(e.target.files)}
              />
            </label>

            <button
              onClick={handleBatchAutoDetectAll}
              disabled={isDetectingAll}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-extrabold border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>⏱️ {isDetectingAll ? 'Mendeteksi Semua Video...' : `Scan Durasi Hosting Jilid ${selectedJilid}`}</span>
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

            {/* Bulk Set Group Button */}
            <button
              type="button"
              onClick={() => {
                setBulkSelectedGroups([])
                setShowBulkGroupModal(true)
              }}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold border-none cursor-pointer transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>👥 Set Akses Grup Massal (Jilid {selectedJilid})</span>
            </button>
          </div>
        </div>

        {/* Search & Status + Group Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full relative">
            <input
              type="text"
              placeholder="Cari nomor bab, judul bab, atau penjelasan..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-800 dark:text-slate-200 focus:outline-none"
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <span className="text-xs font-bold text-slate-400 shrink-0">Status:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="w-full sm:w-auto px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">Semua Status</option>
                <option value="visible">🟢 Tampil (Published)</option>
                <option value="hidden">🔴 Sembunyi (Hidden)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <span className="text-xs font-bold text-slate-400 shrink-0">Akses:</span>
              <select
                value={groupFilter}
                onChange={e => setGroupFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none"
              >
                <option value="all">Semua Akses (Publik & Khusus)</option>
                <option value="__public__">🌐 Publik (Semua Siswa)</option>
                {groups.map(g => (
                  <option key={g.id} value={g.name}>👥 Khusus: {g.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Group Modal */}
      {showBulkGroupModal && (
        <div className="fixed inset-0 z-[650] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col gap-4 animate-scale-up">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <span>👥</span>
                  <span>Atur Akses Grup Massal (Jilid {selectedJilid})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pilih 1 atau lebih grup untuk diterapkan sekaligus ke seluruh 25 Bab di Jilid {selectedJilid}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkGroupModal(false)}
                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 text-sm font-bold flex items-center justify-center border-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-600 dark:text-slate-300">Pilihan Grup:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkSelectedGroups(groups.map(g => g.name))}
                  className="text-xs font-bold text-indigo-600 hover:underline border-none bg-transparent cursor-pointer"
                >
                  Pilih Semua
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={() => setBulkSelectedGroups([])}
                  className="text-xs font-bold text-rose-600 hover:underline border-none bg-transparent cursor-pointer"
                >
                  Jadikan Publik (Semua Siswa)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1">
              {groups.map(g => {
                const isChecked = bulkSelectedGroups.includes(g.name)
                return (
                  <label
                    key={g.id}
                    className={`p-3 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all ${
                      isChecked
                        ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-950 dark:text-indigo-200'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setBulkSelectedGroups(prev =>
                          isChecked ? prev.filter(x => x !== g.name) : [...prev, g.name]
                        )
                      }}
                      className="size-4 accent-indigo-600 rounded"
                    />
                    <span className="text-xs font-bold">{g.name}</span>
                  </label>
                )
              })}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-[0.72rem] text-slate-500 dark:text-slate-400">
              {bulkSelectedGroups.length === 0 ? (
                <span>🌐 Semua 25 bab akan dibuka untuk <strong>Semua Siswa (Publik)</strong>.</span>
              ) : (
                <span>👥 Semua 25 bab akan dikhususkan untuk <strong>{bulkSelectedGroups.length} grup ({bulkSelectedGroups.join(', ')})</strong>.</span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowBulkGroupModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border-none cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async () => {
                  await handleBulkSetGroups(bulkSelectedGroups.length > 0 ? bulkSelectedGroups : null)
                  setShowBulkGroupModal(false)
                }}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold border-none cursor-pointer shadow-md"
              >
                🚀 Terapkan ke 25 Bab Jilid {selectedJilid}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chapters Editor List */}
      {loading ? (
        <CourseCardSkeleton count={5} />
      ) : filteredBabNumbers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3">
          <span className="text-4xl">🔍</span>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-white">Tidak ada bab ditemukan</h3>
          <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau filter status/akses grup.</p>
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

            const activeChapterGroups = parseTargetGroups(chap.target_group)
            const isGroupRestricted = activeChapterGroups.length > 0

            return (
              <div
                key={babNum}
                className={`bg-white dark:bg-slate-900 rounded-3xl p-5 border transition-all flex flex-col gap-4 shadow-sm ${
                  chap.is_hidden
                    ? 'border-rose-300/80 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20'
                    : isGroupRestricted
                      ? 'border-indigo-300 dark:border-indigo-800/80 bg-indigo-50/10 dark:bg-indigo-950/10'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                {/* Header Row: Bab Title + Visibility & Group Badges + Toggle Switch */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`size-11 rounded-2xl flex items-center justify-center font-extrabold text-sm shrink-0 shadow-xs ${
                      chap.is_hidden
                        ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200'
                        : isGroupRestricted
                          ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200'
                          : 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-400 border border-primary/20'
                    }`}>
                      {babNum}
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                          第{babNum}課: {chap.title.replace(/^Bab\s+(\d+):\s*/i, '').replace(/^第\d+課:\s*/i, '')}
                        </h3>
                        <span className={`text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full border ${
                          chap.is_hidden
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300'
                        }`}>
                          {chap.is_hidden ? '🔴 Disembunyikan' : '🟢 Tampil ke Siswa'}
                        </span>
                        {isGroupRestricted ? (
                          <span className="text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full border bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 flex items-center gap-1">
                            <span>👥 Khusus ({activeChapterGroups.length} Grup):</span>
                            <strong>{activeChapterGroups.join(', ')}</strong>
                          </span>
                        ) : (
                          <span className="text-[0.68rem] font-bold px-2.5 py-0.5 rounded-full border bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700">
                            🌐 Terbuka Semua Siswa
                          </span>
                        )}
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
                      <span>{chap.is_hidden ? '👁️ Tampilkan' : '🙈 Sembunyikan'}</span>
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

                {/* Group Restriction Multi-choice Control */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 flex flex-col gap-2.5 text-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-extrabold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                        <span>👥 Restriksi Akses Grup (Bisa Pilih &gt;1 Grup):</span>
                      </span>
                      <p className="text-[0.7rem] text-slate-500 dark:text-slate-400 mt-0.5">
                        Klik grup untuk menambah/menghapus akses, atau pilih <strong>Semua Siswa</strong> untuk terbuka umum.
                      </p>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => handleSetChapterAllPublic(babNum)}
                        className={`px-2.5 py-1 rounded-lg font-extrabold text-[0.68rem] transition-all cursor-pointer border ${
                          activeChapterGroups.length === 0
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        🌐 Semua Siswa (Publik)
                      </button>

                      {groups.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleSetChapterAllGroups(babNum)}
                          className="px-2 py-1 rounded-lg font-bold text-[0.68rem] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-200 cursor-pointer"
                        >
                          ✓ Pilih Semua Grup
                        </button>
                      )}

                      {activeChapterGroups.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleSetChapterAllPublic(babNum)}
                          className="px-2 py-1 rounded-lg font-bold text-[0.68rem] bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 cursor-pointer"
                        >
                          ✕ Reset
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Multi-choice Group Badges / Pills */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-indigo-100/60 dark:border-indigo-900/40">
                    {groups.length === 0 ? (
                      <span className="text-[0.7rem] text-slate-400 italic">Belum ada grup siswa terdaftar di database. Bab terbuka untuk semua siswa.</span>
                    ) : (
                      groups.map(g => {
                        const isSelected = activeChapterGroups.includes(g.name)
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => handleToggleChapterGroup(babNum, g.name)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5 select-none ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-black scale-[1.02]'
                                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50'
                            }`}
                          >
                            <span className={`size-3.5 rounded-md flex items-center justify-center text-[0.6rem] font-black ${
                              isSelected ? 'bg-white text-indigo-600' : 'border border-slate-300 dark:border-slate-600'
                            }`}>
                              {isSelected ? '✓' : ''}
                            </span>
                            <span>{g.name}</span>
                          </button>
                        )
                      })
                    )}
                  </div>

                  {/* Selected Summary */}
                  <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
                    <span>Status Akses:</span>
                    {activeChapterGroups.length === 0 ? (
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">🌐 Terbuka Publik (Semua Siswa)</span>
                    ) : (
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        👥 {activeChapterGroups.length} Grup Terpilih: {activeChapterGroups.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Duration Form Fields: Video 1, 2, 3 Durations */}
                <div className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <span>⏱️ Durasi Video Pembelajaran (S1, S2, S3):</span>
                      <span className="text-[0.68rem] text-slate-400 font-normal">(Format standar hosting Rumahweb)</span>
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold cursor-pointer transition-all shadow-2xs flex items-center gap-1.5 shrink-0">
                        <span>📂 Pilih File Video (Baca Instan)</span>
                        <input
                          type="file"
                          multiple
                          accept="video/*,.mov,.mp4,.MOV,.MP4"
                          className="hidden"
                          onChange={e => handleLocalFilesDuration(babNum, e.target.files)}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => handleAutoDetectDurations(babNum)}
                        disabled={detectingBab === babNum}
                        className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold border-none cursor-pointer transition-all shadow-2xs flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                      >
                        <span>{detectingBab === babNum ? '⏳ Mendeteksi...' : '🔍 Scan dari Hosting'}</span>
                      </button>
                    </div>
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
