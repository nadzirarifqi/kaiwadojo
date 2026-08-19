import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'


interface Course {
  id: string
  title: string
  slug: string
  description: string
  level: 'pemula' | 'menengah' | 'mahir'
  category: string
  is_published: boolean
  sections?: Section[]
}

interface Section {
  id: string
  title: string
  order_index: number
  lessons: Lesson[]
}

interface Lesson {
  id: string
  title: string
  content_type: 'video' | 'artikel' | 'quiz'
  video_provider: 'youtube' | 'drive' | 'direct' | null
  video_id: string | null
  content_body: string | null
  duration_minutes: number
  is_free_preview: boolean
}

export default function CourseEditor() {
  const { user, profile } = useAuth()
  const [courses, setCourses] = useState<Course[]>([])
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [_loading, setLoading] = useState(true)


  // Form New Course
  const [isCreating, setIsCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newLevel] = useState<'pemula' | 'menengah' | 'mahir'>('pemula')
  const [newCategory, setNewCategory] = useState('Teknologi')
  const [submitting, setSubmitting] = useState(false)

  // Form New Section
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [addingSection, setAddingSection] = useState(false)

  // Form New Lesson
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null)
  const [lessonTitle, setLessonTitle] = useState('')
  const [lessonType] = useState<'video' | 'artikel'>('video')
  const [videoUrlInput, setVideoUrlInput] = useState('')
  const [lessonDuration, setLessonDuration] = useState(10)
  const [addingLesson, setAddingLesson] = useState(false)


  async function fetchInstructorCourses() {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('instructor_id', user.id)
      .order('created_at', { ascending: false })

    if (!error && data) {
      setCourses(data as Course[])
      if (data.length > 0 && !selectedCourse) {
        loadCourseDetail(data[0].id)
      }
    }
    setLoading(false)
  }

  async function loadCourseDetail(courseId: string) {
    const { data: courseData } = await supabase
      .from('courses')
      .select('*')
      .eq('id', courseId)
      .single()

    const { data: sectionsData } = await supabase
      .from('course_sections')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })

    const { data: lessonsData } = await supabase
      .from('lessons')
      .select('*')
      .eq('course_id', courseId)
      .order('order_index', { ascending: true })

    const sectionsWithLessons = (sectionsData || []).map((sec: any) => ({
      ...sec,
      lessons: (lessonsData || []).filter((les: any) => les.section_id === sec.id),
    }))

    if (courseData) {
      setSelectedCourse({
        ...courseData,
        sections: sectionsWithLessons,
      })
    }
  }

  useEffect(() => {
    fetchInstructorCourses()
  }, [user])

  async function handleCreateCourse(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSubmitting(true)

    const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-4)

    const { data, error } = await supabase
      .from('courses')
      .insert({
        instructor_id: user.id,
        title: newTitle.trim(),
        slug,
        description: newDesc.trim(),
        level: newLevel,
        category: newCategory,
        is_published: false,
      })
      .select()
      .single()

    if (error) {
      alert(`Gagal membuat kursus: ${error.message}`)
    } else if (data) {
      setNewTitle('')
      setNewDesc('')
      setIsCreating(false)
      fetchInstructorCourses()
      loadCourseDetail(data.id)
    }
    setSubmitting(false)
  }

  async function handleTogglePublish() {
    if (!selectedCourse) return
    const nextStatus = !selectedCourse.is_published

    const { error } = await supabase
      .from('courses')
      .update({ is_published: nextStatus })
      .eq('id', selectedCourse.id)

    if (!error) {
      setSelectedCourse(prev => prev ? { ...prev, is_published: nextStatus } : null)
      setCourses(prev => prev.map(c => c.id === selectedCourse.id ? { ...c, is_published: nextStatus } : c))
    }
  }

  async function handleAddSection(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCourse || !newSectionTitle.trim()) return
    setAddingSection(true)

    const orderIndex = (selectedCourse.sections?.length || 0) + 1

    const { error } = await supabase
      .from('course_sections')
      .insert({
        course_id: selectedCourse.id,
        title: newSectionTitle.trim(),
        order_index: orderIndex,
      })

    if (!error) {
      setNewSectionTitle('')
      loadCourseDetail(selectedCourse.id)
    }
    setAddingSection(false)
  }

  async function handleAddLesson(e: React.FormEvent, sectionId: string) {
    e.preventDefault()
    if (!selectedCourse || !lessonTitle.trim()) return
    setAddingLesson(true)

    let provider: 'youtube' | 'drive' | 'direct' | null = null

    let videoId: string | null = null

    if (lessonType === 'video') {
      const { detectVideoProvider } = await import('../lib/supabaseClient')
      const detected = detectVideoProvider(videoUrlInput.trim())
      provider = detected.provider
      videoId = detected.videoId
    }

    const { error } = await supabase
      .from('lessons')
      .insert({
        course_id: selectedCourse.id,
        section_id: sectionId,
        title: lessonTitle.trim(),
        content_type: lessonType,
        video_provider: provider,
        video_id: videoId,
        duration_minutes: lessonDuration,
      })

    if (error) {
      alert(`Gagal menambah materi: ${error.message}`)
    } else {
      setLessonTitle('')
      setVideoUrlInput('')
      setActiveSectionId(null)
      loadCourseDetail(selectedCourse.id)
    }
    setAddingLesson(false)
  }

  if (profile?.role !== 'pemateri') {
    return (
      <main className="flex-1 p-8 text-center flex flex-col items-center justify-center gap-3">
        <span className="text-5xl">🔒</span>
        <h2 className="text-xl font-bold text-slate-700">Akses Terbatas</h2>
        <p className="text-sm text-slate-400">Halaman ini hanya dapat diakses oleh akun dengan role Pemateri.</p>
      </main>
    )
  }

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight mb-1">
            🛠️ Course Editor Pemateri
          </h1>
          <p className="text-sm text-slate-500">Kelola dan upload materi kursus kamu di sini</p>
        </div>

        <button
          onClick={() => setIsCreating(prev => !prev)}
          className="bg-primary hover:bg-primary-dark text-white font-bold px-4 py-2.5 rounded-xl transition-all text-sm cursor-pointer border-none shadow-sm flex items-center gap-2 self-start sm:self-auto"
        >
          <span>{isCreating ? '× Batal' : '➕ Buat Kursus Baru'}</span>
        </button>
      </div>

      {/* Form Buat Kursus Baru */}
      {isCreating && (
        <form onSubmit={handleCreateCourse} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col gap-4 animate-fade-in-up">
          <h2 className="text-lg font-bold text-slate-800">Buat Kursus Baru</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Judul Kursus</label>
              <input
                type="text"
                required
                placeholder="misal: Master Pemrograman Web 2026"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-slate-50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Kategori</label>
              <select
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-slate-50"
              >
                <option value="Teknologi">Teknologi</option>
                <option value="Desain">Desain</option>
                <option value="Bisnis">Bisnis</option>
                <option value="Soft Skill">Soft Skill</option>
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">Deskripsi Ringkas</label>
            <textarea
              rows={3}
              placeholder="Jelaskan apa yang akan dipelajari murid..."
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-slate-50 resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="bg-primary hover:bg-primary-dark text-white font-bold py-3 rounded-xl transition-all text-sm cursor-pointer border-none shadow-sm disabled:opacity-50 self-end px-6"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Kursus ✨'}
          </button>
        </form>
      )}

      {/* Grid: Daftar Kursus (kiri) & Detail Bab/Materi (kanan) */}
      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">

        {/* Daftar Kursus Pemateri */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col gap-2 self-start">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2 mb-1">Kursus Kamu ({courses.length})</h3>
          {courses.length === 0 ? (
            <p className="text-xs text-slate-400 px-2 py-4">Belum ada kursus. Klik "Buat Kursus Baru" di atas.</p>
          ) : (
            courses.map(c => (
              <button
                key={c.id}
                onClick={() => loadCourseDetail(c.id)}
                className={`flex flex-col text-left p-3 rounded-xl transition-all border cursor-pointer ${
                  selectedCourse?.id === c.id
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-100 hover:border-slate-200 bg-slate-50'
                }`}
              >
                <div className="text-sm font-bold text-slate-800 line-clamp-1">{c.title}</div>
                <div className="flex justify-between items-center mt-2 text-xs">
                  <span className="text-slate-400 capitalize">{c.category}</span>
                  <span className={`font-semibold px-2 py-0.5 rounded-full ${c.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {c.is_published ? 'Publik' : 'Draft'}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Detail & Bab Kursus Terpilih */}
        {selectedCourse ? (
          <div className="flex flex-col gap-5">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">{selectedCourse.category}</span>
                  <span className="text-xs text-slate-400 capitalize">• {selectedCourse.level}</span>
                </div>
                <h2 className="text-xl font-extrabold text-slate-800">{selectedCourse.title}</h2>
                <p className="text-sm text-slate-400 mt-1">{selectedCourse.description}</p>
              </div>

              <button
                onClick={handleTogglePublish}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold border-none cursor-pointer transition-all shrink-0 ${
                  selectedCourse.is_published
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                }`}
              >
                {selectedCourse.is_published ? '⏸️ Kembalikan ke Draft' : '🚀 Terbitkan Kursus (Publish)'}
              </button>
            </div>

            {/* Tambah Bab Baru */}
            <form onSubmit={handleAddSection} className="flex gap-2">
              <input
                type="text"
                placeholder="Judul Bab Baru (misal: Bab 1 - Dasar-dasar)"
                value={newSectionTitle}
                onChange={e => setNewSectionTitle(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={addingSection}
                className="bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl border-none cursor-pointer transition-all shrink-0"
              >
                + Tambah Bab
              </button>
            </form>

            {/* List Bab & Materi */}
            <div className="flex flex-col gap-4">
              {selectedCourse.sections?.length === 0 ? (
                <div className="bg-slate-50 p-8 text-center rounded-2xl border border-slate-200 text-slate-400 text-sm">
                  Belum ada bab. Tambahkan bab pertama kamu di atas!
                </div>
              ) : (
                selectedCourse.sections?.map(section => (
                  <div key={section.id} className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                      <h4 className="font-bold text-slate-800 text-base">📁 {section.title}</h4>
                      <button
                        onClick={() => setActiveSectionId(activeSectionId === section.id ? null : section.id)}
                        className="text-xs font-bold text-primary hover:underline border-none bg-transparent cursor-pointer"
                      >
                        {activeSectionId === section.id ? '× Batal' : '➕ Tambah Materi Video'}
                      </button>
                    </div>

                    {/* Form Tambah Materi */}
                    {activeSectionId === section.id && (
                      <form onSubmit={e => handleAddLesson(e, section.id)} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            required
                            placeholder="Judul Materi Video"
                            value={lessonTitle}
                            onChange={e => setLessonTitle(e.target.value)}
                            className="px-3.5 py-2 rounded-lg border border-slate-200 text-sm bg-white outline-none"
                          />
                          <input
                            type="url"
                            required
                            placeholder="https://kaiwadojo.inaconnext.it.com/videos/nama-video.mp4"
                            value={videoUrlInput}
                            onChange={e => setVideoUrlInput(e.target.value)}
                            className="px-3.5 py-2 rounded-lg border border-slate-200 text-sm bg-white outline-none"
                          />
                        </div>
                        <p className="text-[0.72rem] text-slate-400 font-medium -mt-1">
                          💡 Upload file video .mp4 ke hosting Rumahweb kamu, lalu tempelkan link videonya di sini.
                        </p>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <span>Durasi (menit):</span>
                            <input
                              type="number"
                              min={1}
                              value={lessonDuration}
                              onChange={e => setLessonDuration(Number(e.target.value))}
                              className="w-16 px-2 py-1 border border-slate-200 rounded text-xs bg-white"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={addingLesson}
                            className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg border-none cursor-pointer"
                          >
                            Simpan Materi
                          </button>
                        </div>
                      </form>
                    )}

                    {/* Items */}
                    <div className="flex flex-col gap-2">
                      {section.lessons.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">Belum ada materi di bab ini.</p>
                      ) : (
                        section.lessons.map(l => (
                          <div key={l.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 text-sm">
                            <div className="flex items-center gap-2">
                              <span>🎬</span>
                              <span className="font-semibold text-slate-700">{l.title}</span>
                              <span className="text-xs text-slate-400">({l.duration_minutes}m)</span>
                            </div>
                            <span className="text-xs font-mono bg-white px-2.5 py-1 rounded-lg border border-slate-200 text-slate-500 truncate max-w-[200px]">
                              {l.video_id || '-'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400 text-sm">
            Pilih kursus dari panel sebelah kiri atau buat kursus baru.
          </div>
        )}
      </div>
    </main>
  )
}
