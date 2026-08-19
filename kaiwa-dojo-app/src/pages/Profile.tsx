import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

/* ── Avatar Presets (Dojo & Japanese Aesthetic) ────────── */
const AVATAR_PRESETS = [
  { id: 'ninja', label: '🥷 Ninja', url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=150&auto=format&fit=crop&q=80' },
  { id: 'samurai', label: '⚔️ Samurai', url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=150&auto=format&fit=crop&q=80' },
  { id: 'sakura', label: '🌸 Sakura', url: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=150&auto=format&fit=crop&q=80' },
  { id: 'kitsune', label: '🦊 Kitsune', url: 'https://images.unsplash.com/photo-1516934024742-b461fba47600?w=150&auto=format&fit=crop&q=80' },
  { id: 'torii', label: '⛩️ Torii', url: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=150&auto=format&fit=crop&q=80' },
  { id: 'matcha', label: '🍵 Matcha', url: 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?w=150&auto=format&fit=crop&q=80' },
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // Active Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'courses' | 'achievements' | 'stats'>('overview')

  // Form State
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
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
      setBio(profile.bio || '')
      setAvatarUrl(profile.avatar_url || '')
    }
  }, [profile])

  // Fetch full data from database tables (profiles, enrollments, lesson_progress, quiz_attempts)
  useEffect(() => {
    if (!user) return

    async function loadDatabaseData() {
      if (!user) return
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
          .eq('student_id', user.id)
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
          .eq('student_id', user.id)

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
          .eq('student_id', user.id)

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
  }, [user])

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
    if (!user) return

    setIsSaving(true)
    let finalAvatarUrl = avatarUrl

    try {
      // If a new local image file was picked, attempt Supabase Storage upload
      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop()
        const fileName = `${user.id}-${Date.now()}.${fileExt}`

        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(fileName, selectedFile, { upsert: true })

        if (!uploadErr) {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName)
          
          if (publicUrlData?.publicUrl) {
            finalAvatarUrl = publicUrlData.publicUrl
          }
        } else {
          console.warn('Storage upload error, using Data URL fallback:', uploadErr)
          if (previewUrl) finalAvatarUrl = previewUrl
        }
      }

      // Update profiles table
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          username: username.trim(),
          bio: bio.trim(),
          avatar_url: finalAvatarUrl.trim() || null,
          role: 'pelajar',
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (profileErr) throw profileErr

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
      title: 'Murid Baru 🌸',
      description: 'Bergabung dengan KaiwaDoJo',
      unlocked: true,
      icon: '🏯',
    },
    {
      id: 'streak7',
      title: 'Semangat Lautan Api 🔥',
      description: 'Menjaga streak belajar 7 hari berturut-turut',
      unlocked: (profile?.streak_days || 0) >= 7,
      progress: `${Math.min(profile?.streak_days || 0, 7)}/7 Hari`,
      icon: '🔥',
    },
    {
      id: 'streak30',
      title: 'Legenda Dojo 👑',
      description: 'Menjaga streak belajar 30 hari berturut-turut',
      unlocked: (profile?.streak_days || 0) >= 30,
      progress: `${Math.min(profile?.streak_days || 0, 30)}/30 Hari`,
      icon: '👑',
    },
    {
      id: 'course_complete',
      title: 'Lulusan Pertama 🎓',
      description: 'Menyelesaikan setidaknya 1 kursus penuh',
      unlocked: stats.completedCoursesCount > 0,
      progress: `${stats.completedCoursesCount}/1 Kursus`,
      icon: '🎓',
    },
    {
      id: 'quiz_master',
      title: 'Kuis Specialist 🎯',
      description: 'Lulus setidaknya 5 kuis bahasa Jepang',
      unlocked: stats.quizPassed >= 5,
      progress: `${stats.quizPassed}/5 Kuis`,
      icon: '🎯',
    },
    {
      id: 'watch_time',
      title: 'Pembelajar Tekun ⏱️',
      description: 'Menonton materi lebih dari 120 menit',
      unlocked: stats.totalWatchDurationMinutes >= 120,
      progress: `${stats.totalWatchDurationMinutes}/120 Menit`,
      icon: '⏱️',
    },
    {
      id: 'replay_king',
      title: 'Raja Replay 🔁',
      description: 'Melakukan pengulangan materi >10 kali',
      unlocked: stats.totalReplays >= 10,
      progress: `${stats.totalReplays}/10 Replay`,
      icon: '🔁',
    },
  ]

  const userInitials = profile?.full_name
    ? profile.full_name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '??'

  const formattedJoinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Agustus 2024'

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full animate-fade-in">
      {/* Toast Popup */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 border text-sm font-bold animate-slide-fade ${
          toastMessage.type === 'success'
            ? 'bg-emerald-500 text-white border-emerald-600'
            : 'bg-red-500 text-white border-red-600'
        }`}>
          <span>{toastMessage.type === 'success' ? '✅' : '❌'}</span>
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
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-6 animate-scale-up">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                  <span>📷</span> Ganti Foto Profil
                </h3>
                <p className="text-xs text-slate-500 font-medium">Unggah foto sendiri atau pilih rekomendasi avatar Dojo</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="size-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-extrabold flex items-center justify-center border-none cursor-pointer text-base"
              >
                ✕
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
                <span className="text-3xl group-hover:scale-110 transition-transform">📁</span>
                <span className="text-sm font-extrabold text-primary">Pilih File Foto Profil</span>
                <span className="text-xs text-slate-400">Mendukung format JPG, PNG, atau WebP (Maks 5MB)</span>
              </button>
            </div>

            {/* OPSI 2: Rekomendasi Avatar Dojo */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
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
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <img src={preset.url} alt={preset.label} className="size-12 rounded-xl object-cover" />
                    <span className="text-xs font-bold text-slate-700 truncate max-w-full">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

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
              className="absolute -bottom-2 -right-2 bg-white text-primary text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg hover:bg-slate-100 hover:scale-105 transition-all border border-slate-200 cursor-pointer flex items-center gap-1.5"
            >
              📷 <span>Ganti Foto</span>
            </button>
          </div>

          {/* User Text Information */}
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 sm:gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                {profile?.full_name || 'Pengguna KaiwaDoJo'}
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase bg-white/20 border border-white/30 text-white backdrop-blur-md shadow-sm">
                🎓 Pelajar Kaiwa
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
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-xs font-bold">
                <span className="text-base animate-flame">🔥</span>
                <span>{profile?.streak_days || 0} Hari Streak</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-xs font-bold">
                <span>📚</span>
                <span>{stats.enrolledCoursesCount} Kursus Terdaftar</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-xs font-bold">
                <span>📅</span>
                <span>Bergabung {formattedJoinDate}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── NAVIGATION TABS ─────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 mb-8 overflow-x-auto pb-1 no-scrollbar">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-4 py-3 rounded-t-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === 'overview'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
          }`}
        >
          <span>👤</span> Ringkasan & Edit Profil
        </button>

        <button
          onClick={() => setActiveTab('courses')}
          className={`flex items-center gap-2 px-4 py-3 rounded-t-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === 'courses'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
          }`}
        >
          <span>📚</span> Kursus Saya ({stats.enrolledCoursesCount})
        </button>

        <button
          onClick={() => setActiveTab('achievements')}
          className={`flex items-center gap-2 px-4 py-3 rounded-t-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === 'achievements'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
          }`}
        >
          <span>🏆</span> Pencapaian & Lencana
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-4 py-3 rounded-t-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer border-b-2 ${
            activeTab === 'stats'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/60'
          }`}
        >
          <span>📊</span> Statistik & Aktivitas
        </button>
      </div>

      {/* ── TAB CONTENT 1: OVERVIEW & EDIT ───────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Edit Form */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <h2 className="text-xl font-extrabold text-slate-800 mb-6 flex items-center gap-2">
              <span>⚙️</span> Edit Data Profil
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Tanaka Sensei"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white transition-all"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">@</span>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="tanakaking"
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-semibold focus:outline-none focus:border-primary focus:bg-white transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Email (Read Only) */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                  Alamat Email (Auth System)
                </label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-sm font-semibold cursor-not-allowed"
                />
                <p className="text-xs text-slate-400 mt-1">Email dikelola langsung oleh sistem otentikasi Supabase.</p>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">
                  Bio / Deskripsi Singkat
                </label>
                <textarea
                  rows={4}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tuliskan sedikit tentang diri Anda, perjalanan belajar bahasa Jepang, atau target Anda..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm font-medium focus:outline-none focus:border-primary focus:bg-white transition-all"
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
                      <span>💾</span>
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
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2 border-b border-slate-100 pb-3">
                <span>🛡️</span> Informasi Status Akun
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-semibold">User ID</span>
                  <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md font-bold truncate max-w-[140px]">
                    {user?.id}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-t border-slate-100">
                  <span className="text-slate-500 font-semibold">Aktif Terakhir</span>
                  <span className="font-semibold text-slate-700 text-xs">
                    {profile?.last_active_at ? new Date(profile.last_active_at).toLocaleString('id-ID') : 'Hari ini'}
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-t border-slate-100">
                  <span className="text-slate-500 font-semibold">Aktifkan Streak</span>
                  <span className="font-extrabold text-orange-500 flex items-center gap-1">
                    🔥 {profile?.streak_days || 0} Hari
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Action Navigation */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="font-extrabold text-base flex items-center gap-2">
                <span>⚡</span> Akses Cepat KaiwaDoJo
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Kelola jadwal belajar harian Anda atau lanjutkan kelas yang sedang Anda tempuh.
              </p>
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => navigate('/my-courses')}
                  className="w-full text-left px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all flex justify-between items-center cursor-pointer border border-white/10"
                >
                  <span>📚 Buka Kursus Saya</span>
                  <span>→</span>
                </button>
                <button
                  onClick={() => navigate('/learning-plan')}
                  className="w-full text-left px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold transition-all flex justify-between items-center cursor-pointer border border-white/10"
                >
                  <span>📋 Rencana Belajar Harian</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB CONTENT 2: COURSES ──────────────────────────── */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800">Daftar Kursus Terdaftar</h2>
              <p className="text-xs text-slate-500 font-medium">Total {enrollments.length} kursus bahasa Jepang dalam progress Anda</p>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl">
              <button
                onClick={() => setCourseFilter('all')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  courseFilter === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Semua ({enrollments.length})
              </button>
              <button
                onClick={() => setCourseFilter('in_progress')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  courseFilter === 'in_progress' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sedang Belajar ({enrollments.filter(e => !e.completed_at && e.progress_pct < 100).length})
              </button>
              <button
                onClick={() => setCourseFilter('completed')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  courseFilter === 'completed' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
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
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 space-y-3">
              <span className="text-5xl">📚</span>
              <h3 className="text-lg font-bold text-slate-700">Belum Ada Kursus Ditemukan</h3>
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
                    className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col group"
                  >
                    <div className="h-40 bg-slate-100 relative overflow-hidden">
                      {course?.thumbnail_url ? (
                        <img src={course.thumbnail_url} alt={course.title} className="size-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="size-full bg-gradient-to-br from-slate-800 to-primary-dark flex items-center justify-center text-4xl font-bold text-white/30">
                          ⛩️
                        </div>
                      )}
                      <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[0.68rem] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {course?.level || 'Pemula'}
                      </span>
                      {isCompleted && (
                        <span className="absolute top-3 right-3 bg-emerald-500 text-white text-[0.68rem] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                          ✓ Selesai
                        </span>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div>
                        <span className="text-[0.7rem] font-extrabold uppercase tracking-wider text-primary">
                          {course?.category || 'Bahasa Jepang'}
                        </span>
                        <h3 className="font-extrabold text-slate-800 text-base line-clamp-2 mt-1">
                          {course?.title || 'Kursus Bahasa Jepang'}
                        </h3>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-500">Kemajuan Belajar</span>
                          <span className="text-primary">{Math.round(item.progress_pct)}%</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
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
                        className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-primary hover:text-white text-slate-700 font-extrabold text-xs transition-all cursor-pointer text-center"
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
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-extrabold text-slate-800">Lencana & Pencapaian Dojo</h2>
              <p className="text-xs text-slate-500 font-medium">Selesaikan tantangan untuk membuka semua lencana bahasa Jepang Anda</p>
            </div>

            <div className="flex items-center gap-3 bg-orange-50 px-4 py-2.5 rounded-2xl border border-orange-200">
              <span className="text-2xl">🏆</span>
              <div>
                <div className="text-xs text-slate-500 font-bold">Terbuka</div>
                <div className="text-sm font-extrabold text-orange-600">
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
                    ? 'bg-white border-slate-200 shadow-sm hover:shadow-md'
                    : 'bg-slate-50/80 border-slate-200/60 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-4xl p-3 rounded-2xl ${
                      badge.unlocked ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-400 grayscale'
                    }`}>
                      {badge.icon}
                    </span>
                    {badge.unlocked ? (
                      <span className="text-[0.65rem] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                        ✓ Terbuka
                      </span>
                    ) : (
                      <span className="text-[0.65rem] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-200 text-slate-500">
                        🔒 Terkunci
                      </span>
                    )}
                  </div>

                  <h3 className="font-extrabold text-slate-800 text-base mb-1">{badge.title}</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mb-3">
                    {badge.description}
                  </p>
                </div>

                {badge.progress && (
                  <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-400">
                    <span>Progress:</span>
                    <span className={badge.unlocked ? 'text-emerald-600' : 'text-slate-500'}>
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
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-red-100 text-primary flex items-center justify-center text-2xl shrink-0 font-bold">
                ⏱️
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total Durasi</div>
                <div className="text-2xl font-black text-slate-800 mt-0.5">{stats.totalWatchDurationMinutes} <span className="text-xs text-slate-400 font-semibold">Menit</span></div>
                <div className="text-[0.68rem] text-slate-500 font-medium">Dari lesson_progress</div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center text-2xl shrink-0 font-bold">
                🔁
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Total Replays</div>
                <div className="text-2xl font-black text-slate-800 mt-0.5">{stats.totalReplays} <span className="text-xs text-slate-400 font-semibold">Kali</span></div>
                <div className="text-[0.68rem] text-slate-500 font-medium">Pengulangan materi</div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl shrink-0 font-bold">
                🎯
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Kuis Lulus</div>
                <div className="text-2xl font-black text-slate-800 mt-0.5">{stats.quizPassed}/{stats.quizAttempts}</div>
                <div className="text-[0.68rem] text-slate-500 font-medium">Rata-rata skor: {stats.averageQuizScore}%</div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-2xl shrink-0 font-bold">
                📜
              </div>
              <div>
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Tamat Kursus</div>
                <div className="text-2xl font-black text-slate-800 mt-0.5">{stats.completedCoursesCount}/{stats.enrolledCoursesCount}</div>
                <div className="text-[0.68rem] text-slate-500 font-medium">Dari enrollments</div>
              </div>
            </div>
          </div>

          {/* Detailed Summary Box */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
              <span>📈</span> Ringkasan Aktivitas Belajar
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h4 className="font-extrabold text-sm text-slate-700">Aktivitas Kuis & Tes (quiz_attempts)</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500">Percobaan Kuis:</span>
                    <span className="text-slate-800 font-bold">{stats.quizAttempts} Kali</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500">Kuis Berhasil Lulus:</span>
                    <span className="text-emerald-600 font-bold">{stats.quizPassed} Kuis</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500">Rata-rata Skor Kuis:</span>
                    <span className="text-primary font-bold">{stats.averageQuizScore}%</span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <h4 className="font-extrabold text-sm text-slate-700">Pelajaran & Video (lesson_progress)</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500">Pelajaran Selesai:</span>
                    <span className="text-slate-800 font-bold">{stats.completedLessons} Bab</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500">Total Menit Menonton:</span>
                    <span className="text-slate-800 font-bold">{stats.totalWatchDurationMinutes} Menit</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-slate-500">Total Putar Ulang (Replays):</span>
                    <span className="text-orange-600 font-bold">{stats.totalReplays} Kali</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
