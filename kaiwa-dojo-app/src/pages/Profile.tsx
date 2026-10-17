import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import { useToast } from '../contexts/ToastContext'
import { ProfileSkeleton } from '../components/Skeleton'
import ModalPortal from '../components/ModalPortal'
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
  const { toast } = useToast()
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
    if (type === 'success') {
      toast.success(text, 'Profil')
    } else {
      toast.error(text, 'Profil')
    }
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
    : '-'

  const roleLabel = profile?.role === 'admin' ? 'Admin' : profile?.role === 'pemateri' ? 'Pengajar' : 'Pelajar'
  const streakDays = profile?.streak_days || 0
  const unlockedBadges = badges.filter(b => b.unlocked).length

  // Ada perubahan yang belum disimpan?
  const isDirty = Boolean(profile) && (
    fullName !== (profile?.full_name || '') ||
    institution !== (profile?.institution || '') ||
    domisili !== (profile?.domisili || '') ||
    kelurahan !== (profile?.kelurahan || '') ||
    kecamatan !== (profile?.kecamatan || '') ||
    kabupaten !== (profile?.kabupaten || '') ||
    bio !== (profile?.bio || '') ||
    avatarUrl !== (profile?.avatar_url || '')
  )

  function handleResetForm() {
    setFullName(profile?.full_name || '')
    setInstitution(profile?.institution || '')
    setDomisili(profile?.domisili || '')
    setKelurahan(profile?.kelurahan || '')
    setKecamatan(profile?.kecamatan || '')
    setKabupaten(profile?.kabupaten || '')
    setBio(profile?.bio || '')
    setAvatarUrl(profile?.avatar_url || '')
    setSelectedFile(null)
    setPreviewUrl(null)
  }

  async function handleCopyReferral() {
    if (!profile?.referral_code) return
    try {
      await navigator.clipboard.writeText(profile.referral_code)
      showToast('success', 'Kode referral disalin.')
    } catch {
      showToast('error', 'Gagal menyalin kode referral.')
    }
  }

  function badgeProgressPct(progress?: string): number {
    const m = progress?.match(/(\d+)\s*\/\s*(\d+)/)
    if (!m) return 0
    return Math.min(100, Math.round((Number(m[1]) / Math.max(1, Number(m[2]))) * 100))
  }

  const CARD = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm'
  const inputClass =
    'w-full px-3.5 py-2.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-base sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors'
  const labelClass = 'block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5'

  const tabs = [
    { id: 'overview' as const, label: 'Profil' },
    { id: 'achievements' as const, label: 'Pencapaian', count: `${unlockedBadges}/${badges.length}` },
    { id: 'courses' as const, label: 'Kursus', count: String(stats.enrolledCoursesCount) },
  ]
  const currentTab = activeTab === 'stats' ? 'achievements' : activeTab

  const activityStats = [
    { label: 'Materi selesai', value: stats.completedLessons, unit: 'materi', tone: 'bg-primary/10 text-primary dark:text-primary-lighter', d: 'M5 13l4 4L19 7' },
    { label: 'Waktu menonton', value: stats.totalWatchDurationMinutes, unit: 'menit', tone: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400', d: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { label: 'Putar ulang', value: stats.totalReplays, unit: 'kali', tone: 'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400', d: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
    { label: 'Kuis lulus', value: `${stats.quizPassed}/${stats.quizAttempts}`, unit: stats.quizAttempts > 0 ? `rata-rata ${stats.averageQuizScore}%` : 'belum ada kuis', tone: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400', d: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  ]

  return (
    <main className="flex-1 px-4 py-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full min-w-0 animate-page-slide">

      {/* Input file tersembunyi untuk unggah foto */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept="image/png, image/jpeg, image/jpg, image/webp"
        className="hidden"
      />

      {/* ── Sheet ganti foto profil ── */}
      {isAvatarModalOpen && (
        <ModalPortal>
          <div
            className="modal-overlay fixed inset-0 z-[999] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsAvatarModalOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="avatar-sheet-title"
              onClick={e => e.stopPropagation()}
              className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl px-5 pt-3 sm:pt-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5 max-h-[90dvh] overflow-y-auto animate-fade-in-up"
            >
              <div className="sm:hidden mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="avatar-sheet-title" className="text-lg font-bold text-slate-900 dark:text-white">Ganti foto profil</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Unggah fotomu atau pilih avatar dojo.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(false)}
                  aria-label="Tutup"
                  className="size-10 shrink-0 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer flex items-center justify-center"
                >
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 w-full p-4 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary/50 hover:bg-primary/5 transition-colors flex items-center gap-3 text-left cursor-pointer bg-transparent"
              >
                <span className="size-11 shrink-0 rounded-xl bg-primary/10 text-primary dark:text-primary-lighter flex items-center justify-center">
                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                </span>
                <span>
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">Unggah dari perangkat</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">JPG, PNG, atau WebP · maks. 5 MB</span>
                </span>
              </button>

              <p className="mt-5 mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">Avatar dojo</p>
              <div className="grid grid-cols-3 gap-2.5">
                {AVATAR_PRESETS.map(preset => {
                  const selected = avatarUrl === preset.url
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedFile(null)
                        setPreviewUrl(null)
                        setAvatarUrl(preset.url)
                        setIsAvatarModalOpen(false)
                      }}
                      aria-pressed={selected}
                      className={`p-2 rounded-2xl border-2 flex flex-col items-center gap-1.5 cursor-pointer transition-colors ${
                        selected ? 'border-primary bg-primary/5' : 'border-transparent bg-slate-50 dark:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700'
                      }`}
                    >
                      <img src={preset.url} alt="" className="size-14 rounded-xl object-cover" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{preset.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Foto baru tersimpan setelah kamu menekan <strong>Simpan perubahan</strong>.</p>
            </div>
          </div>
        </ModalPortal>
      )}

      {isLoadingData ? (
        <ProfileSkeleton />
      ) : (
        <>
          {/* ── Header profil ── */}
          <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-dark rounded-2xl p-5 sm:p-6 lg:p-7 mb-4 sm:mb-6 text-white shadow-md animate-fade-in">
            <div className="absolute -top-16 -right-16 size-60 bg-white/10 rounded-full pointer-events-none" />
            <span aria-hidden="true" className="absolute -bottom-12 right-6 font-serif font-black text-[10rem] leading-none text-white/[0.06] select-none pointer-events-none">人</span>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-5 lg:gap-8 items-center">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left min-w-0">
                {/* Avatar + tombol kamera */}
                <div className="relative shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={fullName || 'Foto profil'} className="size-24 sm:size-28 rounded-3xl object-cover border-4 border-white/25 bg-white/10" />
                  ) : (
                    <div className="size-24 sm:size-28 rounded-3xl border-4 border-white/25 bg-white/15 flex items-center justify-center text-3xl font-bold">
                      {userInitials}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(true)}
                    aria-label="Ganti foto profil"
                    title="Ganti foto profil"
                    className="absolute -bottom-1.5 -right-1.5 size-10 rounded-xl bg-white text-primary shadow-md border-none cursor-pointer flex items-center justify-center hover:bg-white/90"
                  >
                    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>

                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight break-words">{profile?.full_name || 'Pengguna'}</h1>
                  <p className="text-sm text-white/80 mt-0.5 truncate">@{profile?.username || 'username'}</p>
                  <div className="mt-2.5 flex flex-wrap justify-center sm:justify-start gap-1.5">
                    <span className="text-xs font-semibold bg-white/15 border border-white/20 px-2.5 py-1 rounded-full">{roleLabel}</span>
                    {profile?.group_name && (
                      <span className="text-xs font-semibold bg-white/15 border border-white/20 px-2.5 py-1 rounded-full">Grup {profile.group_name}</span>
                    )}
                    <span className="text-xs font-semibold bg-white/15 border border-white/20 px-2.5 py-1 rounded-full">Sejak {formattedJoinDate}</span>
                  </div>
                  {profile?.bio && (
                    <p className="mt-3 text-sm text-white/90 leading-relaxed max-w-xl line-clamp-3">“{profile.bio}”</p>
                  )}
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[22rem]">
                {[
                  { label: isFreezeToday ? 'Streak (libur)' : 'Hari beruntun', value: streakDays },
                  { label: 'Materi selesai', value: stats.completedLessons },
                  { label: 'Lencana', value: `${unlockedBadges}/${badges.length}` },
                ].map(s => (
                  <div key={s.label} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5 sm:py-3">
                    <dt className="text-[11px] sm:text-xs text-white/75 leading-tight">{s.label}</dt>
                    <dd className="text-xl sm:text-2xl font-black tabular-nums leading-tight mt-0.5">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </header>

          {/* ── Tab ── */}
          <div role="tablist" aria-label="Bagian profil" className="flex gap-1 p-1 mb-4 sm:mb-6 rounded-2xl bg-slate-100 dark:bg-slate-800/70 w-full sm:w-fit">
            {tabs.map(tab => {
              const active = currentTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 sm:flex-none h-10 px-4 rounded-xl text-sm font-semibold border-none cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                    active ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`text-xs tabular-nums ${active ? 'text-primary dark:text-primary-lighter' : 'text-slate-400'}`}>{tab.count}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* ── Tab: Profil ── */}
          {currentTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_20rem] gap-4 sm:gap-6 items-start">
              <form id="profile-form" onSubmit={handleSaveProfile} className="flex flex-col gap-4 sm:gap-6">
                {/* Informasi pribadi */}
                <section className={`${CARD} p-4 sm:p-6`}>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Informasi pribadi</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Ditampilkan di profil dan dilihat oleh pengajar.</p>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label htmlFor="pf-name" className={labelClass}>{t('pf_input_fullname', 'Nama lengkap')}</label>
                      <input id="pf-name" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required maxLength={100} placeholder={t('pf_input_fullname_ph', 'Masukkan nama lengkap...')} className={inputClass} />
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between mb-1.5">
                        <label htmlFor="pf-bio" className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('pf_input_bio', 'Bio')}</label>
                        <span className="text-xs text-slate-400 tabular-nums">{bio.length}/500</span>
                      </div>
                      <textarea id="pf-bio" value={bio} onChange={e => setBio(e.target.value)} maxLength={500} rows={3} placeholder={t('pf_input_bio_ph', 'Tulis sepatah kata tentang motivasi belajar bahasa Jepangmu...')} className={`${inputClass} resize-y`} />
                    </div>
                  </div>
                </section>

                {/* Instansi & domisili */}
                <section className={`${CARD} p-4 sm:p-6`}>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Instansi & domisili</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Instansi dipakai untuk menentukan grup kelasmu.</p>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label htmlFor="pf-inst" className={labelClass}>Asal lembaga / kampus</label>
                      <input id="pf-inst" type="text" value={institution} onChange={e => setInstitution(e.target.value)} maxLength={150} placeholder="Contoh: Universitas Indonesia" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="pf-addr" className={labelClass}>Alamat domisili</label>
                      <input id="pf-addr" type="text" value={domisili} onChange={e => setDomisili(e.target.value)} maxLength={255} placeholder="Jl. / RT / RW / No. rumah" className={inputClass} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label htmlFor="pf-kel" className={labelClass}>Kelurahan / desa</label>
                        <input id="pf-kel" type="text" value={kelurahan} onChange={e => setKelurahan(e.target.value)} maxLength={100} placeholder="Sukamaju" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="pf-kec" className={labelClass}>Kecamatan</label>
                        <input id="pf-kec" type="text" value={kecamatan} onChange={e => setKecamatan(e.target.value)} maxLength={100} placeholder="Cilodong" className={inputClass} />
                      </div>
                      <div>
                        <label htmlFor="pf-kab" className={labelClass}>Kabupaten / kota</label>
                        <input id="pf-kab" type="text" value={kabupaten} onChange={e => setKabupaten(e.target.value)} maxLength={100} placeholder="Kota Depok" className={inputClass} />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Bar simpan — muncul saat ada perubahan */}
                <div
                  className={`sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] lg:bottom-6 z-20 transition-all duration-200 ${
                    isDirty ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
                  }`}
                  aria-hidden={!isDirty}
                >
                  <div className="rounded-2xl bg-slate-900 dark:bg-slate-800 text-white shadow-xl p-2.5 pl-4 flex items-center gap-2">
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">Ada perubahan yang belum disimpan</span>
                    <button
                      type="button"
                      onClick={handleResetForm}
                      disabled={isSaving}
                      className="h-10 px-3 rounded-xl text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 bg-transparent border-none cursor-pointer"
                    >
                      Batalkan
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving || !isDirty}
                      className="h-10 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer flex items-center gap-2 disabled:opacity-60"
                    >
                      {isSaving && <span className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
                      {isSaving ? 'Menyimpan…' : 'Simpan perubahan'}
                    </button>
                  </div>
                </div>
              </form>

              {/* Info akun */}
              <aside className="flex flex-col gap-4 sm:gap-6">
                <section className={`${CARD} p-4 sm:p-5`}>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mb-3">Akun</h2>
                  <dl className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {[
                      { label: 'Username', value: `@${profile?.username || '-'}` },
                      { label: 'Email', value: user?.email || profile?.email || '-' },
                      { label: 'Peran', value: roleLabel },
                      { label: 'Bergabung', value: formattedJoinDate },
                    ].map(row => (
                      <div key={row.label} className="py-2.5 flex items-center justify-between gap-3">
                        <dt className="text-slate-500 dark:text-slate-400 shrink-0">{row.label}</dt>
                        <dd className="font-semibold text-slate-900 dark:text-white truncate text-right">{row.value}</dd>
                      </div>
                    ))}
                    <div className="py-2.5 flex items-center justify-between gap-3">
                      <dt className="text-slate-500 dark:text-slate-400 shrink-0">Kode referral</dt>
                      <dd className="flex items-center gap-1 min-w-0">
                        <span className="font-mono font-semibold text-slate-900 dark:text-white truncate">{profile?.referral_code || '-'}</span>
                        {profile?.referral_code && (
                          <button
                            type="button"
                            onClick={handleCopyReferral}
                            aria-label="Salin kode referral"
                            title="Salin"
                            className="size-8 shrink-0 rounded-lg bg-transparent border-none cursor-pointer text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center"
                          >
                            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                          </button>
                        )}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">Username, email, dan kode referral tidak dapat diubah dari sini. Hubungi admin bila perlu.</p>
                </section>

                <section className={`${CARD} p-4 sm:p-5`}>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">Pengaturan lain</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Bahasa, tema, kata sandi, dan akun.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/settings')}
                    className="w-full h-11 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold border-none cursor-pointer transition-colors"
                  >
                    Buka Pengaturan
                  </button>
                </section>
              </aside>
            </div>
          )}

          {/* ── Tab: Pencapaian (aktivitas + lencana) ── */}
          {currentTab === 'achievements' && (
            <div className="flex flex-col gap-4 sm:gap-6">
              <section aria-label="Aktivitas belajar" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {activityStats.map(s => (
                  <div key={s.label} className={`${CARD} p-4`}>
                    <span className={`size-10 rounded-xl flex items-center justify-center ${s.tone}`}>
                      <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d={s.d} /></svg>
                    </span>
                    <p className="mt-3 text-2xl font-black tabular-nums text-slate-900 dark:text-white leading-none">{s.value}</p>
                    <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">{s.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{s.unit}</p>
                  </div>
                ))}
              </section>

              <section className={`${CARD} p-4 sm:p-6`}>
                <div className="flex items-end justify-between gap-3 mb-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white">Lencana</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Selesaikan tantangan untuk membuka semua lencana.</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-white shrink-0">{unlockedBadges}/{badges.length}</span>
                </div>
                <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {badges.map(badge => {
                    const pct = badge.unlocked ? 100 : badgeProgressPct(badge.progress)
                    return (
                      <li
                        key={badge.id}
                        className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                          badge.unlocked
                            ? 'border-amber-200 dark:border-amber-900/70 bg-amber-50/50 dark:bg-amber-950/20'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <span className={`size-12 shrink-0 rounded-2xl flex items-center justify-center ${
                          badge.unlocked ? 'bg-white dark:bg-slate-900 shadow-sm' : 'bg-slate-100 dark:bg-slate-800 grayscale opacity-60'
                        }`}>
                          {badge.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className={`text-sm font-semibold truncate ${badge.unlocked ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>{badge.title}</p>
                            {badge.unlocked && (
                              <svg className="size-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">{badge.description}</p>
                          {!badge.unlocked && badge.progress && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <span className="block h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                              </span>
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">{badge.progress}</span>
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </div>
          )}

          {/* ── Tab: Kursus ── */}
          {currentTab === 'courses' && (
            <section className={`${CARD} p-4 sm:p-6`}>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Kursus terdaftar</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{enrollments.length} kursus dalam perjalanan belajarmu</p>
                </div>
                <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70">
                  {([
                    ['all', `Semua`],
                    ['in_progress', 'Berjalan'],
                    ['completed', 'Selesai'],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setCourseFilter(key)}
                      aria-pressed={courseFilter === key}
                      className={`h-9 px-3 rounded-lg text-sm font-semibold border-none cursor-pointer transition-colors ${
                        courseFilter === key ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredCourses.length === 0 ? (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-6 text-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Belum ada kursus di kategori ini</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Progres kursus akan muncul setelah kamu mulai belajar.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/my-courses')}
                    className="mt-3 h-10 px-4 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-semibold border-none cursor-pointer"
                  >
                    Buka Kursus Saya
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCourses.map(item => {
                    const course = item.course
                    const isCompleted = Boolean(item.completed_at) || item.progress_pct >= 100
                    const pct = Math.min(100, Math.round(item.progress_pct))
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => navigate('/my-courses')}
                          className="w-full py-3 flex items-center gap-3 sm:gap-4 text-left bg-transparent border-none cursor-pointer group"
                        >
                          <span className="size-14 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white">
                            {course?.thumbnail_url ? (
                              <img src={course.thumbnail_url} alt="" className="size-full object-cover" />
                            ) : (
                              <svg className="size-6 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-primary transition-colors">{course?.title || 'Kursus Bahasa Jepang'}</span>
                              {isCompleted && <span className="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">Selesai</span>}
                            </span>
                            <span className="block text-xs text-slate-500 dark:text-slate-400">{course?.level || 'Pemula'}{course?.category ? ` · ${course.category}` : ''}</span>
                            <span className="mt-2 flex items-center gap-2">
                              <span className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <span className={`block h-full rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                              </span>
                              <span className="text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300 w-9 text-right">{pct}%</span>
                            </span>
                          </span>
                          <svg className="size-4 shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}
        </>
      )}
    </main>
  )
}
