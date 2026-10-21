import { useState, useEffect, useRef, type ReactNode } from 'react'
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
import { fetchGroups, sortGroupsAlphabetically, type KaiwaGroup, GROUP_UPDATE_EVENT } from '../lib/groupService'
import { CourseCardSkeleton } from '../components/Skeleton'
import ModalPortal from '../components/ModalPortal'
import { useToast } from '../contexts/ToastContext'
import { useConfirm } from '../contexts/ConfirmContext'

type ChapterMap = Record<number, ChapterSetting>
type DurationKey = 'duration_s1' | 'duration_s2' | 'duration_s3'

const DEFAULT_DURATION: Record<DurationKey, string> = { duration_s1: '15.00', duration_s2: '15.00', duration_s3: '12.00' }
const DURATION_KEYS: DurationKey[] = ['duration_s1', 'duration_s2', 'duration_s3']
const DURATION_RE = /^\d{1,3}([.:]\d{1,2})?$/

const CARD = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm'
const inputClass =
  'w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors'

function defaultChapter(bab: number): ChapterSetting {
  return { bab_number: bab, title: `Bab ${bab}`, subtitle: '', is_hidden: false }
}

function cleanTitle(title: string) {
  return title.replace(/^Bab\s+\d+:\s*/i, '').replace(/^第\d+課:\s*/i, '')
}

function durationOf(chap: ChapterSetting, key: DurationKey): string {
  const v = chap[key]
  return v == null || v === '' ? DEFAULT_DURATION[key] : String(v)
}

/** Bab ini punya perubahan judul/subjudul/durasi yang belum disimpan? */
function isChapterDirty(current?: ChapterSetting, saved?: ChapterSetting) {
  if (!current || !saved) return false
  return (
    current.title !== saved.title ||
    (current.subtitle || '') !== (saved.subtitle || '') ||
    DURATION_KEYS.some(k => durationOf(current, k) !== durationOf(saved, k))
  )
}

function Icon({ d, className = 'size-4' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}

const ICON = {
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  eyeOff: 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
  globe: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  folder: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  chevron: 'M19 9l-7 7-7-7',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  bolt: 'M13 10V3L4 14h7v7l9-11h-7z',
  close: 'M6 18L18 6M6 6l12 12',
  check: 'M5 13l4 4L19 7',
  video: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z',
}

function SectionLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{children}</p>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{hint}</p>}
    </div>
  )
}

