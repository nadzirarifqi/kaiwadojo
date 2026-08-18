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
  const { user } = useAuth()
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Semua')
  const [enrollingId, setEnrollingId] = useState<string | null>(null)

  async function fetchCourses() {
    setLoading(true)
    // 1. Fetch published courses
    const { data: coursesData, error } = await supabase
      .from('courses')
      .select(`
        id, title, slug, description, level, category, thumbnail_url,
        total_duration_minutes, total_lessons,
        instructor:profiles!courses_instructor_id_fkey(full_name, avatar_url)
      `)
      .eq('is_published', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching courses:', error)
      setLoading(false)
      return
    }

    // 2. Fetch current user's enrollments if logged in
    let enrolledCourseIds = new Set<string>()
    if (user) {
      const { data: enrollData } = await supabase
        .from('enrollments')
        .select('course_id')
        .eq('student_id', user.id)

      if (enrollData) {
        enrolledCourseIds = new Set(enrollData.map(e => e.course_id))
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
  }, [user])

  async function handleEnroll(courseId: string) {
    if (!user) {
      navigate('/login')
      return
    }
    setEnrollingId(courseId)

    const { error } = await supabase.from('enrollments').insert({
      student_id: user.id,
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight mb-1.5">
          📦 Katalog Kursus
        </h1>
        <p className="text-sm sm:text-base text-slate-500">
          Temukan dan ikuti berbagai kursus berkualitas di KaiwaDoJo
        </p>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
          <input
            type="text"
            placeholder="Cari judul kursus atau materi..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-base font-medium text-slate-700 bg-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all placeholder:text-slate-400"
          />
        </div>

        <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-xl overflow-x-auto shrink-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold border-none cursor-pointer transition-all whitespace-nowrap ${
                category === cat ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-slate-500 hover:text-slate-700'
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
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 flex flex-col gap-3">
              <div className="w-full aspect-video skeleton" />
              <div className="h-6 w-3/4 skeleton" />
              <div className="h-4 w-full skeleton" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 flex flex-col items-center gap-3">
          <span className="text-5xl">📦</span>
          <h3 className="text-lg font-bold text-slate-700">Belum ada kursus publik</h3>
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
              className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
            >
              {/* Thumbnail */}
              <div className="w-full aspect-video bg-gradient-to-br from-primary/10 to-primary/20 flex items-center justify-center text-4xl relative overflow-hidden">
                {c.thumbnail_url ? (
                  <img src={c.thumbnail_url} alt={c.title} className="w-full h-full object-cover" />
                ) : (
                  <span>📚</span>
                )}
                <span className="absolute top-3 right-3 text-xs font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wide bg-white/90 text-primary shadow-sm">
                  {c.level}
                </span>
              </div>

              {/* Content */}
              <div className="p-5 flex-1 flex flex-col">
                <span className="inline-block text-xs font-bold text-primary bg-primary/[0.07] px-2.5 py-1 rounded-full uppercase tracking-wide mb-2 self-start">
                  {c.category || 'Umum'}
                </span>
                <h3 className="text-base font-bold text-slate-800 leading-snug mb-2 line-clamp-2">
                  {c.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 flex-1 mb-4">
                  {c.description || 'Tidak ada deskripsi.'}
                </p>

                {/* Instructor */}
                <div className="flex items-center gap-2 mb-4 pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold">
                  <div className="size-6 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary">
                    {c.instructor?.full_name?.[0] || 'P'}
                  </div>
                  <span>{c.instructor?.full_name || 'Pemateri'}</span>
                  <span className="ml-auto">⏱️ {c.total_duration_minutes || 0}m</span>
                </div>

                {/* Button */}
                {c.is_enrolled ? (
                  <button
                    onClick={() => navigate('/my-courses')}
                    className="w-full py-2.5 rounded-xl text-sm font-bold border-none cursor-pointer bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all"
                  >
                    ✅ Sudah Diikuti — Buka
                  </button>
                ) : (
                  <button
                    onClick={() => handleEnroll(c.id)}
                    disabled={enrollingId === c.id}
                    className="w-full py-2.5 rounded-xl text-sm font-bold border-none cursor-pointer bg-primary hover:bg-primary-dark text-white transition-all shadow-sm disabled:opacity-50"
                  >
                    {enrollingId === c.id ? 'Memproses...' : 'Ikuti Kursus →'}
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
