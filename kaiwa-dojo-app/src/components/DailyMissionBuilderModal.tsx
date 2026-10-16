import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import {
  type DailyMissionData,
  type SelectedVideoItem,
  getTodayDateString,
  isNoPlanMission,
} from '../lib/dailyMission'
import CustomAlertModal, { type AlertModalConfig } from './CustomAlertModal'
import { fetchGroups, type KaiwaGroup, GROUP_UPDATE_EVENT } from '../lib/groupService'
import {
  getChapterSettingsMap,
  DEFAULT_JILID_1,
  DEFAULT_JILID_2,
  isChapterAccessibleForUser,
  type ChapterSetting,
} from '../lib/chapterService'

export interface DailyMissionBuilderModalProps {
  targetDate: string
  currentMission: DailyMissionData | null
  onSave: (data: Omit<DailyMissionData, 'date'>, dateStr: string) => Promise<void> | void
  onClose: () => void
  /** Tanggal yang sudah memiliki rencana — untuk peringatan saat user memindah tanggal */
  plannedDates?: Set<string>
}

const MAX_QUIZ = 50
const MAX_KOTOBA = 100

function formatLongDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function Stepper({
  label,
  unit,
  value,
  max,
  onChange,
}: {
  label: string
  unit: string
  value: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-800 dark:text-white">{label}</span>
        <span className="text-xs text-slate-400">Maks. {max}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value <= 0}
          aria-label={`Kurangi ${label}`}
          className="size-11 shrink-0 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xl font-bold cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
        >
          −
        </button>
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={value === 0 ? '' : value}
            placeholder="0"
            aria-label={label}
            onChange={e => {
              const clean = e.target.value.replace(/\D/g, '')
              const n = clean === '' ? 0 : parseInt(clean, 10)
              onChange(Number.isNaN(n) ? 0 : Math.max(0, Math.min(max, n)))
            }}
            className="w-full h-11 pl-3 pr-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center text-base font-bold text-slate-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{unit}</span>
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Tambah ${label}`}
          className="size-11 shrink-0 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xl font-bold cursor-pointer transition-colors hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  )
}

export default function DailyMissionBuilderModal({
  targetDate,
  currentMission,
  onSave,
  onClose,
  plannedDates,
}: DailyMissionBuilderModalProps) {
  const { profile } = useAuth()
  const { t } = useLanguage()
  const isStudent = profile?.role === 'pelajar' || !profile?.role
  const todayStr = getTodayDateString()

  const [missionDate, setMissionDate] = useState<string>(targetDate < todayStr ? todayStr : targetDate)
  const [chapterSettingsMap, setChapterSettingsMap] = useState<{ [key: number]: ChapterSetting }>({})
  const [groups, setGroups] = useState<KaiwaGroup[]>([])
  const [isSaving, setIsSaving] = useState<boolean>(false)

  useEffect(() => {
    getChapterSettingsMap().then((map: Record<number, ChapterSetting>) => setChapterSettingsMap(map))
    fetchGroups(true).then(setGroups)
    const handleUpdate = () => {
      getChapterSettingsMap().then((map: Record<number, ChapterSetting>) => setChapterSettingsMap(map))
      fetchGroups(true).then(setGroups)
    }
    window.addEventListener('kaiwa_chapter_updated', handleUpdate)
    window.addEventListener(GROUP_UPDATE_EVENT, handleUpdate)
    return () => {
      window.removeEventListener('kaiwa_chapter_updated', handleUpdate)
      window.removeEventListener(GROUP_UPDATE_EVENT, handleUpdate)
    }
  }, [])

  // Semua bab 1 s/d 50 yang dapat diakses pengguna
  const availableBabs = Array.from({ length: 50 }, (_, i) => i + 1).filter(b => {
    if (!isStudent) return true
    const setting = chapterSettingsMap[b]
    if (setting) {
      if (setting.is_hidden) return false
      return isChapterAccessibleForUser(setting, profile, groups)
    }
    return b <= 2
  })

  const [selectedBab, setSelectedBab] = useState<number>(() => currentMission?.selectedVideos?.[0]?.bab || 1)
  const [dayType, setDayType] = useState<'study' | 'rest'>(isNoPlanMission(currentMission) ? 'rest' : 'study')
  const [selectedVideos, setSelectedVideos] = useState<SelectedVideoItem[]>(currentMission?.selectedVideos || [])
  const [targetQuiz, setTargetQuiz] = useState<number>(currentMission?.targetQuizCount ?? 0)
  const [targetKotoba, setTargetKotoba] = useState<number>(currentMission?.targetKotobaCount ?? 0)

  // Sinkronisasi state internal saat props berubah
  useEffect(() => {
    setMissionDate(targetDate < todayStr ? todayStr : targetDate)
    const initBab = currentMission?.selectedVideos?.[0]?.bab
    if (initBab) setSelectedBab(initBab)
    setSelectedVideos(currentMission?.selectedVideos || [])
    setTargetQuiz(currentMission?.targetQuizCount ?? 0)
    setTargetKotoba(currentMission?.targetKotobaCount ?? 0)
    setDayType(isNoPlanMission(currentMission) ? 'rest' : 'study')
  }, [targetDate, currentMission])

  // Pastikan bab terpilih termasuk yang boleh diakses (setelah pengaturan bab termuat)
  const availableBabsKey = availableBabs.join(',')
  useEffect(() => {
    if (availableBabs.length > 0 && !availableBabs.includes(selectedBab)) {
      setSelectedBab(availableBabs[0])
    }
  }, [availableBabsKey])

  // Tutup dengan Escape & kunci scroll halaman
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isSaving) onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [isSaving, onClose])

  const currentJilid: 1 | 2 = (selectedBab <= 25 ? 1 : 2) as 1 | 2
  const currentBabVideos: SelectedVideoItem[] = [1, 2, 3].map(vNum => ({
    id: `bab_${selectedBab}_video_${vNum}`,
    title: `Bab ${selectedBab} - Part ${vNum}`,
    jilid: currentJilid,
    bab: selectedBab,
    videoNum: vNum,
  }))

  const isRest = dayType === 'rest'
  const finalVideos = isRest ? [] : selectedVideos
  const finalQuiz = isRest ? 0 : targetQuiz
  const finalKotoba = isRest ? 0 : targetKotoba
  const totalReplayTarget = finalVideos.length * 3
  const hasAnyTarget = finalVideos.length > 0 || finalQuiz > 0 || finalKotoba > 0
  const canSave = isRest || hasAnyTarget
  const willOverwrite = missionDate !== targetDate && Boolean(plannedDates?.has(missionDate))

  function toggleVideoSelection(vItem: SelectedVideoItem) {
    setSelectedVideos(prev => prev.some(v => v.id === vItem.id) ? prev.filter(v => v.id !== vItem.id) : [...prev, vItem])
  }

  const [alertConfig, setAlertConfig] = useState<AlertModalConfig>({
    isOpen: false,
    title: '',
    message: '',
    type: 'warning',
    buttonText: 'Mengerti',
    onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (isSaving || !canSave) return

    setIsSaving(true)
    try {
      await onSave({
        selectedVideos: finalVideos,
        targetReplayCount: totalReplayTarget,
        targetQuizCount: finalQuiz,
        targetKotobaCount: finalKotoba,
        baseline: currentMission?.baseline,
      }, missionDate)
    } catch (err: any) {
      console.error('Failed to save mission:', err)
      setAlertConfig({
        isOpen: true,
        title: 'Gagal Menyimpan Rencana',
        message: err?.message || 'Terjadi kesalahan saat menyimpan data ke database. Silakan coba lagi.',
        type: 'warning',
        buttonText: 'Mengerti',
        onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const jilid1Babs = availableBabs.filter(b => b <= 25)
  const jilid2Babs = availableBabs.filter(b => b >= 26)
  const babLabel = (b: number) => {
    const titleText = chapterSettingsMap[b]?.title || (b <= 25 ? DEFAULT_JILID_1[b] : DEFAULT_JILID_2[b])?.title || `Bab ${b}`
    return `Bab ${b}: ${titleText.replace(/^Bab\s+\d+:\s*/i, '')}`
  }

  const summaryParts = [
    finalVideos.length > 0 && `${finalVideos.length} video (${totalReplayTarget}x putar)`,
    finalQuiz > 0 && `${finalQuiz} kuis`,
    finalKotoba > 0 && `${finalKotoba} kotoba`,
  ].filter(Boolean) as string[]

  return (
    <div
      className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in"
      onClick={() => { if (!isSaving) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-builder-title"
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92dvh] overflow-hidden animate-fade-in-up"
      >
        {/* Header */}
        <div className="shrink-0 px-5 pt-3 sm:pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="sm:hidden mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary dark:text-red-400">
                {currentMission ? 'Edit Rencana Belajar' : 'Susun Rencana Belajar'}
              </p>
              <h3 id="mission-builder-title" className="text-lg font-bold text-slate-900 dark:text-white leading-tight">
                {formatLongDate(missionDate)}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              aria-label="Tutup"
              className="size-10 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5 overscroll-contain">

            {/* Tanggal */}
            <section>
              <label htmlFor="mission-date" className="block text-sm font-bold text-slate-800 dark:text-white mb-2">Tanggal</label>
              <input
                id="mission-date"
                type="date"
                value={missionDate}
                min={todayStr}
                onChange={e => e.target.value && setMissionDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-base sm:text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 cursor-pointer"
              />
              {willOverwrite && (
                <p className="mt-2 text-[13px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl px-3 py-2">
                  Tanggal ini sudah punya rencana. Menyimpan akan menggantinya.
                </p>
              )}
            </section>

            {/* Jenis hari */}
            <section>
              <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Jenis hari</h4>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { key: 'study', title: 'Hari Belajar', desc: 'Atur target video, kuis & kotoba' },
                  { key: 'rest', title: 'Hari Istirahat', desc: 'Tanpa target · Cap Biru' },
                ] as const).map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setDayType(opt.key)}
                    aria-pressed={dayType === opt.key}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      dayType === opt.key
                        ? 'border-primary bg-primary/5 dark:bg-primary/15 ring-2 ring-primary/15'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">{opt.title}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </section>

            {isRest ? (
              <div className="p-4 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 flex items-center gap-3">
                <img src="/tidakada.png" alt="" className="size-12 object-contain shrink-0 -rotate-6" />
                <p className="text-sm text-sky-900 dark:text-sky-200 leading-relaxed">
                  Istirahat terencana tetap dihitung disiplin. Tanggal ini akan mendapat <strong>Cap Biru</strong>.
                </p>
              </div>
            ) : (
              <>
                {/* Video materi */}
                <section className="flex flex-col gap-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">{t('lp_step1_video', 'Video materi')}</h4>
                    <span className="text-xs text-slate-400">Opsional · tiap video 3x putar</span>
                  </div>
                  <select
                    value={selectedBab}
                    onChange={e => setSelectedBab(Number(e.target.value))}
                    aria-label="Pilih bab"
                    className="w-full h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-base sm:text-sm font-semibold text-slate-800 dark:text-white outline-none focus:border-primary cursor-pointer"
                  >
                    {jilid1Babs.length > 0 && (
                      <optgroup label="Jilid 1 (Bab 1 - 25)">
                        {jilid1Babs.map(b => <option key={b} value={b}>{babLabel(b)}</option>)}
                      </optgroup>
                    )}
                    {jilid2Babs.length > 0 && (
                      <optgroup label="Jilid 2 (Bab 26 - 50)">
                        {jilid2Babs.map(b => <option key={b} value={b}>{babLabel(b)}</option>)}
                      </optgroup>
                    )}
                  </select>

                  <div className="grid grid-cols-3 gap-2">
                    {currentBabVideos.map(vItem => {
                      const isSelected = selectedVideos.some(v => v.id === vItem.id)
                      return (
                        <button
                          key={vItem.id}
                          type="button"
                          onClick={() => toggleVideoSelection(vItem)}
                          aria-pressed={isSelected}
                          className={`h-14 rounded-xl border flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all active:scale-[0.98] ${
                            isSelected
                              ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-primary/50'
                          }`}
                        >
                          <span className="text-sm font-bold flex items-center gap-1">
                            {isSelected && (
                              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            Part {vItem.videoNum}
                          </span>
                          <span className={`text-[11px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>Bab {selectedBab}</span>
                        </button>
                      )
                    })}
                  </div>

                  {selectedVideos.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {selectedVideos.map(v => (
                        <span key={v.id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-300 text-xs font-semibold">
                          Bab {v.bab} · Part {v.videoNum}
                          <button
                            type="button"
                            onClick={() => toggleVideoSelection(v)}
                            aria-label={`Hapus Bab ${v.bab} Part ${v.videoNum}`}
                            className="size-5 rounded-full flex items-center justify-center hover:bg-primary hover:text-white border-none bg-transparent text-current cursor-pointer"
                          >
                            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        onClick={() => setSelectedVideos([])}
                        className="text-xs font-semibold text-slate-500 hover:text-red-600 bg-transparent border-none cursor-pointer px-2 py-1"
                      >
                        Hapus semua
                      </button>
                    </div>
                  )}
                </section>

                {/* Kuis & kotoba */}
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Stepper label="Target kuis" unit="kuis" value={targetQuiz} max={MAX_QUIZ} onChange={setTargetQuiz} />
                  <Stepper label="Target kotoba" unit="kata" value={targetKotoba} max={MAX_KOTOBA} onChange={setTargetKotoba} />
                </section>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col gap-2.5">
            <p className={`text-[13px] ${canSave ? 'text-slate-600 dark:text-slate-300' : 'text-amber-700 dark:text-amber-300'}`}>
              {isRest
                ? 'Hari istirahat — tanpa target.'
                : hasAnyTarget
                  ? <>Target: <strong className="text-slate-900 dark:text-white">{summaryParts.join(' · ')}</strong></>
                  : 'Pilih minimal satu target: video, kuis, atau kotoba.'}
            </p>
            <div className="grid grid-cols-[auto_1fr] gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="h-12 px-5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-bold border-none cursor-pointer transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSaving || !canSave}
                className="h-12 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer shadow-sm shadow-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving && <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {isSaving ? 'Menyimpan...' : currentMission ? 'Simpan Perubahan' : 'Simpan Rencana'}
              </button>
            </div>
          </div>
        </form>

        <CustomAlertModal {...alertConfig} />
      </div>
    </div>
  )
}
