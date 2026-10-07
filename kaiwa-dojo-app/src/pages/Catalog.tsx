import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

interface CourseItem {
  id: string
  title: string
  slug: string
  description: string
  level: string
  category: string
  thumbnail_url: string | null
  total_duration_minutes: number
  total_lessons: number
  instructor: {
    full_name: string
    avatar_url: string | null
  } | null
  is_enrolled?: boolean
}

export default function CatalogPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const activeUserId = profile?.id || user?.id
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Semua')
  const [enrollingId, setEnrollingId] = useState<string | null>(null)

  async function fetchCourses() {
    setLoading(true)
    // 1. Fetch courses
    const { data: coursesData, error } = await supabase
      .from('courses')
      .select(`
        *,
        instructor:profiles!courses_instructor_id_fkey(full_name, avatar_url)
      `)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching courses:', error)
      setLoading(false)
      return
    }

    // 2. Fetch current user's enrollments if logged in
    let enrolledCourseIds = new Set<string>()
    if (activeUserId) {
      const { data: enrollData } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', activeUserId)

      if (enrollData) {
        enrolledCourseIds = new Set(enrollData.map((e: any) => e.course_id))
      }
    }

    const formatted = (coursesData || []).map((c: any) => ({
      ...c,
      instructor: Array.isArray(c.instructor) ? c.instructor[0] : c.instructor,
      is_enrolled: enrolledCourseIds.has(c.id),
    }))

    setCourses(formatted)
    setLoading(false)
  }

  useEffect(() => {
    fetchCourses()
  }, [activeUserId])

  async function handleEnroll(courseId: string) {
    if (!activeUserId) {
      navigate('/login')
      return
    }
    setEnrollingId(courseId)

    const { error } = await supabase.from('enrollments').insert({
      student_id: activeUserId,
      course_id: courseId,
    })

    if (error) {
      alert(`Gagal mendaftar: ${error.message}`)
    } else {
      setCourses(prev =>
        prev.map(c => (c.id === courseId ? { ...c, is_enrolled: true } : c))
      )
      navigate('/my-courses')
    }
    setEnrollingId(null)
  }

  const categories = ['Semua', ...Array.from(new Set(courses.map(c => c.category).filter(Boolean)))]

  const filtered = courses.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    const matchCat = category === 'Semua' || c.category === category
    return matchSearch && matchCat
  })

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">

      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight mb-1.5 flex items-center gap-2.5">
          <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.328.477-4.5 1.253" /></svg>
          </div>
          <span>Katalog Kursus</span>
        </h1>
        <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">
          Temukan dan ikuti berbagai kursus berkualitas di KaiwaDoJo
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 flex items-center pointer-events-none">
            <svg className="size-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          </span>
          <input
            type="text"
            placeholder="Cari judul kursus atau materi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-slate-200 dark:border-slate-800 rounded-xl text-base font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex gap-1.5 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl overflow-x-auto shrink-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold border-none cursor-pointer transition-all whitespace-nowrap ${
                category === cat ? 'bg-white dark:bg-slate-900 text-primary shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 flex flex-col gap-3">
              <div className="w-full aspect-video skeleton" />
              <div className="h-6 w-3/4 skeleton" />
              <div className="h-4 w-full skeleton" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3">
          <div className="size-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center">
            <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.328.477-4.5 1.253" /></svg>
          </div>
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">Belum ada kursus publik</h3>
          <p className="text-sm text-slate-400">
            {courses.length === 0
              ? 'Pemateri belum menerbitkan kursus. Jika kamu Pemateri, kamu bisa buat kursus baru!'
              : 'Tidak ada kursus yang cocok dengan pencarianmu.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(c => (
            <div
              key={c.id}
              className="bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              {/* Thumbnail */}
              <div className="w-full aspect-video bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center text-4xl relative overflow-hidden">
                {c.thumbnail_url ? (
                  <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-primary/40">
                    <svg className="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.328.477-4.5 1.253" /></svg>
                  </div>
                )}
                <span className="absolute top-3 right-3 text-xs font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wide bg-white/90 dark:bg-slate-900/90 text-primary shadow-sm">
                  {c.level}
                </span>
              </div>

              {/* Content */}
              <div className="p-5 flex-1 flex flex-col">
                <span className="inline-block text-xs font-bold text-primary bg-primary/[0.07] px-2.5 py-1 rounded-full uppercase tracking-wide mb-2 self-start">
                  {c.category || 'Umum'}
                </span>
                <h3 className="text-base font-bold text-slate-800 dark:text-white leading-snug mb-2 line-clamp-2">
                  {c.title}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 flex-1 mb-4">
                  {c.description || 'Tidak ada deskripsi.'}
                </p>

                {/* Instructor */}
                <div className="flex items-center gap-2 mb-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <div className="size-6 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary">
                    {c.instructor?.full_name?.[0] || 'P'}
                  </div>
                  <span>{c.instructor?.full_name || 'Pemateri'}</span>
                  <span className="ml-auto flex items-center gap-1">
                    <svg className="size-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <span>{c.total_duration_minutes || 0}m</span>
                  </span>
                </div>

                {/* Button */}
                {c.is_enrolled ? (
                  <button
                    onClick={() => navigate('/my-courses')}
                    className="w-full py-2.5 rounded-xl text-sm font-bold border-none cursor-pointer bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition-all flex items-center justify-center gap-1.5"
                  >
                    <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span>Sudah Diikuti — Buka</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleEnroll(c.id)}
                    disabled={enrollingId === c.id}
                    className="w-full py-2.5 rounded-xl text-sm font-bold border-none cursor-pointer bg-primary hover:bg-primary-dark text-white transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span>{enrollingId === c.id ? 'Memproses...' : 'Ikuti Kursus'}</span>
                    {enrollingId !== c.id && (
                      <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