export default function CourseEditor() {
  const { toast } = useToast()
  const confirm = useConfirm()

  const [selectedJilid, setSelectedJilid] = useState<1 | 2>(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'visible' | 'hidden'>('all')
  const [groupFilter, setGroupFilter] = useState<string>('all')

  // chapterMap = nilai di form (bisa belum disimpan); savedMap = nilai terakhir di database
  const [chapterMap, setChapterMap] = useState<ChapterMap>({})
  const [savedMap, setSavedMap] = useState<ChapterMap>({})
  const savedRef = useRef<ChapterMap>({})
  const [groups, setGroups] = useState<KaiwaGroup[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const [loading, setLoading] = useState(true)
  const [savingBabs, setSavingBabs] = useState<Set<number>>(new Set())
  const [detectingBab, setDetectingBab] = useState<number | null>(null)
  const [isDetectingAll, setIsDetectingAll] = useState(false)

  const [showBulkMenu, setShowBulkMenu] = useState(false)
  const bulkMenuRef = useRef<HTMLDivElement>(null)
  const [showBulkGroupModal, setShowBulkGroupModal] = useState(false)
  const [bulkSelectedGroups, setBulkSelectedGroups] = useState<string[]>([])

  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [editPageTitle, setEditPageTitle] = useState('')
  const [editPageSubtitle, setEditPageSubtitle] = useState('')

  const getChap = (bab: number, map: ChapterMap = chapterMap) => map[bab] || defaultChapter(bab)
  const getSaved = (bab: number) => savedRef.current[bab] || defaultChapter(bab)

  function updateSaved(next: ChapterMap) {
    savedRef.current = next
    setSavedMap(next)
  }

  /* ── Muat data. Mode senyap: perubahan yang belum disimpan tidak ditimpa ── */
  async function loadData(silent = false) {
    if (!silent) setLoading(true)
    const [map, header, groupList] = await Promise.all([
      getChapterSettingsMap(),
      getCourseHeaderSettings(),
      fetchGroups(true),
    ])
    const prevSaved = savedRef.current
    updateSaved({ ...map })
    setChapterMap(prev => {
      if (!silent) return { ...map }
      const merged: ChapterMap = { ...map }
      Object.keys(prev).forEach(k => {
        const bab = Number(k)
        if (isChapterDirty(prev[bab], prevSaved[bab])) {
          // pertahankan isian yang sedang diedit, tetapi ikuti status tampil/akses terbaru
          merged[bab] = { ...prev[bab], is_hidden: map[bab]?.is_hidden ?? prev[bab].is_hidden, target_group: map[bab]?.target_group ?? null }
        }
      })
      return merged
    })
    setGroups(sortGroupsAlphabetically(groupList))
    if (!silent) {
      setEditPageTitle(header.page_title)
      setEditPageSubtitle(header.page_subtitle)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const handleSync = () => loadData(true)
    window.addEventListener(CHAPTER_UPDATE_EVENT, handleSync)
    window.addEventListener(GROUP_UPDATE_EVENT, handleSync)
    const unsubscribeRealtime = subscribeToChapterRealtime(handleSync)
    return () => {
      window.removeEventListener(CHAPTER_UPDATE_EVENT, handleSync)
      window.removeEventListener(GROUP_UPDATE_EVENT, handleSync)
      unsubscribeRealtime()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tutup menu aksi massal saat klik di luar / Escape
  useEffect(() => {
    if (!showBulkMenu) return
    const onPointer = (e: PointerEvent) => {
      if (bulkMenuRef.current && !bulkMenuRef.current.contains(e.target as Node)) setShowBulkMenu(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowBulkMenu(false) }
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [showBulkMenu])

  /**
   * Simpan perubahan "langsung" (tampil/sembunyi, akses grup, durasi hasil deteksi) tanpa
   * ikut menyimpan isian judul/durasi lain yang sedang diedit di form.
   */
  async function applyImmediate(babs: number[], patch: (saved: ChapterSetting) => Partial<ChapterSetting>) {
    const nextSaved: ChapterMap = { ...savedRef.current }
    const toSave: ChapterSetting[] = []
    const patches: Record<number, Partial<ChapterSetting>> = {}
    babs.forEach(bab => {
      const base = getSaved(bab)
      const p = patch(base)
      patches[bab] = p
      nextSaved[bab] = { ...base, ...p }
      toSave.push(nextSaved[bab])
    })
    updateSaved(nextSaved)
    setChapterMap(prev => {
      const next = { ...prev }
      babs.forEach(bab => { next[bab] = { ...getChap(bab, prev), ...patches[bab] } })
      return next
    })
    if (toSave.length === 1) await saveChapterSetting(toSave[0])
    else await saveBatchChapterSettings(toSave)
  }

  const jilidBabs = Array.from({ length: 25 }, (_, i) => (selectedJilid === 1 ? 1 : 26) + i)

  /* ── Aksi per bab ── */
  function editField(bab: number, field: keyof ChapterSetting, value: string) {
    setChapterMap(prev => ({ ...prev, [bab]: { ...getChap(bab, prev), [field]: value } }))
  }

  async function handleSaveBab(bab: number) {
    const chap = getChap(bab)
    const invalid = DURATION_KEYS.find(k => !DURATION_RE.test(durationOf(chap, k)))
    if (invalid) {
      toast.error('Format durasi tidak valid. Gunakan menit.detik, contoh 15.30', 'Edit Kursus')
      return
    }
    setSavingBabs(prev => new Set(prev).add(bab))
    try {
      const toSave: ChapterSetting = { ...getSaved(bab), title: chap.title.trim() || `Bab ${bab}`, subtitle: chap.subtitle.trim() }
      DURATION_KEYS.forEach(k => { toSave[k] = durationOf(chap, k).replace(':', '.') })
      await saveChapterSetting(toSave)
      updateSaved({ ...savedRef.current, [bab]: toSave })
      setChapterMap(prev => ({ ...prev, [bab]: { ...getChap(bab, prev), title: toSave.title, subtitle: toSave.subtitle, ...Object.fromEntries(DURATION_KEYS.map(k => [k, toSave[k]])) } }))
      toast.success(`Bab ${bab} tersimpan.`, 'Edit Kursus')
    } catch (err: any) {
      toast.error(`Gagal menyimpan Bab ${bab}: ${err?.message || 'Error'}`, 'Edit Kursus')
    } finally {
      setSavingBabs(prev => { const n = new Set(prev); n.delete(bab); return n })
    }
  }

  function handleDiscardBab(bab: number) {
    setChapterMap(prev => ({ ...prev, [bab]: { ...getSaved(bab) } }))
  }

  async function handleToggleHide(bab: number) {
    const nextHidden = !getChap(bab).is_hidden
    try {
      await applyImmediate([bab], () => ({ is_hidden: nextHidden, has_video: !nextHidden }))
      toast.success(nextHidden ? `Bab ${bab} disembunyikan dari siswa.` : `Bab ${bab} ditampilkan ke siswa.`, 'Edit Kursus')
    } catch (err: any) {
      toast.error(err?.message || 'Gagal mengubah visibilitas.', 'Edit Kursus')
    }
  }

  async function setChapterGroups(bab: number, list: string[]) {
    const value = list.length > 0 ? list.join(', ') : null
    try {
      await applyImmediate([bab], () => ({ target_group: value }))
    } catch (err: any) {
      toast.error(`Gagal menyimpan akses Bab ${bab}: ${err?.message || 'Error'}`, 'Edit Kursus')
    }
  }

  function handleToggleChapterGroup(bab: number, groupName: string) {
    const current = parseTargetGroups(getChap(bab).target_group)
    setChapterGroups(bab, current.includes(groupName) ? current.filter(g => g !== groupName) : [...current, groupName])
  }

  /* ── Durasi ── */
  async function saveDetectedDurations(bab: number, found: Partial<Record<DurationKey, string>>) {
    const count = Object.keys(found).length
    if (count === 0) return 0
    await applyImmediate([bab], () => found)
    return count
  }

  async function handleAutoDetectDurations(bab: number) {
    setDetectingBab(bab)
    const saved = getSaved(bab)
    const found: Partial<Record<DurationKey, string>> = {}
    for (const [i, key] of DURATION_KEYS.entries()) {
      try {
        const custom = (saved as any)[`custom_video_s${i + 1}`] || ''
        found[key] = String(await detectVideoDuration(custom, bab, i + 1))
      } catch { /* video belum ada di hosting */ }
    }
    const count = await saveDetectedDurations(bab, found)
    setDetectingBab(null)
    if (count > 0) toast.success(`${count} durasi video Bab ${bab} terdeteksi & tersimpan.`, 'Edit Kursus')
    else toast.error('Hosting belum merespons. Coba "Baca dari file" untuk hasil instan.', 'Edit Kursus')
  }

  async function handleLocalFilesDuration(bab: number, files: FileList | null) {
    if (!files || files.length === 0) return
    setDetectingBab(bab)
    const list = Array.from(files)
    const found: Partial<Record<DurationKey, string>> = {}
    for (const file of list) {
      try {
        const meta = parseVideoFileMeta(file.name)
        const dur = String(await detectDurationFromLocalFile(file))
        const part = meta.part ?? (list.length === 1 ? 1 : null)
        const key = part ? DURATION_KEYS[part - 1] : DURATION_KEYS.find(k => !found[k])
        if (key) found[key] = dur
      } catch (err) {
        console.warn('Error reading local file:', file.name, err)
      }
    }
    const count = await saveDetectedDurations(bab, found)
    setDetectingBab(null)
    if (count > 0) toast.success(`${count} durasi dari file lokal tersimpan untuk Bab ${bab}.`, 'Edit Kursus')
    else toast.error('Durasi tidak bisa dibaca dari file yang dipilih.', 'Edit Kursus')
  }

  async function handleBatchLocalFiles(files: FileList | null) {
    setShowBulkMenu(false)
    if (!files || files.length === 0) return
    setIsDetectingAll(true)
    const perBab: Record<number, Partial<Record<DurationKey, string>>> = {}
    let successCount = 0
    for (const file of Array.from(files)) {
      try {
        const meta = parseVideoFileMeta(file.name)
        if (meta.bab && meta.part && meta.part <= 3) {
          const dur = String(await detectDurationFromLocalFile(file))
          perBab[meta.bab] = { ...(perBab[meta.bab] || {}), [DURATION_KEYS[meta.part - 1]]: dur }
          successCount++
        }
      } catch (err) {
        console.warn('Batch local file read note:', file.name, err)
      }
    }
    const babs = Object.keys(perBab).map(Number)
    if (babs.length > 0) {
      await applyImmediate(babs, (saved) => perBab[saved.bab_number])
      toast.success(`${successCount} durasi dari ${babs.length} bab tersimpan.`, 'Edit Kursus')
    } else {
      toast.error('Nama file harus berpola "BAB {n} S{p}", contoh: Kaiwa Dojo - BAB 3 S1.mov', 'Edit Kursus')
    }
    setIsDetectingAll(false)
  }

  async function handleBatchAutoDetectAll() {
    setShowBulkMenu(false)
    setIsDetectingAll(true)
    toast.info(`Memindai durasi video Jilid ${selectedJilid} dari hosting…`, 'Edit Kursus')
    const perBab: Record<number, Partial<Record<DurationKey, string>>> = {}
    let successCount = 0
    for (const bab of jilidBabs) {
      const saved = getSaved(bab)
      for (const [i, key] of DURATION_KEYS.entries()) {
        try {
          const custom = (saved as any)[`custom_video_s${i + 1}`] || ''
          const dur = String(await detectVideoDuration(custom, bab, i + 1))
          perBab[bab] = { ...(perBab[bab] || {}), [key]: dur }
          successCount++
        } catch { /* lewati */ }
      }
    }
    const babs = Object.keys(perBab).map(Number)
    if (babs.length > 0) await applyImmediate(babs, (saved) => perBab[saved.bab_number])
    setIsDetectingAll(false)
    toast.success(`Selesai: ${successCount} durasi video terdeteksi & tersimpan.`, 'Edit Kursus')
  }

  /* ── Aksi massal ── */
  async function handleBulkToggleVisibility(hide: boolean) {
    setShowBulkMenu(false)
    const ok = await confirm({
      title: hide ? `Sembunyikan semua bab Jilid ${selectedJilid}?` : `Tampilkan semua bab Jilid ${selectedJilid}?`,
      message: hide
        ? '25 bab akan disembunyikan dari halaman Kursus Saya siswa.'
        : '25 bab akan langsung terlihat oleh siswa (sesuai akses grup masing-masing bab).',
      confirmLabel: hide ? 'Ya, sembunyikan' : 'Ya, tampilkan',
      tone: hide ? 'danger' : 'primary',
      icon: 'warning',
    })
    if (!ok) return
    await applyImmediate(jilidBabs, () => ({ is_hidden: hide }))
    toast.success(hide ? `Semua bab Jilid ${selectedJilid} disembunyikan.` : `Semua bab Jilid ${selectedJilid} ditampilkan.`, 'Edit Kursus')
  }

  async function handleBulkSetGroups() {
    const value = bulkSelectedGroups.length > 0 ? bulkSelectedGroups.join(', ') : null
    await applyImmediate(jilidBabs, () => ({ target_group: value }))
    setShowBulkGroupModal(false)
    toast.success(
      value ? `Akses 25 bab diatur untuk ${bulkSelectedGroups.length} grup.` : 'Akses 25 bab dibuka untuk semua siswa.',
      'Edit Kursus'
    )
  }

  async function handleSaveAllDirty(babs: number[]) {
    for (const bab of babs) await handleSaveBab(bab)
  }

  async function handleSaveHeader() {
    const newHeader: CourseHeaderSettings = { page_title: editPageTitle.trim(), page_subtitle: editPageSubtitle.trim() }
    await saveCourseHeaderSettings(newHeader)
    setIsEditingHeader(false)
    toast.success('Judul halaman Kursus Saya diperbarui.', 'Edit Kursus')
  }

  function toggleExpanded(bab: number) {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(bab)) n.delete(bab)
      else n.add(bab)
      return n
    })
  }

  /* ── Data turunan ── */
  const q = searchTerm.trim().toLowerCase()
  const filteredBabs = jilidBabs.filter(bab => {
    const chap = getChap(bab)
    if (q) {
      const hay = `${chap.title} ${chap.subtitle} bab ${bab} 第${bab}課 ${chap.target_group || ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    if (statusFilter === 'visible' && chap.is_hidden) return false
    if (statusFilter === 'hidden' && !chap.is_hidden) return false
    if (groupFilter !== 'all') {
      const list = parseTargetGroups(chap.target_group)
      if (groupFilter === '__public__') return list.length === 0
      return list.some(g => g.toLowerCase() === groupFilter.toLowerCase())
    }
    return true
  })

  const visibleCount = jilidBabs.filter(b => !getChap(b).is_hidden).length
  const restrictedCount = jilidBabs.filter(b => parseTargetGroups(getChap(b).target_group).length > 0).length
  const dirtyBabs = jilidBabs.filter(b => isChapterDirty(chapterMap[b], savedMap[b]))
  const hasFilters = Boolean(q) || statusFilter !== 'all' || groupFilter !== 'all'

  const menuItem = 'w-full flex items-center gap-3 h-11 px-3 rounded-xl text-sm font-medium text-left text-slate-700 dark:text-slate-200 bg-transparent border-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors'

  return (
    <main className="flex-1 px-4 py-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full min-w-0 animate-page-slide">
      {/* ── Judul halaman ── */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4 sm:mb-6">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Edit Kursus</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Atur judul bab, durasi video, visibilitas, dan akses grup untuk halaman Kursus Saya.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsEditingHeader(true)}
          className="h-10 px-3.5 shrink-0 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer flex items-center gap-2 transition-colors"
        >
          <Icon d={ICON.edit} />
          Judul halaman Kursus Saya
        </button>
      </header>

      {/* ── Toolbar ── */}
      <section className={`${CARD} p-3 sm:p-4 mb-4 flex flex-col gap-3`}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          {/* Jilid */}
          <div role="tablist" aria-label="Pilih jilid" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 lg:w-72 shrink-0">
            {([1, 2] as const).map(j => (
              <button
                key={j}
                type="button"
                role="tab"
                aria-selected={selectedJilid === j}
                onClick={() => { setSelectedJilid(j); setExpanded(new Set()) }}
                className={`h-10 rounded-lg text-sm font-semibold border-none cursor-pointer transition-colors ${
                  selectedJilid === j ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400'
                }`}
              >
                Jilid {j} <span className="font-normal text-slate-400">· Bab {j === 1 ? '1–25' : '26–50'}</span>
              </button>
            ))}
          </div>

          {/* Cari */}
          <div className="relative flex-1 min-w-0">
            <Icon d={ICON.search} className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Cari nomor bab, judul, atau grup…"
              className={`${inputClass} pl-10`}
            />
          </div>

          {/* Aksi massal */}
          <div ref={bulkMenuRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowBulkMenu(v => !v)}
              aria-haspopup="menu"
              aria-expanded={showBulkMenu}
              disabled={isDetectingAll}
              className="w-full lg:w-auto h-11 px-4 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white text-sm font-semibold border-none cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isDetectingAll ? <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> : <Icon d={ICON.bolt} />}
              {isDetectingAll ? 'Memproses…' : `Aksi massal Jilid ${selectedJilid}`}
              <Icon d={ICON.chevron} className={`size-4 transition-transform ${showBulkMenu ? 'rotate-180' : ''}`} />
            </button>
            {showBulkMenu && (
              <div role="menu" className="absolute right-0 top-full mt-2 z-30 w-[min(20rem,calc(100vw-2rem))] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl p-2 animate-fade-in-up">
                <p className="px-3 pt-1 pb-1.5 text-xs font-semibold text-slate-400">Visibilitas & akses (25 bab)</p>
                <button type="button" role="menuitem" onClick={() => handleBulkToggleVisibility(false)} className={menuItem}>
                  <Icon d={ICON.eye} className="size-5 text-emerald-600" /> Tampilkan semua bab
                </button>
                <button type="button" role="menuitem" onClick={() => handleBulkToggleVisibility(true)} className={menuItem}>
                  <Icon d={ICON.eyeOff} className="size-5 text-rose-600" /> Sembunyikan semua bab
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowBulkMenu(false); setBulkSelectedGroups([]); setShowBulkGroupModal(true) }}
                  className={menuItem}
                >
                  <Icon d={ICON.users} className="size-5 text-indigo-600" /> Atur akses grup…
                </button>
                <div className="h-px bg-slate-100 dark:bg-slate-800 my-1.5" />
                <p className="px-3 pt-1 pb-1.5 text-xs font-semibold text-slate-400">Durasi video</p>
                <button type="button" role="menuitem" onClick={handleBatchAutoDetectAll} className={menuItem}>
                  <Icon d={ICON.clock} className="size-5 text-sky-600" /> Pindai durasi dari hosting
                </button>
                <label role="menuitem" className={menuItem}>
                  <Icon d={ICON.folder} className="size-5 text-amber-600" />
                  <span className="min-w-0">
                    <span className="block">Baca durasi dari file komputer</span>
                    <span className="block text-xs text-slate-400 font-normal">Pilih banyak file "BAB n Sx" sekaligus</span>
                  </span>
                  <input type="file" multiple accept="video/*,.mov,.mp4,.MOV,.MP4" className="hidden" onChange={e => handleBatchLocalFiles(e.target.files)} />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70">
            {([
              ['all', 'Semua', jilidBabs.length],
              ['visible', 'Tampil', visibleCount],
              ['hidden', 'Disembunyikan', jilidBabs.length - visibleCount],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                aria-pressed={statusFilter === key}
                className={`h-9 px-3 rounded-lg text-sm font-semibold border-none cursor-pointer transition-colors ${
                  statusFilter === key ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400'
                }`}
              >
                {label} <span className="text-xs font-normal text-slate-400 tabular-nums">{count}</span>
              </button>
            ))}
          </div>
          <select
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
            aria-label="Filter akses"
            className="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-primary"
          >
            <option value="all">Semua akses</option>
            <option value="__public__">Publik (semua siswa)</option>
            {groups.map(g => <option key={g.id} value={g.name}>Grup: {g.name}</option>)}
          </select>
          <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto hidden sm:block">
            {restrictedCount} bab khusus grup
          </span>
        </div>
      </section>

      {/* Banner perubahan belum disimpan */}
      {dirtyBabs.length > 0 && (
        <div className="mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3 pl-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-amber-900 dark:text-amber-200 flex-1 min-w-0">
            <strong>{dirtyBabs.length} bab</strong> punya perubahan yang belum disimpan ({dirtyBabs.map(b => `Bab ${b}`).join(', ')}).
          </span>
          <button
            type="button"
            onClick={() => handleSaveAllDirty(dirtyBabs)}
            disabled={savingBabs.size > 0}
            className="h-10 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer disabled:opacity-60"
          >
            Simpan semua
          </button>
        </div>
      )}

      {/* ── Daftar bab ── */}
      {loading ? (
        <CourseCardSkeleton count={5} />
      ) : filteredBabs.length === 0 ? (
        <div className={`${CARD} p-10 text-center`}>
          <p className="text-base font-semibold text-slate-800 dark:text-white">Tidak ada bab yang cocok</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ubah kata kunci atau filter.</p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); setGroupFilter('all') }}
              className="mt-3 h-10 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 border-none cursor-pointer"
            >
              Hapus filter
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2 px-1">
            <p className="text-sm text-slate-500 dark:text-slate-400">{filteredBabs.length} bab</p>
            <button
              type="button"
              onClick={() => setExpanded(prev => (prev.size > 0 ? new Set() : new Set(filteredBabs)))}
              className="h-9 px-2 rounded-lg text-sm font-semibold text-primary dark:text-primary-lighter bg-transparent border-none cursor-pointer hover:bg-primary/5"
            >
              {expanded.size > 0 ? 'Tutup semua' : 'Buka semua'}
            </button>
          </div>

          <ul className={`${CARD} overflow-hidden divide-y divide-slate-100 dark:divide-slate-800`}>
            {filteredBabs.map(bab => {
              const chap = getChap(bab)
              const groupsOfBab = parseTargetGroups(chap.target_group)
              const isOpen = expanded.has(bab)
              const dirty = isChapterDirty(chapterMap[bab], savedMap[bab])
              const saving = savingBabs.has(bab)
              const detecting = detectingBab === bab
              const durationInvalid = DURATION_KEYS.some(k => !DURATION_RE.test(durationOf(chap, k)))

              return (
                <li key={bab} className={chap.is_hidden ? 'bg-slate-50/70 dark:bg-slate-900/60' : ''}>
                  {/* Baris ringkas */}
                  <div className="flex items-center gap-3 px-3 sm:px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(bab)}
                      aria-expanded={isOpen}
                      aria-controls={`bab-panel-${bab}`}
                      className="min-w-0 flex-1 flex items-center gap-3 text-left bg-transparent border-none cursor-pointer"
                    >
                      <span className={`size-11 shrink-0 rounded-xl flex flex-col items-center justify-center leading-none ${
                        chap.is_hidden ? 'bg-slate-200/70 dark:bg-slate-800 text-slate-500' : 'bg-primary/10 text-primary dark:text-primary-lighter'
                      }`}>
                        <span className="text-[10px] font-semibold opacity-70">BAB</span>
                        <span className="text-base font-bold tabular-nums">{bab}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={`text-sm sm:text-[15px] font-semibold truncate ${chap.is_hidden ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                            {cleanTitle(chap.title) || `Bab ${bab}`}
                          </span>
                          {dirty && <span className="shrink-0 size-2 rounded-full bg-amber-500" title="Belum disimpan" />}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">{chap.subtitle || 'Belum ada subjudul'}</span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                            chap.is_hidden ? 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}>
                            {chap.is_hidden ? 'Disembunyikan' : 'Tampil'}
                          </span>
                          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                            groupsOfBab.length > 0 ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            {groupsOfBab.length === 0 ? 'Semua siswa' : groupsOfBab.length === 1 ? `Grup ${groupsOfBab[0]}` : `${groupsOfBab.length} grup`}
                          </span>
                          <span className="hidden sm:inline text-[11px] text-slate-400 tabular-nums">
                            {DURATION_KEYS.map(k => durationOf(chap, k)).join(' · ')} mnt
                          </span>
                        </span>
                      </span>
                    </button>

                    {/* Saklar tampil */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!chap.is_hidden}
                      aria-label={chap.is_hidden ? `Tampilkan Bab ${bab}` : `Sembunyikan Bab ${bab}`}
                      title={chap.is_hidden ? 'Tampilkan ke siswa' : 'Sembunyikan dari siswa'}
                      onClick={() => handleToggleHide(bab)}
                      className={`relative h-7 w-12 shrink-0 rounded-full border-none cursor-pointer transition-colors ${!chap.is_hidden ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                    >
                      <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${!chap.is_hidden ? 'left-6' : 'left-1'}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleExpanded(bab)}
                      aria-label={isOpen ? 'Tutup editor' : 'Buka editor'}
                      className="size-10 shrink-0 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 bg-transparent border-none cursor-pointer"
                    >
                      <Icon d={ICON.chevron} className={`size-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Panel editor */}
                  {isOpen && (
                    <div id={`bab-panel-${bab}`} className="px-3 sm:px-4 pb-4 animate-fade-in">
                      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 p-4 flex flex-col gap-5">
                        {/* Judul */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label htmlFor={`title-${bab}`} className="block text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1.5">Judul bab</label>
                            <input id={`title-${bab}`} type="text" value={chap.title} onChange={e => editField(bab, 'title', e.target.value)} placeholder="Contoh: Perkenalan Diri" className={inputClass} />
                          </div>
                          <div>
                            <label htmlFor={`sub-${bab}`} className="block text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1.5">Subjudul / pola kalimat</label>
                            <input id={`sub-${bab}`} type="text" value={chap.subtitle} onChange={e => editField(bab, 'subtitle', e.target.value)} placeholder="わたしはエンジニアです (Saya adalah insinyur)" className={inputClass} />
                          </div>
                        </div>

                        {/* Durasi */}
                        <div>
                          <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
                            <SectionLabel hint="Format menit.detik, contoh 15.30">Durasi video</SectionLabel>
                            <div className="flex gap-2">
                              <label className={`h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 ${detecting ? 'opacity-50 pointer-events-none' : ''}`}>
                                <Icon d={ICON.folder} className="size-4 text-amber-600" />
                                Baca dari file
                                <input type="file" multiple accept="video/*,.mov,.mp4,.MOV,.MP4" className="hidden" onChange={e => handleLocalFilesDuration(bab, e.target.files)} />
                              </label>
                              <button
                                type="button"
                                onClick={() => handleAutoDetectDurations(bab)}
                                disabled={detecting}
                                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                              >
                                {detecting ? <span className="size-3.5 rounded-full border-2 border-slate-300 border-t-sky-600 animate-spin" /> : <Icon d={ICON.clock} className="size-4 text-sky-600" />}
                                {detecting ? 'Memindai…' : 'Pindai hosting'}
                              </button>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 sm:gap-3">
                            {DURATION_KEYS.map((key, i) => {
                              const value = durationOf(chap, key)
                              const invalid = !DURATION_RE.test(value)
                              return (
                                <div key={key}>
                                  <label htmlFor={`${key}-${bab}`} className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Video {i + 1}</label>
                                  <div className="relative">
                                    <input
                                      id={`${key}-${bab}`}
                                      type="text"
                                      inputMode="decimal"
                                      value={value}
                                      onChange={e => editField(bab, key, e.target.value)}
                                      aria-invalid={invalid}
                                      className={`${inputClass} pr-11 tabular-nums ${invalid ? '!border-red-400' : ''}`}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">mnt</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          <p className="mt-2 text-xs text-slate-400 break-all">
                            File di hosting: <code className="font-mono text-slate-500 dark:text-slate-400">{selectedJilid === 1 ? '/kaiwa-1-courses' : '/kaiwa-2-courses'}/BAB {bab}/Kaiwa Dojo - BAB {bab} S1–S3.mov</code>
                          </p>
                        </div>

                        {/* Akses grup */}
                        <div>
                          <SectionLabel hint="Tersimpan otomatis saat dipilih. Tanpa grup = terbuka untuk semua siswa.">Akses grup</SectionLabel>
                          {groups.length === 0 ? (
                            <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada grup. Bab terbuka untuk semua siswa.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setChapterGroups(bab, [])}
                                aria-pressed={groupsOfBab.length === 0}
                                className={`h-9 px-3 rounded-lg text-sm font-semibold border cursor-pointer flex items-center gap-1.5 transition-colors ${
                                  groupsOfBab.length === 0
                                    ? 'bg-emerald-600 border-emerald-600 text-white'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                              >
                                <Icon d={ICON.globe} className="size-4" /> Semua siswa
                              </button>
                              {groups.map(g => {
                                const selected = groupsOfBab.includes(g.name)
                                return (
                                  <button
                                    key={g.id}
                                    type="button"
                                    onClick={() => handleToggleChapterGroup(bab, g.name)}
                                    aria-pressed={selected}
                                    className={`h-9 px-3 rounded-lg text-sm font-semibold border cursor-pointer flex items-center gap-1.5 transition-colors ${
                                      selected
                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    {selected && <Icon d={ICON.check} className="size-4" />}
                                    {g.name}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        {/* Aksi simpan */}
                        <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                          <span className="mr-auto text-xs text-slate-500 dark:text-slate-400">
                            {dirty ? 'Judul/durasi berubah, belum disimpan.' : 'Tampil/sembunyi & akses grup tersimpan otomatis.'}
                          </span>
                          {dirty && (
                            <button
                              type="button"
                              onClick={() => handleDiscardBab(bab)}
                              disabled={saving}
                              className="h-10 px-3.5 rounded-xl text-sm font-semibold text-slate-600 dark:text-slate-300 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 border-none cursor-pointer"
                            >
                              Batalkan
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleSaveBab(bab)}
                            disabled={!dirty || saving || durationInvalid}
                            className="h-10 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {saving && <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                            {saving ? 'Menyimpan…' : 'Simpan bab'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {/* ── Sheet: akses grup massal ── */}
      {showBulkGroupModal && (
        <ModalPortal>
          <div className="modal-overlay fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowBulkGroupModal(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="bulk-group-title"
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl px-5 pt-3 sm:pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 max-h-[90dvh] flex flex-col animate-fade-in-up"
            >
              <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="bulk-group-title" className="text-lg font-bold text-slate-900 dark:text-white">Akses grup Jilid {selectedJilid}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Diterapkan ke seluruh 25 bab. Akses per bab sebelumnya akan diganti.</p>
                </div>
                <button type="button" onClick={() => setShowBulkGroupModal(false)} aria-label="Tutup" className="size-10 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-none cursor-pointer flex items-center justify-center">
                  <Icon d={ICON.close} className="size-5" />
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{bulkSelectedGroups.length} grup dipilih</span>
                <button type="button" onClick={() => setBulkSelectedGroups(bulkSelectedGroups.length === groups.length ? [] : groups.map(g => g.name))} className="h-9 px-2 rounded-lg font-semibold text-primary dark:text-primary-lighter bg-transparent border-none cursor-pointer">
                  {bulkSelectedGroups.length === groups.length ? 'Kosongkan' : 'Pilih semua'}
                </button>
              </div>
              <div className="mt-2 flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5">
                {groups.map(g => {
                  const checked = bulkSelectedGroups.includes(g.name)
                  return (
                    <label key={g.id} className={`min-h-[44px] px-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-colors ${checked ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setBulkSelectedGroups(prev => (checked ? prev.filter(x => x !== g.name) : [...prev, g.name]))}
                        className="size-4 accent-indigo-600"
                      />
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{g.name}</span>
                    </label>
                  )
                })}
              </div>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3">
                {bulkSelectedGroups.length === 0
                  ? <>Semua bab akan terbuka untuk <strong>semua siswa</strong>.</>
                  : <>Semua bab hanya untuk: <strong>{bulkSelectedGroups.join(', ')}</strong>.</>}
              </p>
              <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2">
                <button type="button" onClick={() => setShowBulkGroupModal(false)} className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold border-none cursor-pointer">Batal</button>
                <button type="button" onClick={handleBulkSetGroups} className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer">Terapkan ke 25 bab</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* ── Sheet: judul halaman Kursus Saya ── */}
      {isEditingHeader && (
        <ModalPortal>
          <div className="modal-overlay fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsEditingHeader(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="header-edit-title"
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl px-5 pt-3 sm:pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 animate-fade-in-up"
            >
              <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
              <h3 id="header-edit-title" className="text-lg font-bold text-slate-900 dark:text-white">Judul halaman Kursus Saya</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Tampil di bagian atas halaman Kursus Saya siswa.</p>

              <div className="mt-4 flex flex-col gap-3">
                <div>
                  <label htmlFor="page-title" className="block text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1.5">Judul</label>
                  <input id="page-title" type="text" value={editPageTitle} onChange={e => setEditPageTitle(e.target.value)} maxLength={80} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="page-subtitle" className="block text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1.5">Subjudul</label>
                  <textarea id="page-subtitle" value={editPageSubtitle} onChange={e => setEditPageSubtitle(e.target.value)} maxLength={160} rows={2} className={`${inputClass} resize-none`} />
                </div>
              </div>

              {/* Pratinjau */}
              <div className="mt-4 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white p-4">
                <p className="text-[11px] font-semibold text-white/70 mb-1">Pratinjau</p>
                <p className="text-lg font-bold leading-tight">{editPageTitle || 'Judul halaman'}</p>
                <p className="text-sm text-white/85 mt-0.5">{editPageSubtitle || 'Subjudul halaman'}</p>
              </div>

              <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2">
                <button type="button" onClick={() => setIsEditingHeader(false)} className="flex-1 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold border-none cursor-pointer">Batal</button>
                <button type="button" onClick={handleSaveHeader} disabled={!editPageTitle.trim()} className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer disabled:opacity-50">Simpan</button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </main>
  )
}
