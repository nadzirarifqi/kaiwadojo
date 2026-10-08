import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import {
  type DailyMissionData,
  type SelectedVideoItem,
  getTodayDateString,
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

export function formatDateIndonesian(dateStr: string, lang: string = 'id'): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const dateObj = new Date(y, m - 1, d)
  const locale = lang === 'ja' ? 'ja-JP' : lang === 'en' ? 'en-US' : 'id-ID'
  return dateObj.toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export interface DailyMissionBuilderModalProps {
  targetDate: string
  currentMission: DailyMissionData | null
  onSave: (data: Omit<DailyMissionData, 'date'>, dateStr: string) => Promise<void> | void
  onClose: () => void
}

export default function DailyMissionBuilderModal({
  targetDate,
  currentMission,
  onSave,
  onClose,
}: DailyMissionBuilderModalProps) {
  const { profile } = useAuth()
  const { language, t } = useLanguage()
  const isStudent = profile?.role === 'pelajar' || !profile?.role

  const [missionDate, setMissionDate]     = useState<string>(targetDate)
  const [selectedJilid, setSelectedJilid] = useState<1 | 2>(currentMission?.selectedVideos?.[0]?.jilid || 1)
  const [chapterSettingsMap, setChapterSettingsMap] = useState<{ [key: number]: ChapterSetting }>({})
  const [groups, setGroups]               = useState<KaiwaGroup[]>([])
  const [isSaving, setIsSaving]           = useState<boolean>(false)

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

  const startBab = selectedJilid === 1 ? 1 : 26
  const availableBabs = Array.from({ length: 25 }, (_, i) => startBab + i).filter(b => {
    if (!isStudent) return true
    const setting = chapterSettingsMap[b]
    if (setting) {
      if (setting.is_hidden) return false
      return isChapterAccessibleForUser(setting, profile, groups)
    }
    return b <= 2
  })

  const [selectedBab, setSelectedBab] = useState<number>(() => {
    const initBab = currentMission?.selectedVideos?.[0]?.bab || startBab
    return availableBabs.includes(initBab) ? initBab : (availableBabs[0] || startBab)
  })

  const [noVideoPlan, setNoVideoPlan] = useState<boolean>(
    currentMission ? currentMission.targetReplayCount === 0 : false
  )
  const [selectedVideos, setSelectedVideos] = useState<SelectedVideoItem[]>(
    currentMission?.selectedVideos || []
  )
  const [targetQuiz, setTargetQuiz]       = useState<number>(currentMission ? (currentMission.targetQuizCount ?? 0) : 0)
  const [targetKotoba, setTargetKotoba]   = useState<number>(currentMission ? (currentMission.targetKotobaCount ?? 0) : 0)

  // Sync internal modal state whenever targetDate or currentMission props change
  useEffect(() => {
    setMissionDate(targetDate)
    setSelectedJilid(currentMission?.selectedVideos?.[0]?.jilid || 1)
    setSelectedVideos(currentMission?.selectedVideos || [])
    setTargetQuiz(currentMission ? (currentMission.targetQuizCount ?? 0) : 0)
    setTargetKotoba(currentMission ? (currentMission.targetKotobaCount ?? 0) : 0)
    setNoVideoPlan(currentMission ? currentMission.targetReplayCount === 0 : false)
  }, [targetDate, currentMission])

  const currentBabSetting = chapterSettingsMap[selectedBab]
  const defaultInfo = selectedBab <= 25 ? DEFAULT_JILID_1[selectedBab] : DEFAULT_JILID_2[selectedBab]
  const rawBabTitle = currentBabSetting?.title || defaultInfo?.title || `Bab ${selectedBab}`
  const cleanBabTitle = rawBabTitle.replace(/^Bab\s+\d+:\s*/i, '')

  const currentBabVideos: SelectedVideoItem[] = [1, 2, 3].map(vNum => ({
    id: `bab_${selectedBab}_video_${vNum}`,
    title: `[Bab ${selectedBab}: ${cleanBabTitle}] Part ${vNum}`,
    jilid: selectedJilid,
    bab: selectedBab,
    videoNum: vNum,
  }))

  const totalReplayTarget = noVideoPlan ? 0 : selectedVideos.length * 3

  function toggleVideoSelection(vItem: SelectedVideoItem) {
    setSelectedVideos(prev => {
      const exists = prev.some(v => v.id === vItem.id)
      if (exists) return prev.filter(v => v.id !== vItem.id)
      return [...prev, vItem]
    })
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
    if (isSaving) return

    const finalVideos = noVideoPlan ? [] : selectedVideos
    if (!noVideoPlan && finalVideos.length === 0 && targetQuiz === 0 && targetKotoba === 0) {
      setAlertConfig({
        isOpen: true,
        title: 'Target Video Belum Dipilih',
        message: 'Silakan pilih minimal 1 video materi pada fitur "Target Misi Harian", atau centang opsi "Tidak Ada Rencana".',
        type: 'warning',
        buttonText: 'Pilih Video Materi',
        onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
      })
      return
    }

    setIsSaving(true)
    try {
      await onSave({
        selectedVideos: finalVideos,
        targetReplayCount: totalReplayTarget,
        targetQuizCount: targetQuiz,
        targetKotobaCount: targetKotoba,
        baseline: currentMission?.baseline,
      }, missionDate)
    } catch (err: any) {
      console.error('Failed to save mission:', err)
      setAlertConfig({
        isOpen: true,
        title: 'Gagal Menyimpan Misi',
        message: err?.message || 'Terjadi kesalahan saat menyimpan data ke database. Silakan coba lagi.',
        type: 'warning',
        buttonText: 'Mengerti',
        onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[999] overflow-y-auto animate-fade-in overscroll-contain">
      <div className="flex min-h-full items-start justify-center p-2.5 sm:p-6 pt-4 sm:pt-10 md:pt-12 pb-16 sm:pb-12">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[92dvh] sm:max-h-[88dvh] border border-slate-200 dark:border-slate-800">
        
        {/* Modal Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-r from-primary via-primary-dark to-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="size-9 sm:size-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <svg className="size-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="1" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm sm:text-lg font-black text-white">{currentMission ? 'Edit Target Misi Belajar' : t('lp_modal_title', 'Susun Misi Belajar Mandiri')}</h3>
              <p className="text-[0.65rem] sm:text-xs text-white/80 font-medium">KaiwaDoJo Personal Target Builder</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 sm:size-9 rounded-full bg-white/20 hover:bg-white/30 text-white border-none cursor-pointer flex items-center justify-center transition-colors touch-manipulation"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-3.5 sm:p-6 flex flex-col gap-3.5 sm:gap-5 overflow-y-auto flex-1 overscroll-contain">

            {/* Target Date Selector inside Modal */}
            <div className="bg-slate-50 dark:bg-slate-800 p-3 sm:p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[0.62rem] sm:text-[0.65rem] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-400 block">{t('lp_target_date', 'Target Tanggal Misi')}</span>
                <span className="text-xs sm:text-sm font-black text-slate-800 dark:text-white truncate block">{formatDateIndonesian(missionDate, language)}</span>
              </div>
              <input
                type="date"
                value={missionDate}
                min={getTodayDateString()}
                onChange={e => setMissionDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-base sm:text-xs font-bold bg-white dark:bg-slate-900 dark:text-white outline-none focus:border-primary cursor-pointer shrink-0 min-h-[38px] touch-manipulation"
              />
            </div>

            {/* Step 1: Pilih Video Spesifik / Tidak Ada Rencana */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
                  {t('lp_step1_video', '1. Target Video')}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-600 dark:text-slate-300 touch-manipulation select-none">
                  <input
                    type="checkbox"
                    checked={noVideoPlan}
                    onChange={e => {
                      setNoVideoPlan(e.target.checked)
                      if (e.target.checked) setSelectedVideos([])
                    }}
                    className="size-4 sm:size-4.5 accent-slate-700 cursor-pointer rounded"
                  />
                  <span>{t('sk_stamp_noplan', 'Tidak Ada Rencana')}</span>
                </label>
              </div>

              {noVideoPlan ? (
                <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                  <span>{t('lp_no_video_target', 'Hari ini tidak ada target nonton video (Cap Biru jika kuis & kotoba 0).')}</span>
                  <button
                    type="button"
                    onClick={() => setNoVideoPlan(false)}
                    className="text-xs text-primary dark:text-red-400 font-extrabold border-none bg-transparent cursor-pointer touch-manipulation flex items-center gap-1 hover:underline"
                  >
                    <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Tambah Target Video</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 mb-3">
                    <div>
                      <label className="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 block mb-1">Pilih Buku Jilid</label>
                      <select
                        value={selectedJilid}
                        onChange={e => {
                          const newJilid = Number(e.target.value) as 1 | 2
                          setSelectedJilid(newJilid)
                          const newStartBab = newJilid === 1 ? 1 : 26
                          const newAvail = Array.from({ length: 25 }, (_, i) => newStartBab + i).filter(b => {
                            if (!isStudent) return true
                            const setting = chapterSettingsMap[b]
                            if (setting) return !setting.is_hidden
                            return b <= 2
                          })
                          setSelectedBab(newAvail[0] || newStartBab)
                        }}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary min-h-[42px] touch-manipulation"
                      >
                        <option value={1}>{t('dash_jilid_1_title', 'Jilid 1 (Bab 1 - 25)')}</option>
                        <option value={2}>{t('dash_jilid_2_title', 'Jilid 2 (Bab 26 - 50)')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 block mb-1">Pilih Bab</label>
                      <select
                        value={selectedBab}
                        onChange={e => {
                          setSelectedBab(Number(e.target.value))
                        }}
                        className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-base sm:text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary min-h-[42px] touch-manipulation"
                      >
                        {availableBabs.length > 0 ? (
                          availableBabs.map(b => {
                            const setting = chapterSettingsMap[b]
                            const def = b <= 25 ? DEFAULT_JILID_1[b] : DEFAULT_JILID_2[b]
                            const titleText = setting?.title || def?.title || `Bab ${b}`
                            const cleanTitle = titleText.replace(/^Bab\s+\d+:\s*/i, '')
                            const isHidden = setting?.is_hidden

                            return (
                              <option key={b} value={b}>
                                Bab {b}: {cleanTitle} {isHidden ? '(Disembunyikan)' : ''}
                              </option>
                            )
                          })
                        ) : (
                          <option value="" disabled>Belum ada Bab dipublikasikan</option>
                        )}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mb-3">
                    {currentBabVideos.map(vItem => {
                      const isSelected = selectedVideos.some(v => v.id === vItem.id)
                      return (
                        <div
                          key={vItem.id}
                          onClick={() => toggleVideoSelection(vItem)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between touch-manipulation select-none active:scale-[0.99] ${
                            isSelected
                              ? 'bg-primary/10 border-primary dark:bg-primary/20 dark:border-red-500 text-primary dark:text-red-300 font-extrabold shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {isSelected ? (
                              <span className="size-6 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 shadow-2xs">
                                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </span>
                            ) : (
                              <span className="size-6 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0">
                                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </span>
                            )}
                            <span className="text-xs truncate">{vItem.title}</span>
                          </div>
                          <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 shrink-0">
                            3x Replays
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Ringkasan Video yang Dipilih (Selected Videos Summary Box) */}
                  {selectedVideos.length > 0 && (
                    <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-200">
                        <span className="flex items-center gap-1.5">
                          <svg className="size-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                          </svg>
                          <span>Daftar Video Terpilih ({selectedVideos.length} Video • {totalReplayTarget}x Target Replay)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedVideos([])}
                          className="text-[0.68rem] text-red-600 hover:text-red-700 dark:text-red-400 font-extrabold bg-transparent border-none cursor-pointer underline touch-manipulation"
                        >
                          Reset Semua
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                        {selectedVideos.map(v => (
                          <span
                            key={v.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-800 text-[0.7rem] font-bold text-slate-800 dark:text-slate-200 shadow-2xs"
                          >
                            <svg className="size-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            </svg>
                            <span>J{v.jilid}·Bab {v.bab} (P{v.videoNum})</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleVideoSelection(v)
                              }}
                              className="size-4.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-red-500 hover:text-white text-slate-600 dark:text-slate-300 text-[0.65rem] font-black flex items-center justify-center border-none cursor-pointer transition-colors touch-manipulation"
                              title="Hapus video ini"
                            >
                              <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Step 2 & 3: Target Kuis & Kotoba */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    {t('lp_step3_quiz', '2. Target Kuis Evaluasi')}
                  </label>
                  <span className="text-[0.65rem] text-slate-400 font-bold">Maks. 50</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTargetQuiz(q => Math.max(0, q - 1))}
                    className="size-11 sm:size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-slate-600 dark:text-slate-300 border-none cursor-pointer flex items-center justify-center shrink-0 transition-colors touch-manipulation text-lg sm:text-base active:scale-95"
                  >
                    −
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      enterKeyHint="done"
                      value={targetQuiz === 0 ? '' : targetQuiz}
                      placeholder="0"
                      onChange={e => {
                        const clean = e.target.value.replace(/\D/g, '')
                        const val = clean === '' ? 0 : parseInt(clean, 10)
                        if (isNaN(val)) setTargetQuiz(0)
                        else setTargetQuiz(Math.max(0, Math.min(50, val)))
                      }}
                      className="w-full text-center px-3 py-2 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-base sm:text-xs font-black outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[44px] sm:min-h-[38px]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.65rem] font-bold text-slate-400 pointer-events-none select-none">
                      Kuis
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTargetQuiz(q => Math.min(50, q + 1))}
                    className="size-11 sm:size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-slate-600 dark:text-slate-300 border-none cursor-pointer flex items-center justify-center shrink-0 transition-colors touch-manipulation text-lg sm:text-base active:scale-95"
                  >
                    +
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1 text-[0.65rem] flex-wrap gap-1">
                  <span className="text-slate-400 font-medium truncate">
                    {targetQuiz === 0 ? '0 Kuis (Tidak Ada Rencana)' : `Target: ${targetQuiz} Kuis`}
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 5, 10].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTargetQuiz(amt)}
                        className={`px-2 py-1 sm:px-1.5 sm:py-0.5 rounded-md text-[0.65rem] sm:text-[0.62rem] font-bold border cursor-pointer transition-all touch-manipulation active:scale-95 ${
                          targetQuiz === amt
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    {t('lp_step4_kotoba', '3. Target Setoran Kotoba')}
                  </label>
                  <span className="text-[0.65rem] text-slate-400 font-bold">Maks. 100</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTargetKotoba(k => Math.max(0, k - 1))}
                    className="size-11 sm:size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-slate-600 dark:text-slate-300 border-none cursor-pointer flex items-center justify-center shrink-0 transition-colors touch-manipulation text-lg sm:text-base active:scale-95"
                  >
                    −
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      enterKeyHint="done"
                      value={targetKotoba === 0 ? '' : targetKotoba}
                      placeholder="0"
                      onChange={e => {
                        const clean = e.target.value.replace(/\D/g, '')
                        const val = clean === '' ? 0 : parseInt(clean, 10)
                        if (isNaN(val)) setTargetKotoba(0)
                        else setTargetKotoba(Math.max(0, Math.min(100, val)))
                      }}
                      className="w-full text-center px-3 py-2 pr-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-base sm:text-xs font-black outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all min-h-[44px] sm:min-h-[38px]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[0.65rem] font-bold text-slate-400 pointer-events-none select-none">
                      Setoran
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTargetKotoba(k => Math.min(100, k + 1))}
                    className="size-11 sm:size-9 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-black text-slate-600 dark:text-slate-300 border-none cursor-pointer flex items-center justify-center shrink-0 transition-colors touch-manipulation text-lg sm:text-base active:scale-95"
                  >
                    +
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1 text-[0.65rem] flex-wrap gap-1">
                  <span className="text-slate-400 font-medium truncate">
                    {targetKotoba === 0 ? '0 Setoran (Tidak Ada Rencana)' : `Target: ${targetKotoba} Kotoba`}
                  </span>
                  <div className="flex items-center gap-1">
                    {[5, 10, 25, 50, 100].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTargetKotoba(amt)}
                        className={`px-2 py-1 sm:px-1.5 sm:py-0.5 rounded-md text-[0.65rem] sm:text-[0.62rem] font-bold border cursor-pointer transition-all touch-manipulation active:scale-95 ${
                          targetKotoba === amt
                            ? 'bg-amber-500 text-white border-amber-500'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Modal Action Footer */}
          <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 sm:py-2.5 rounded-lg sm:rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-[11px] sm:text-xs cursor-pointer touch-manipulation hover:bg-slate-100 min-h-[34px] sm:min-h-[38px]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 sm:py-2.5 bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white font-extrabold rounded-lg sm:rounded-xl border-none cursor-pointer text-[11px] sm:text-xs shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 touch-manipulation min-h-[34px] sm:min-h-[38px] active:scale-[0.99] group"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin size-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Menyimpan ke Database...</span>
                </>
              ) : (
                <>
                  <svg className="size-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{currentMission ? 'Simpan Perubahan Misi' : t('lp_save_mission', 'Simpan Misi Belajar')}</span>
                </>
              )}
            </button>
          </div>
        </form>
        <CustomAlertModal {...alertConfig} />
      </div>
      </div>
    </div>
  )
}
