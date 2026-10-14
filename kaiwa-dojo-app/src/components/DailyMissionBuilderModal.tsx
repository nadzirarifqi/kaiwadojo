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
  const { t } = useLanguage()
  const isStudent = profile?.role === 'pelajar' || !profile?.role

  const [missionDate, setMissionDate] = useState<string>(targetDate)
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

  const [selectedBab, setSelectedBab] = useState<number>(() => {
    const initBab = currentMission?.selectedVideos?.[0]?.bab || 1
    return availableBabs.includes(initBab) ? initBab : (availableBabs[0] || 1)
  })

  const [noVideoPlan, setNoVideoPlan] = useState<boolean>(
    currentMission ? currentMission.targetReplayCount === 0 : false
  )
  const [selectedVideos, setSelectedVideos] = useState<SelectedVideoItem[]>(
    currentMission?.selectedVideos || []
  )
  const [targetQuiz, setTargetQuiz] = useState<number>(currentMission ? (currentMission.targetQuizCount ?? 0) : 0)
  const [targetKotoba, setTargetKotoba] = useState<number>(currentMission ? (currentMission.targetKotobaCount ?? 0) : 0)

  // Sinkronisasi state internal saat props berubah
  useEffect(() => {
    setMissionDate(targetDate)
    const initBab = currentMission?.selectedVideos?.[0]?.bab
    if (initBab && availableBabs.includes(initBab)) {
      setSelectedBab(initBab)
    }
    setSelectedVideos(currentMission?.selectedVideos || [])
    setTargetQuiz(currentMission ? (currentMission.targetQuizCount ?? 0) : 0)
    setTargetKotoba(currentMission ? (currentMission.targetKotobaCount ?? 0) : 0)
    setNoVideoPlan(currentMission ? currentMission.targetReplayCount === 0 : false)
  }, [targetDate, currentMission])

  const currentJilid: 1 | 2 = (selectedBab <= 25 ? 1 : 2) as 1 | 2

  const currentBabVideos: SelectedVideoItem[] = [1, 2, 3].map(vNum => ({
    id: `bab_${selectedBab}_video_${vNum}`,
    title: `Bab ${selectedBab} - Part ${vNum}`,
    jilid: currentJilid,
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
        title: 'Target Belum Dipilih',
        message: 'Silakan pilih minimal 1 video materi, atau tentukan target kuis/kotoba, atau centang opsi "Tidak Ada Rencana".',
        type: 'warning',
        buttonText: 'Mengerti',
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

  // Pisahkan bab untuk optgroup yang rapi
  const jilid1Babs = availableBabs.filter(b => b <= 25)
  const jilid2Babs = availableBabs.filter(b => b >= 26)

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-[999] flex items-center justify-center p-3 sm:p-4 overflow-hidden animate-fade-in"
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800">
        
        {/* Header Modal */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 bg-gradient-to-r from-primary to-primary-dark text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white">
              {currentMission ? 'Edit Misi Harian' : 'Susun Misi Harian'}
            </h3>
            <p className="text-xs text-white/80">Pilih materi dan target belajarmu</p>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-full bg-white/20 hover:bg-white/30 text-white border-none cursor-pointer flex items-center justify-center transition-colors"
            title="Tutup"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body - Smooth Natural Scrolling */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto flex-1 touch-pan-y">

            {/* Pemilihan Tanggal - Bersih & Rapi tanpa Card Besar */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
              <span className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                Pilih Tanggal:
              </span>
              <input
                type="date"
                value={missionDate}
                min={getTodayDateString()}
                onChange={e => setMissionDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-primary cursor-pointer shrink-0 min-h-[36px]"
              />
            </div>

            {/* Bagian 1: Target Video Materi */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
                  {t('lp_step1_video', 'Pilih Video Materi')}
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 select-none">
                  <input
                    type="checkbox"
                    checked={noVideoPlan}
                    onChange={e => {
                      setNoVideoPlan(e.target.checked)
                      if (e.target.checked) setSelectedVideos([])
                    }}
                    className="size-4 accent-primary cursor-pointer rounded"
                  />
                  <span>Tidak Ada Rencana</span>
                </label>
              </div>

              {noVideoPlan ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>Hari ini tidak ada target video (Cap Biru jika kuis & kotoba 0).</span>
                  <button
                    type="button"
                    onClick={() => setNoVideoPlan(false)}
                    className="text-xs sm:text-sm text-primary hover:underline font-bold bg-transparent border-none cursor-pointer"
                  >
                    Tambah Video
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {/* Dropdown Bab Langsung tanpa Form Pilih Jilid */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                      Pilih Bab
                    </label>
                    <select
                      value={selectedBab}
                      onChange={e => setSelectedBab(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white outline-none focus:border-primary min-h-[40px] cursor-pointer"
                    >
                      {jilid1Babs.length > 0 && (
                        <optgroup label="Jilid 1 (Bab 1 - 25)">
                          {jilid1Babs.map(b => {
                            const setting = chapterSettingsMap[b]
                            const def = DEFAULT_JILID_1[b]
                            const titleText = setting?.title || def?.title || `Bab ${b}`
                            const cleanTitle = titleText.replace(/^Bab\s+\d+:\s*/i, '')
                            return (
                              <option key={b} value={b}>
                                Bab {b}: {cleanTitle}
                              </option>
                            )
                          })}
                        </optgroup>
                      )}
                      {jilid2Babs.length > 0 && (
                        <optgroup label="Jilid 2 (Bab 26 - 50)">
                          {jilid2Babs.map(b => {
                            const setting = chapterSettingsMap[b]
                            const def = DEFAULT_JILID_2[b]
                            const titleText = setting?.title || def?.title || `Bab ${b}`
                            const cleanTitle = titleText.replace(/^Bab\s+\d+:\s*/i, '')
                            return (
                              <option key={b} value={b}>
                                Bab {b}: {cleanTitle}
                              </option>
                            )
                          })}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  {/* Pilihan Video di Bab Terpilih */}
                  <div className="flex flex-col gap-1.5">
                    {currentBabVideos.map(vItem => {
                      const isSelected = selectedVideos.some(v => v.id === vItem.id)
                      return (
                        <div
                          key={vItem.id}
                          onClick={() => toggleVideoSelection(vItem)}
                          className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between select-none active:scale-[0.99] ${
                            isSelected
                              ? 'bg-primary/10 border-primary dark:bg-primary/20 text-primary dark:text-red-300 font-bold'
                              : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`size-5 rounded-md flex items-center justify-center shrink-0 text-xs ${
                              isSelected ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                            }`}>
                              {isSelected ? '✓' : ''}
                            </span>
                            <span className="text-xs sm:text-sm truncate">Bab {selectedBab} - Part {vItem.videoNum}</span>
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 shrink-0">
                            3x Putar
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Ringkasan Video Terpilih */}
                  {selectedVideos.length > 0 && (
                    <div className="p-2.5 sm:p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-amber-900 dark:text-amber-200">
                        <span>{selectedVideos.length} Video Terpilih ({totalReplayTarget}x Target Putar)</span>
                        <button
                          type="button"
                          onClick={() => setSelectedVideos([])}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline bg-transparent border-none cursor-pointer"
                        >
                          Reset
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                        {selectedVideos.map(v => (
                          <span
                            key={v.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 text-xs text-slate-700 dark:text-slate-300"
                          >
                            <span>Bab {v.bab} - Part {v.videoNum}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                toggleVideoSelection(v)
                              }}
                              className="size-3.5 rounded-full hover:bg-red-500 hover:text-white text-slate-400 flex items-center justify-center border-none cursor-pointer"
                              title="Hapus"
                            >
                              ✕
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bagian 2 & 3: Target Kuis & Setoran Kotoba (Tanpa Tombol Preset Angka) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
              
              {/* Stepper Target Kuis */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
                    2. Target Kuis
                  </label>
                  <span className="text-xs text-slate-400">Maks. 50</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetQuiz(q => Math.max(0, q - 1))}
                    className="size-9 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center shrink-0 transition-colors active:scale-95 text-base"
                    title="Kurangi"
                  >
                    −
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={targetQuiz === 0 ? '' : targetQuiz}
                      placeholder="0"
                      onChange={e => {
                        const clean = e.target.value.replace(/\D/g, '')
                        const val = clean === '' ? 0 : parseInt(clean, 10)
                        if (isNaN(val)) setTargetQuiz(0)
                        else setTargetQuiz(Math.max(0, Math.min(50, val)))
                      }}
                      className="w-full text-center px-3 py-1.5 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs sm:text-sm font-bold outline-none focus:border-primary min-h-[36px]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none select-none">
                      Kuis
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTargetQuiz(q => Math.min(50, q + 1))}
                    className="size-9 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center shrink-0 transition-colors active:scale-95 text-base"
                    title="Tambah"
                  >
                    +
                  </button>
                </div>
                <div className="text-xs text-slate-400">
                  {targetQuiz === 0 ? '0 Kuis (Tidak Ada Target)' : `Target: ${targetQuiz} Kuis`}
                </div>
              </div>

              {/* Stepper Target Setoran Kotoba */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white">
                    3. Target Kotoba
                  </label>
                  <span className="text-xs text-slate-400">Maks. 100</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetKotoba(k => Math.max(0, k - 1))}
                    className="size-9 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center shrink-0 transition-colors active:scale-95 text-base"
                    title="Kurangi"
                  >
                    −
                  </button>
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={targetKotoba === 0 ? '' : targetKotoba}
                      placeholder="0"
                      onChange={e => {
                        const clean = e.target.value.replace(/\D/g, '')
                        const val = clean === '' ? 0 : parseInt(clean, 10)
                        if (isNaN(val)) setTargetKotoba(0)
                        else setTargetKotoba(Math.max(0, Math.min(100, val)))
                      }}
                      className="w-full text-center px-3 py-1.5 pr-14 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-xs sm:text-sm font-bold outline-none focus:border-primary min-h-[36px]"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none select-none">
                      Kotoba
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTargetKotoba(k => Math.min(100, k + 1))}
                    className="size-9 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer flex items-center justify-center shrink-0 transition-colors active:scale-95 text-base"
                    title="Tambah"
                  >
                    +
                  </button>
                </div>
                <div className="text-xs text-slate-400">
                  {targetKotoba === 0 ? '0 Kotoba (Tidak Ada Target)' : `Target: ${targetKotoba} Kotoba`}
                </div>
              </div>

            </div>

          </div>

          {/* Footer - Tombol Simpan Rapi & Minimalis */}
          <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs sm:text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-primary hover:bg-primary-dark text-white font-bold rounded-xl border-none cursor-pointer text-xs sm:text-sm shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center active:scale-[0.98]"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>

        <CustomAlertModal {...alertConfig} />
      </div>
    </div>
  )
}
