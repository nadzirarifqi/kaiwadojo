import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import { ProfileSkeleton } from '../components/Skeleton'
import { normalizeGroup } from '../lib/studentService'
import { getDailyMission, isNoPlanMission } from '../lib/dailyMission'
import { sanitizeInput } from '../lib/securityUtils'

/* ── Avatar Presets (Dojo & Japanese Aesthetic) ────────── */
const AVATAR_PRESETS = [
  { id: 'ninja', label: 'Ninja', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80' },
  { id: 'samurai', label: 'Samurai', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80' },
  { id: 'sakura', label: 'Sakura', url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=150&auto=format&fit=crop&q=80' },
  { id: 'kitsune', label: 'Kitsune', url: 'https://images.unsplash.com/photo-1516934024742-b461fba47600?w=150&auto=format&fit=crop&q=80' },
  { id: 'torii', label: 'Torii', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=150&auto=format&fit=crop&q=80' },
  { id: 'matcha', label: 'Matcha', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=150&auto=format&fit=crop&q=80' },
]

interface CourseEnrollmentItem {
  id: string
  course_id: string
  progress_pct: number
  enrolled_at: string
  completed_at: string | null
  course: {
    id: string
    title: string
    category: string | null
    level: string
    thumbnail_url: string | null
    total_lessons: number
    instructor_id: string
  }
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, refreshProfile } = useAuth()
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const isFreezeToday = isNoPlanMission(getDailyMission(profile?.id || user?.id || ''))

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'achievements' | 'stats'>('overview')

  // Form State
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [institution, setInstitution] = useState('')
  const [domisili, setDomisili] = useState('')
  const [kelurahan, setKelurahan] = useState('')
  const [kecamatan, setKecamatan] = useState('')
  const [kabupaten, setKabupaten] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Modal State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false)

  // UI state
  const [isSaving, setIsSaving] = useState(false)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Database Stats State
  const [enrollments, setEnrollments] = useState<CourseEnrollmentItem[]>([])
  const [stats, setStats] = useState({
    completedLessons: 0,
    totalWatchDurationMinutes: 0,
    totalReplays: 0,
    quizAttempts: 0,
    quizPassed: 0,
    averageQuizScore: 0,
    enrolledCoursesCount: 0,
    completedCoursesCount: 0,
  })
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [courseFilter, setCourseFilter] = useState<'all' | 'in_progress' | 'completed'>('all')

  // Populate form from profile context
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setUsername(profile.username || '')
      setInstitution(profile.institution || '')
      setDomisili(profile.domisili || '')
      setKelurahan(profile.kelurahan || '')
      setKecamatan(profile.kecamatan || '')
      setKabupaten(profile.kabupaten || '')
      setBio(profile.bio || '')
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

  const activeUserId = user?.id || profile?.id

  // Fetch full data from database tables (profiles, enrollments, lesson_progress, quiz_attempts)
  useEffect(() => {
    if (!activeUserId) return

    async function loadDatabaseData() {
      if (!activeUserId) return
      setIsLoadingData(true)

      try {
        // 1. Fetch Enrollments with Course Details
        const { data: enrollData } = await supabase
          .from('enrollments')
          .select(`
            id,
            course_id,
            progress_pct,
            enrolled_at,
            completed_at,
            course:courses (
              id,
              title,
              category,
              level,
              thumbnail_url,
              total_lessons,
              instructor_id
            )
          `)
          .eq('student_id', activeUserId)
          .order('enrolled_at', { ascending: false })

        const formattedEnrollments = (enrollData || []).map((e: any) => ({
          ...e,
          progress_pct: Number(e.progress_pct) || 0,
          course: Array.isArray(e.course) ? e.course[0] : e.course,
        })) as CourseEnrollmentItem[]

        setEnrollments(formattedEnrollments)

        const completedCourses = formattedEnrollments.filter(e => e.completed_at || e.progress_pct >= 100).length

        // 2. Fetch Lesson Progress stats
        const { data: progressData } = await supabase
          .from('lesson_progress')
          .select('is_completed, watch_duration_seconds, replay_count')
          .eq('student_id', activeUserId)

        let completedLessonsCount = 0
        let totalSecs = 0
        let replays = 0

        if (progressData) {
          progressData.forEach((p: any) => {
            if (p.is_completed) completedLessonsCount++
            totalSecs += p.watch_duration_seconds || 0
            replays += p.replay_count || 0
          })
        }

        // 3. Fetch Quiz Attempts stats
        const { data: quizData } = await supabase
          .from('quiz_attempts')
          .select('score, passed')
          .eq('student_id', activeUserId)

        let attempts = 0
        let passed = 0
        let totalScore = 0

        if (quizData) {
          attempts = quizData.length
          quizData.forEach((q: any) => {
            if (q.passed) passed++
            totalScore += q.score || 0
          })
        }

        setStats({
          completedLessons: completedLessonsCount,
          totalWatchDurationMinutes: Math.round(totalSecs / 60),
          totalReplays: replays,
          quizAttempts: attempts,
          quizPassed: passed,
          averageQuizScore: attempts > 0 ? Math.round(totalScore / attempts) : 0,
          enrolledCoursesCount: formattedEnrollments.length,
          completedCoursesCount: completedCourses,
        })
      } catch (err) {
        console.error('Gagal memuat data statistik profil dari database:', err)
      } finally {
        setIsLoadingData(false)
      }
    }

    loadDatabaseData()
  }, [activeUserId])

  // Toast notification timer
  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text })
    setTimeout(() => setToastMessage(null), 4000)
  }

  // Handle Image File Selection from modal
  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Limit size to 5MB
    if (file.size > 5 * 1024 * 1024) {
      showToast('error', 'Ukuran foto maksimal 5MB')
      return
    }

    setSelectedFile(file)
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      setPreviewUrl(result)
      setAvatarUrl(result)
      setIsAvatarModalOpen(false) // Close modal after file choice
      showToast('success', 'Foto terpilih! Klik Simpan Perubahan untuk memperbarui permanen.')
    }
    reader.readAsDataURL(file)
  }

  // Handle Save Profile updates
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    const targetUserId = profile?.id || user?.id
    if (!targetUserId) {
      showToast('error', 'Sesi pengguna tidak valid. Silakan login kembali.')
      return
    }

    setIsSaving(true)
    let finalAvatarUrl = avatarUrl

    try {
      // 1. If a new local image file was picked, attempt Rumahweb server PHP upload first, then Supabase Storage fallback
      if (selectedFile) {
        let uploadedUrl: string | null = null

        // Attempt PHP upload script on Rumahweb server
        try {
          const formData = new FormData()
          formData.append('avatar', selectedFile)
          const phpRes = await fetch('/upload_avatar.php', {
            method: 'POST',
            body: formData,
          })
          if (phpRes.ok) {
            const json = await phpRes.json()
            if (json.success && json.url) {
              uploadedUrl = json.url
            }
          }
        } catch (phpErr) {
          console.warn('Rumahweb upload note, fallback to Supabase Storage:', phpErr)
        }

        // If Rumahweb PHP upload was not executed or failed, attempt Supabase Storage
        if (!uploadedUrl) {
          const fileExt = selectedFile.name.split('.').pop()
          const fileName = `${targetUserId}-${Date.now()}.${fileExt}`

          const { error: uploadErr } = await supabase.storage
            .from('avatars')
            .upload(fileName, selectedFile, { upsert: true })

          if (!uploadErr) {
            const { data: publicUrlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName)

            if (publicUrlData?.publicUrl) {
              uploadedUrl = publicUrlData.publicUrl
            }
          } else {
            console.warn('Supabase Storage upload error, using Data URL fallback:', uploadErr)
          }
        }

        if (uploadedUrl) {
          finalAvatarUrl = uploadedUrl
        } else if (previewUrl) {
          finalAvatarUrl = previewUrl
        }
      }

      // 2. Save directly to Supabase DB profiles table
      const cleanFullName = sanitizeInput(fullName, 100)
      const cleanInstitution = sanitizeInput(institution, 150)
      const cleanDomisili = sanitizeInput(domisili, 255)
      const cleanKelurahan = sanitizeInput(kelurahan, 100)
      const cleanKecamatan = sanitizeInput(kecamatan, 100)
      const cleanKabupaten = sanitizeInput(kabupaten, 100)
      const cleanBio = sanitizeInput(bio, 500)
      const cleanAvatar = sanitizeInput(finalAvatarUrl, 500)

      const updateData = {
        full_name: cleanFullName,
        institution: cleanInstitution,
        group_name: normalizeGroup(cleanInstitution),
        domisili: cleanDomisili || null,
        kelurahan: cleanKelurahan || null,
        kecamatan: cleanKecamatan || null,
        kabupaten: cleanKabupaten || null,
        bio: cleanBio,
        avatar_url: cleanAvatar || null,
        updated_at: new Date().toISOString(),
      }

      const { error: profileErr } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', targetUserId)

      if (profileErr) {
        console.warn('Profile update warning, attempting upsert:', profileErr)
        const { error: upsertErr } = await supabase.from('profiles').upsert({
          id: targetUserId,
          full_name: cleanFullName,
          username: (profile?.username || username).trim(),
          institution: cleanInstitution,
          group_name: normalizeGroup(cleanInstitution),
          domisili: cleanDomisili || null,
          kelurahan: cleanKelurahan || null,
          kecamatan: cleanKecamatan || null,
          kabupaten: cleanKabupaten || null,
          bio: cleanBio,
          avatar_url: cleanAvatar || null,
          role: profile?.role || (targetUserId === '00000000-0000-0000-0000-000000000099' ? 'admin' : 'pelajar'),
          status: profile?.status || 'approved',
          updated_at: new Date().toISOString(),
        })
        if (upsertErr) throw upsertErr
      }

      // 3. Immediately update active session profile in sessionStorage & localStorage for real-time UI refresh
      const updatedProfileObj = {
        ...profile,
        id: targetUserId,
        full_name: cleanFullName,
        username: (profile?.username || username).trim(),
        institution: cleanInstitution,
        group_name: normalizeGroup(cleanInstitution),
        domisili: cleanDomisili || null,
        kelurahan: cleanKelurahan || null,
        kecamatan: cleanKecamatan || null,
        kabupaten: cleanKabupaten || null,
        bio: cleanBio,
        avatar_url: cleanAvatar || null,
        role: profile?.role || (targetUserId === '00000000-0000-0000-0000-000000000099' ? 'admin' : 'pelajar'),
        updated_at: new Date().toISOString(),
      }

      sessionStorage.setItem('kaiwa_custom_profile', JSON.stringify(updatedProfileObj))
      localStorage.removeItem('kaiwa_custom_profile')
      window.dispatchEvent(new Event('kaiwa_profile_updated'))

      await refreshProfile()
      setSelectedFile(null)
      setPreviewUrl(null)
      showToast('success', 'Profil Anda berhasil diperbarui!')
    } catch (err: any) {
      console.error('Gagal memperbarui profil:', err)
      showToast('error', err.message || 'Gagal menyimpan perubahan profil.')
    } finally {
      setIsSaving(false)
    }
  }

  // Filtered Enrolled Courses
  const filteredCourses = enrollments.filter(item => {
    if (courseFilter === 'completed') return item.completed_at || item.progress_pct >= 100
    if (courseFilter === 'in_progress') return !item.completed_at && item.progress_pct < 100
    return true
  })

  // Dynamic Badges List based on user stats & profile
  const badges = [
    {
      id: 'welcome',
      title: 'Murid Baru',
      description: 'Bergabung dengan kaiwadojo',
      unlocked: true,
      icon: (
        <svg className="size-7 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      id: 'streak7',
      title: 'Bunga Sakura Mekar',
      description: 'Menjaga streak sakura 7 hari berturut-turut',
      unlocked: (profile?.streak_days || 0) >= 7,
      progress: `${Math.min(profile?.streak_days || 0, 7)}/7 Hari`,
      icon: (
        <svg className="size-7 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3c-1.5 2-2 4-1 6 2-1 4-1 5 1 1-2 3-2 5-1-1-2-2-4-4-5-2 1-4 1-5-1zm-4 6c-2 1-4 1-5-1 1 2 2 4 4 5 2-1 4-1 5 1-1-2-1-4-2-5-1 0-2 0-2 0zm10 7c2-1 4-1 5 1-1-2-2-4-4-5-2 1-4 1-5-1 1 2 1 4 2 5 1 0 2 0 2 0zm-8 4c1 2 2 4 4 5 2-1 4-1 5 1 1-2 2-4 1-6-2 1-4 1-5-1-1 0-2 0-2 1z" />
        </svg>
      ),
    },
    {
      id: 'streak30',
      title: 'Taman Sakura Rimbun',
      description: 'Menjaga streak sakura 30 hari berturut-turut',
      unlocked: (profile?.streak_days || 0) >= 30,
      progress: `${Math.min(profile?.streak_days || 0, 30)}/30 Hari`,
      icon: (
        <svg className="size-7 text-rose-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ),
    },
    {
      id: 'course_complete',
      title: 'Lulusan Pertama',
      description: 'Menyelesaikan setidaknya 1 kursus penuh',
      unlocked: stats.completedCoursesCount > 0,
      progress: `${stats.completedCoursesCount}/1 Kursus`,
      icon: (
        <svg className="size-7 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
        </svg>
      ),
    },
    {
      id: 'quiz_master',
      title: 'Spesialis Kuis',
      description: 'Lulus setidaknya 5 kuis bahasa Jepang',
      unlocked: stats.quizPassed >= 5,
      progress: `${stats.quizPassed}/5 Kuis`,
      icon: (
        <svg className="size-7 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'watch_time',
      title: 'Pembelajar Tekun',
      description: 'Menonton materi lebih dari 120 menit',
      unlocked: stats.totalWatchDurationMinutes >= 120,
      progress: `${stats.totalWatchDurationMinutes}/120 Menit`,
      icon: (
        <svg className="size-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      id: 'replay_king',
      title: 'Master Replay',
      description: 'Melakukan pengulangan materi >10 kali',
      unlocked: stats.totalReplays >= 10,
      progress: `${stats.totalReplays}/10 Replay`,
      icon: (
        <svg className="size-7 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
    },
  ]

  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '??'

  const formattedJoinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Agustus 2024'

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full animate-page-slide">
      {/* Toast Popup */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border text-sm font-bold animate-slide-fade ${
          toastMessage.type === 'success'
            ? 'bg-emerald-500 text-white border-emerald-600'
            : 'bg-red-500 text-white border-red-600'
        }`}>
          {toastMessage.type === 'success' ? (
            <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Hidden File Input for Image Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
      />

      {/* ── MODAL UPLOAD / PILIH AVATAR ─────────────────────── */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-6 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <svg className="size-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Ganti Foto Profil</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Unggah foto sendiri atau pilih rekomendasi avatar Dojo</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="size-9 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 font-extrabold flex items-center justify-center border-none cursor-pointer text-base"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* OPSI 1: Unggah Foto Komputer/HP */}
            <div className="space-y-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Opsi 1: Unggah dari Komputer / HP
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-5 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group"
              >
                <div className="size-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                </div>
                <span className="text-sm font-extrabold text-primary dark:text-red-400">Pilih File Foto Profil</span>
                <span className="text-xs text-slate-400">Mendukung format JPG, PNG, atau WebP (Maks 5MB)</span>
              </button>
            </div>

            {/* OPSI 2: Rekomendasi Avatar Dojo */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-400">
                Opsi 2: Rekomendasi Avatar Dojo
              </label>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      setPreviewUrl(null)
                      setAvatarUrl(preset.url)
                      setIsAvatarModalOpen(false)
                      showToast('success', `Avatar ${preset.label} dipilih!`)
                    }}
                    className={`p-2.5 rounded-2xl border-2 transition-all flex flex-col items-center gap-1.5 cursor-pointer ${
                      avatarUrl === preset.url
                        ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700'
                    }`}
                  >
                    <img src={preset.url} alt={preset.label} className="size-12 rounded-xl object-cover" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-full">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer border-none"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoadingData ? (
        <ProfileSkeleton />
      ) : (
        <>
          {/* ── HERO BANNER & PROFILE HEADER ──────────────────────── */}
      <section className="relative rounded-3xl bg-gradient-to-r from-primary-dark via-primary to-primary-light text-white p-6 sm:p-8 md:p-10 shadow-lg overflow-hidden mb-8 border border-red-950/20">
        {/* Japanese Decorative Overlay pattern */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 size-80 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-10 size-60 rounded-full bg-orange-500/10 blur-xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8">
          {/* Avatar Container */}
          <div className="relative group shrink-0">
            <div className="size-28 sm:size-32 rounded-3xl bg-white/10 backdrop-blur-md border-4 border-white/20 p-1 shadow-2xl overflow-hidden flex items-center justify-center">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName || 'Avatar'}
                  className="size-full object-cover rounded-2xl"
                  onError={() => setAvatarUrl('')}
                />
              ) : (
                <div className="size-full rounded-2xl bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-3xl font-black text-white">
                  {userInitials}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              className="absolute -bottom-2 -right-2 bg-white text-primary text-xs font-bold px-3 py-1.5 rounded-full shadow-lg hover:bg-slate-100 hover:scale-105 transition-all border border-slate-200 cursor-pointer flex items-center gap-1.5"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Ganti Foto</span>
            </button>
          </div>

          {/* User Text Information */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                {profile?.full_name || 'Pengguna kaiwadojo'}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase bg-white/20 border border-white/30 text-white backdrop-blur-md shadow-sm flex items-center gap-1.5">
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5" />
                </svg>
                <span>Pelajar Kaiwa</span>
              </span>
            </div>

            <p className="text-red-100/90 text-sm font-medium mb-3">
              @{profile?.username || 'username'} • <span className="opacity-80">{user?.email}</span>
            </p>

            {profile?.bio && (
              <p className="text-white/90 text-sm sm:text-base font-normal max-w-2xl leading-relaxed italic bg-black/10 backdrop-blur-xs p-3 rounded-2xl border border-white/10 mb-4">
                "{profile.bio}"
              </p>
            )}

            {/* Quick Stats Badges Bar */}
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-3 pt-1">
              <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold ${
                isFreezeToday
                  ? 'bg-sky-500/20 backdrop-blur-md border-sky-400/40 text-sky-200 shadow-xs'
                  : 'bg-rose-500/20 backdrop-blur-md border-rose-300/30 text-rose-100 shadow-xs'
              }`}>
                <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
                  {isFreezeToday ? (
                    <path d="M12 2v20m-10-10h20m-17-7l14 14m0-14L5 19" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  ) : (
                    <path d="M12 3c-1.5 2-2 4-1 6 2-1 4-1 5 1 1-2 3-2 5-1-1-2-2-4-4-5-2 1-4 1-5-1zm-4 6c-2 1-4 1-5-1 1 2 2 4 4 5 2-1 4-1 5 1-1-2-1-4-2-5-1 0-2 0-2 0zm10 7c2-1 4-1 5 1-1-2-2-4-4-5-2 1-4 1-5-1 1 2 1 4 2 5 1 0 2 0 2 0zm-8 4c1 2 2 4 4 5 2-1 4-1 5 1 1-2 2-4 1-6-2 1-4 1-5-1-1 0-2 0-2 1z" />
                  )}
                </svg>
                <span>{profile?.streak_days || 0} Hari Sakura {isFreezeToday ? '(Freeze)' : ''}</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-xs font-bold">
                <svg className="size-3.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>{stats.enrolledCoursesCount} Kursus Terdaftar</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-xs font-bold">
                <svg className="size-3.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Bergabung {formattedJoinDate}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── NAVIGATION TABS ─────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 mb-8 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-3 rounded-t-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === 'overview'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800'
          }`}
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>{t('pf_tab_overview', 'Ringkasan & Edit Profil')}</span>
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-4 py-3 rounded-t-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === 'courses'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800'
          }`}
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>{t('pf_tab_courses', 'Kursus Saya')} ({stats.enrolledCoursesCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('achievements')}
          className={`flex items-center gap-2 px-4 py-3 rounded-t-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === 'achievements'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800'
          }`}
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
          </svg>
          <span>{t('pf_tab_achievements', 'Pencapaian & Lencana')}</span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-4 py-3 rounded-t-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === 'stats'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-slate-800'
          }`}
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span>{t('pf_tab_stats', 'Statistik & Aktivitas')}</span>
        </button>
      </div>

      {/* ── TAB CONTENT 1: OVERVIEW & EDIT ───────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Edit Form */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
              <svg className="size-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Edit Data Profil</span>
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    {t('pf_input_fullname', 'Nama Lengkap')}
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder={t('pf_input_fullname_ph', 'Masukkan nama lengkap...')}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
                  />
                </div>

                {/* Username (Read Only) */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    {t('pf_input_username', 'Nama Pengguna (Username)')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                    <input
                      type="text"
                      disabled
                      value={username}
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-sm font-semibold cursor-not-allowed"
                    />
                  </div>
                  <p className="text-[0.7rem] text-slate-400 mt-1">Username bersifat permanen dan tidak dapat diubah.</p>
                </div>
              </div>

              {/* Email (Read Only) */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Alamat Email (Auth System)
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-sm font-semibold cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1">Email dikelola langsung oleh sistem otentikasi Supabase.</p>
              </div>

              {/* Asal Lembaga / Perguruan Tinggi */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  Asal Lembaga / Perguruan Tinggi
                </label>
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Contoh: Nama Group | Institusi"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
              </div>

              {/* Alamat Domisili */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                  <svg className="size-3.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Alamat Domisili</span>
                </label>
                <input
                  type="text"
                  value={domisili}
                  onChange={(e) => setDomisili(e.target.value)}
                  placeholder="Jl. / RT / RW / No. Rumah"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
              </div>

              {/* Grid: Kelurahan, Kecamatan, Kabupaten/Kota */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Kelurahan / Desa
                  </label>
                  <input
                    type="text"
                    value={kelurahan}
                    onChange={(e) => setKelurahan(e.target.value)}
                    placeholder="Contoh: Sukamaju"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Kecamatan
                  </label>
                  <input
                    type="text"
                    value={kecamatan}
                    onChange={(e) => setKecamatan(e.target.value)}
                    placeholder="Contoh: Cilodong"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Kabupaten / Kota
                  </label>
                  <input
                    type="text"
                    value={kabupaten}
                    onChange={(e) => setKabupaten(e.target.value)}
                    placeholder="Contoh: Kota Depok"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
                  />
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  {t('pf_input_bio', 'Biografi Singkat / Bio')}
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('pf_input_bio_ph', 'Tulis sepatah kata tentang motivasi belajar bahasa Jepangmu...')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-medium focus:outline-none focus:border-primary focus:bg-white dark:focus:bg-slate-900 transition-all"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-8 py-3.5 rounded-2xl bg-primary text-white font-extrabold text-sm hover:bg-primary-dark transition-all shadow-md shadow-primary/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Side Info Cards */}
          <div className="space-y-6">
            {/* Account Quick Status */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="font-extrabold text-slate-800 dark:text-white text-base flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <svg className="size-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Informasi Status Akun</span>
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">User ID</span>
                  <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md font-bold truncate max-w-[140px]">
                    {user?.id}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">Asal Lembaga / PT</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate max-w-[140px]">
                    {profile?.institution || '-'}
                  </span>
                </div>

                {(profile?.kabupaten || profile?.kecamatan || profile?.domisili) && (
                  <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">Domisili / Wilayah</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200 text-xs truncate max-w-[140px]" title={[profile?.domisili, profile?.kelurahan, profile?.kecamatan, profile?.kabupaten].filter(Boolean).join(', ')}>
                      {profile?.kabupaten || profile?.kecamatan || profile?.domisili}
                    </span>
                  </div>
                )}

                <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">Aktif Terakhir</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                    {profile?.last_active_at ? new Date(profile.last_active_at).toLocaleString('id-ID') : 'Hari ini'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold">Streak Sakura</span>
                  <span className={`font-extrabold flex items-center gap-1.5 ${isFreezeToday ? 'text-sky-500' : 'text-rose-500'}`}>
                    <svg className="size-3.5 fill-current" viewBox="0 0 24 24">
                      {isFreezeToday ? (
                        <path d="M12 2v20m-10-10h20m-17-7l14 14m0-14L5 19" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                      ) : (
                        <path d="M12 3c-1.5 2-2 4-1 6 2-1 4-1 5 1 1-2 3-2 5-1-1-2-2-4-4-5-2 1-4 1-5-1zm-4 6c-2 1-4 1-5-1 1 2 2 4 4 5 2-1 4-1 5 1-1-2-1-4-2-5-1 0-2 0-2 0zm10 7c2-1 4-1 5 1-1-2-2-4-4-5-2 1-4 1-5-1 1 2 1 4 2 5 1 0 2 0 2 0zm-8 4c1 2 2 4 4 5 2-1 4-1 5 1 1-2 2-4 1-6-2 1-4 1-5-1-1 0-2 0-2 1z" />
                      )}
                    </svg>
                    <span>{profile?.streak_days || 0} Hari {isFreezeToday ? '(Salju)' : 'Mekar'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Navigation */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <svg className="size-4.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Akses Cepat kaiwadojo</span>
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Kelola jadwal belajar harian Anda atau lanjutkan kelas yang sedang Anda tempuh.
              </p>
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => navigate('/my-courses')}
                  className="group w-full text-left px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all flex justify-between items-center cursor-pointer border border-white/10"
                >
                  <span className="flex items-center gap-2">
                    <svg className="size-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>Buka Kursus Saya</span>
                  </span>
                  <span className="size-5 rounded-full bg-white/10 flex items-center justify-center text-[0.6rem] font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>
                <button
                  onClick={() => navigate('/learning-plan')}
                  className="group w-full text-left px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all flex justify-between items-center cursor-pointer border border-white/10"
                >
                  <span className="flex items-center gap-2">
                    <svg className="size-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    <span>Rencana Belajar Harian</span>
                  </span>
                  <span className="size-5 rounded-full bg-white/10 flex items-center justify-center text-[0.6rem] font-black group-hover:translate-x-0.5 transition-transform">
                    &gt;
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 2: COURSES ──────────────────────────── */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-white">Daftar Kursus Terdaftar</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total {enrollments.length} kursus bahasa Jepang dalam progress Anda</p>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
              <button
                onClick={() => setCourseFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  courseFilter === 'all' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Semua ({enrollments.length})
              </button>
              <button
                onClick={() => setCourseFilter('in_progress')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  courseFilter === 'in_progress' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Sedang Belajar ({enrollments.filter(e => !e.completed_at && e.progress_pct < 100).length})
              </button>
              <button
                onClick={() => setCourseFilter('completed')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  courseFilter === 'completed' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Selesai ({enrollments.filter(e => e.completed_at || e.progress_pct >= 100).length})
              </button>
            </div>
          </div>

          {isLoadingData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map(n => (
                <div key={n} className="h-64 rounded-3xl skeleton" />
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 space-y-3">
              <div className="size-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Belum Ada Kursus Ditemukan</h3>
              <p className="text-sm max-w-md mx-auto">
                Anda belum terdaftar pada kategori kursus ini. Cari kursus menarik di Katalog untuk memulai petualangan Anda!
              </p>
              <button
                onClick={() => navigate('/my-courses')}
                className="mt-2 px-6 py-2.5 bg-primary text-white font-extrabold text-xs rounded-xl hover:bg-primary-dark transition-all cursor-pointer"
              >
                Jelajahi Kursus Sekarang
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((item) => {
                const course = item.course
                const isCompleted = item.completed_at || item.progress_pct >= 100
                return (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                  >
                    <div className="h-40 bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                      {course?.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} className="size-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="size-full bg-gradient-to-br from-slate-800 to-primary-dark flex items-center justify-center text-white/30">
                          <svg className="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        </div>
                      )}
                      <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[0.68rem] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {course?.level || 'Pemula'}
                      </span>
                      {isCompleted && (
                        <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[0.68rem] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Selesai</span>
                        </span>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-primary dark:text-red-400">
                          {course?.category || 'Bahasa Jepang'}
                        </span>
                        <h3 className="font-extrabold text-slate-800 dark:text-white text-base line-clamp-2 mt-1">
                          {course?.title || 'Kursus Bahasa Jepang'}
                        </h3>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-500 dark:text-slate-400">Kemajuan Belajar</span>
                          <span className="text-primary dark:text-red-400">{Math.round(item.progress_pct)}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isCompleted ? 'bg-emerald-500' : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, item.progress_pct)}%` }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => navigate('/my-courses')}
                        className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-primary dark:hover:bg-primary hover:text-white text-slate-700 dark:text-slate-200 font-extrabold text-xs transition-all cursor-pointer text-center"
                      >
                        {isCompleted ? 'Tinjau Materi' : 'Lanjutkan Belajar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB CONTENT 3: ACHIEVEMENTS & BADGES ─────────────── */}
      {activeTab === 'achievements' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-white">Lencana & Pencapaian Dojo</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Selesaikan tantangan untuk membuka semua lencana bahasa Jepang Anda</p>
            </div>

            <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-950/40 px-4 py-2.5 rounded-2xl border border-orange-200 dark:border-orange-800">
              <svg className="size-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-bold">Terbuka</div>
                <div className="text-sm font-extrabold text-orange-600 dark:text-orange-400">
                  {badges.filter(b => b.unlocked).length} dari {badges.length} Lencana
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className={`rounded-3xl p-5 border transition-all flex flex-col justify-between relative overflow-hidden ${
                  badge.unlocked
                    ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md'
                    : 'bg-slate-50/80 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`size-12 rounded-2xl flex items-center justify-center ${
                      badge.unlocked ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shadow-xs' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 grayscale'
                    }`}>
                      {badge.icon}
                    </span>
                    {badge.unlocked ? (
                      <span className="text-[0.65rem] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Terbuka</span>
                      </span>
                    ) : (
                      <span className="text-[0.65rem] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Terkunci</span>
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-slate-800 dark:text-white text-base mb-1">{badge.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-3">
                    {badge.description}
                  </p>
                </div>

                {badge.progress && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs font-bold text-slate-400">
                    <span>Progress:</span>
                    <span className={badge.unlocked ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}>
                      {badge.progress}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 4: STATS & ANALYTICS ────────────────── */}
      {activeTab === 'stats' && (
        <div className="space-y-8">
          {/* Key Stat Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-red-100 dark:bg-red-950/60 text-primary dark:text-red-400 flex items-center justify-center shrink-0 font-bold">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total Durasi</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{stats.totalWatchDurationMinutes} <span className="text-xs text-slate-400 font-semibold">Menit</span></div>
                <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 font-medium">Dari lesson_progress</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0 font-bold">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total Replays</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{stats.totalReplays} <span className="text-xs text-slate-400 font-semibold">Kali</span></div>
                <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 font-medium">Pengulangan materi</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="5" />
                  <circle cx="12" cy="12" r="2" fill="currentColor" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Kuis Lulus</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{stats.quizPassed}/{stats.quizAttempts}</div>
                <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 font-medium">Rata-rata skor: {stats.averageQuizScore}%</div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Tamat Kursus</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white mt-0.5">{stats.completedCoursesCount}/{stats.enrolledCoursesCount}</div>
                <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 font-medium">Dari enrollments</div>
              </div>
            </div>
          </div>

          {/* Detailed Summary Box */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
              <svg className="size-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span>Ringkasan Aktivitas Belajar</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-200">Aktivitas Kuis & Tes (quiz_attempts)</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500 dark:text-slate-400">Percobaan Kuis:</span>
                    <span className="text-slate-800 dark:text-white font-bold">{stats.quizAttempts} Kali</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500 dark:text-slate-400">Kuis Berhasil Lulus:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{stats.quizPassed} Kuis</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500 dark:text-slate-400">Rata-rata Skor Kuis:</span>
                    <span className="text-primary dark:text-red-400 font-bold">{stats.averageQuizScore}%</span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 space-y-3">
                <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-200">Pelajaran & Video (lesson_progress)</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500 dark:text-slate-400">Pelajaran Selesai:</span>
                    <span className="text-slate-800 dark:text-white font-bold">{stats.completedLessons} Bab</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500 dark:text-slate-400">Total Menit Menonton:</span>
                    <span className="text-slate-800 dark:text-white font-bold">{stats.totalWatchDurationMinutes} Menit</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500 dark:text-slate-400">Total Putar Ulang (Replays):</span>
                    <span className="text-orange-600 font-bold">{stats.totalReplays} Kali</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </main>
  )
}
