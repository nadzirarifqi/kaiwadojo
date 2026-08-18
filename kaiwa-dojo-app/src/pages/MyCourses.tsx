import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

/* ── Interfaces ───────────────────────────────────── */
interface LessonItem {
  id: string
  title: string
  lesson_number: number // 1 to 5 for videos, 6 for quiz
  content_type: 'video' | 'artikel' | 'quiz'
  video_id: string | null // MP4 URL or null if placeholder
  duration_minutes: number
  is_placeholder: boolean
  is_completed?: boolean
  replay_count?: number
}

interface ChapterItem {
  bab_number: number
  title: string
  subtitle: string
  lessons: LessonItem[]
}

interface CommentItem {
  id: string
  body: string
  created_at: string
  user: {
    full_name: string
    avatar_url: string | null
  } | null
}

/* ── Standard 5 Items for each Bab in Minna no Nihongo ── */
const CHAPTER_ITEMS_CONFIG = [
  { num: 1, title: 'Video 1: Tata Bahasa Bagian 1 (Bunpou A)', icon: '📖', type: 'video'  as const, duration: 15, badge: '🎥 Video 1' },
  { num: 2, title: 'Video 2: Tata Bahasa Bagian 2 (Bunpou B)', icon: '📝', type: 'video'  as const, duration: 15, badge: '🎥 Video 2' },
  { num: 3, title: 'Video 3: Percakapan & Penerapan (Kaiwa)',  icon: '🗣️', type: 'video'  as const, duration: 12, badge: '🎥 Video 3' },
  { num: 4, title: 'Kuis Evaluasi Bab',                       icon: '🎯', type: 'quiz'   as const, duration: 10, badge: '🎯 Kuis'    },
  { num: 5, title: 'Setoran Kotoba (Kosakata & Artinya)',       icon: '🔤', type: 'kotoba' as const, duration: 10, badge: '🔤 Kotoba' },
]

/* ── Default Chapter Titles for Jilid 1 (Bab 1 - 25) ── */
const JILID_1_TITLES: { [key: number]: { title: string; subtitle: string } } = {
  1:  { title: 'Perkenalan Diri', subtitle: 'わたしはエンジニアです (Saya adalah insinyur)' },
  2:  { title: 'Benda-benda Sekitar', subtitle: 'これは本です (Ini adalah buku)' },
  3:  { title: 'Tempat & Lokasi', subtitle: 'ここは教室です (Di sini adalah ruang kelas)' },
  4:  { title: 'Waktu & Waktu Kerja', subtitle: '今何時ですか (Sekarang jam berapa?)' },
  5:  { title: 'Arah & Perpindahan', subtitle: 'どこへ行きますか (Pergi ke mana?)' },
  6:  { title: 'Kegiatan Sehari-hari', subtitle: '水を飲みます (Minum air)' },
  7:  { title: 'Pemberian & Alat', subtitle: 'スプーンで食べます (Makan dengan sendok)' },
  8:  { title: 'Kata Sifat (Adjective)', subtitle: '富士山は高いです (Gunung Fuji tinggi)' },
  9:  { title: 'Kesukaan & Keahlian', subtitle: '日本語が好きです (Suka bahasa Jepang)' },
  10: { title: 'Keberadaan Benda/Orang', subtitle: '机の上に本があります (Ada buku di atas meja)' },
  11: { title: 'Jumlah & Hitungan', subtitle: 'りんごを 5つください (Minta 5 buah apel)' },
  12: { title: 'Bentuk Lampau & Perbandingan', subtitle: '昨日は雨でした (Kemarin hujan)' },
  13: { title: 'Keinginan (Tai / Hoshii)', subtitle: '日本へ行きたいです (Ingin pergi ke Jepang)' },
  14: { title: 'Bentuk -Te (Permintaan)', subtitle: 'ちょっと待ってください (Tolong tunggu sebentar)' },
  15: { title: 'Izin & Larangan', subtitle: '写真を撮ってもいいです (Boleh mengambil foto)' },
  16: { title: 'Urutan Kegiatan (-Te kara)', subtitle: '朝起きて、顔を洗います (Bangun pagi lalu cuci muka)' },
  17: { title: 'Bentuk -Nai (Nai de kudasai)', subtitle: '心配しないでください (Jangan khawatir)' },
  18: { title: 'Bentuk Kamus (Koto ga dekiru)', subtitle: 'ピアノを弾くことができます (Bisa bermain piano)' },
  19: { title: 'Bentuk -Ta (Pengalaman)', subtitle: '富士山に登ったことがあります (Pernah mendaki G. Fuji)' },
  20: { title: 'Biasa (Futsuukei)', subtitle: '明日一緒に行かない？ (Besok mau pergi bareng?)' },
  21: { title: 'Pendapat (To omou / To iu)', subtitle: '日本は物価が高いと思います (Saya pikir Jepang mahal)' },
  22: { title: 'Modifikasi Kata Benda', subtitle: 'これは私が買った本です (Ini buku yang saya beli)' },
  23: { title: 'Waktu (Toki) & Syarat (To)', subtitle: '図書館で本を借りるとき (Saat meminjam buku di perpustakaan)' },
  24: { title: 'Kurenai / Ageru / Morau', subtitle: '友達が本をくれました (Teman memberi saya buku)' },
  25: { title: 'Pengandaian (-Tara / -Demo)', subtitle: '雨が降ったら、行きません (Jika hujan, tidak pergi)' },
}

/* ── Default Chapter Titles for Jilid 2 (Bab 26 - 50) ── */
const JILID_2_TITLES: { [key: number]: { title: string; subtitle: string } } = {
  26: { title: 'Penjelasan Penilaian (n desu)', subtitle: 'どこで買ったんですか (Beli di mana sih?)' },
  27: { title: 'Bentuk Potensial (Dekiru)', subtitle: '日本語が話せます (Bisa bicara bahasa Jepang)' },
  28: { title: 'Dua Kegiatan Bersamaan (Nagara)', subtitle: '音楽を聞きながら勉強します (Belajar sambil dengar musik)' },
  29: { title: 'Keadaan Otomatis (-Te imasu)', subtitle: 'ドアが開いています (Pintunya sedang terbuka)' },
  30: { title: 'Persiapan (-Te okimasu)', subtitle: '旅行の前にホテルを予約しておきます (Pesan hotel sebelum liburan)' },
  31: { title: 'Bentuk Maksud (Volitional Form)', subtitle: '明日買いに行こうと思っています (Berniat beli besok)' },
  32: { title: 'Saran (-Hou ga ii / Shou)', subtitle: '毎日運動したほうがいいです (Sebaiknya olahraga tiap hari)' },
  33: { title: 'Perintah & Larangan (Meireikei)', subtitle: '早く走れ！ (Lari cepat!)' },
  34: { title: 'Petunjuk (-Toori ni / Ato de)', subtitle: '説明書の通りに組み立てます (Rakit sesuai petunjuk)' },
  35: { title: 'Pengandaian (-Ba)', subtitle: '安ければ買います (Kalau murah saya beli)' },
  36: { title: 'Usaha (You ni shimasu)', subtitle: '毎日野菜を食べるようにしています (Usahakan makan sayur tiap hari)' },
  37: { title: 'Bentuk Pasif (Ukemi)', subtitle: '犬に噛まれました (Digigit anjing)' },
  38: { title: 'Penggunaan No (Nominalisasi)', subtitle: '絵を書くのが好きです (Suka menggambar)' },
  39: { title: 'Sebab Akibat (-Te / De)', subtitle: 'ニュースを聞いてびっくりしました (Kaget mendengar berita)' },
  40: { title: 'Ketidakpastian (Ka dou ka)', subtitle: '間に合うかどうか分かりません (Tidak tahu keburu atau tidak)' },
  41: { title: 'Pemberian Hormat (Yaru/Itadaku)', subtitle: '先生にお菓子をいただきました (Menerima kue dari pengajar)' },
  42: { title: 'Tujuan (Tame ni / Noni)', subtitle: '自分の店を持つために貯金しています (Menabung demi buka toko)' },
  43: { title: 'Kelihatan (Sou desu)', subtitle: '雨が降りそうです (Kelihatannya mau hujan)' },
  44: { title: 'Berlebihan (Sugimasu)', subtitle: '食べすぎました (Makan terlalu banyak)' },
  45: { title: 'Keadaan (Baai wa)', subtitle: '火事の場合は避難してください (Jika terjadi kebakaran, evakuasi)' },
  46: { title: 'Waktu Tepat (Hazu / Tokoro)', subtitle: '今から出かけるところです (Baru mau berangkat sekarang)' },
  47: { title: 'Kabar/Dengar-dengar (Sou desu)', subtitle: '天気予報によると明日は晴れるそうです (Dengar-dengar besok cerah)' },
  48: { title: 'Bentuk Kausatif (Saseru)', subtitle: '子供に習い事をさせます (Menyuruh anak les)' },
  49: { title: 'Hormat Kenjougo & Sonkeigo I', subtitle: '社長はもうお帰りになりました (Bapak Direktur sudah pulang)' },
  50: { title: 'Hormat Kenjougo & Sonkeigo II', subtitle: '私が参ります (Saya yang akan datang)' },
}

/* ── Japan Fun Facts Data ────────────────────────────── */
const JAPAN_FUN_FACTS = [
  {
    icon: '🗻',
    kanji: '富士山',
    title: 'Gunung Fuji Sakral & Aktif',
    fact: 'Gunung Fuji (3.776m) adalah simbol sakral Jepang yang sebenarnya merupakan gunung berapi aktif dan dikelilingi 5 danau eksotis!',
    tag: '#GeografiJepang',
  },
  {
    icon: '🚅',
    kanji: '新幹線',
    title: 'Kecepatan & Presisi Shinkansen',
    fact: 'Rata-rata keterlambatan tahunan kereta cepat Shinkansen kurang dari 1 menit! Bukti ketepatan waktu budaya Jepang yang luar biasa.',
    tag: '#TeknologiJepang',
  },
  {
    icon: '🌸',
    kanji: '花見',
    title: 'Tradisi Hanami 1.000 Tahun',
    fact: 'Piknik Hanami (menikmati bunga Sakura mekar) sudah mentradisi sejak Zaman Heian (794 M). Bunga mekar melambangkan keindahan yang sementara.',
    tag: '#BudayaJepang',
  },
  {
    icon: '⛩️',
    kanji: '鳥居',
    title: 'Gerbang Torii Merah Kuil Shinto',
    fact: 'Gerbang Torii merah melambangkan batas spiritual antara dunia manusia dan kawasan suci para Kami (dewa) di kuil Shinto.',
    tag: '#SejarahJepang',
  },
  {
    icon: '🤖',
    kanji: '自動販売機',
    title: '5 Juta Mesin Penjual Otomatis',
    fact: 'Jepang memiliki lebih dari 5 juta Jidouhanbaiki (Vending Machine). Kamu bisa membeli kopi hangat, es krim, bahkan sup di pinggir jalan!',
    tag: '#KehidupanJepang',
  },
  {
    icon: '🍣',
    kanji: 'おもてなし',
    title: 'Budaya Keramahan Omotenashi',
    fact: 'Omotenashi adalah filosofi pelayanan sepenuh hati tanpa mengharapkan imbalan. Di Jepang, memberi tip bahkan bisa dianggap tidak sopan!',
    tag: '#EtikaJepang',
  },
]

export default function MyCourses() {
  const { user } = useAuth()

  // Fun Fact State
  const [funFactIndex, setFunFactIndex]   = useState(0)

  // State Tabs
  const [selectedJilid, setSelectedJilid] = useState<1 | 2>(1)
  const [chapters, setChapters]           = useState<ChapterItem[]>([])
  const [loading, setLoading]             = useState(true)
  const [searchBab, setSearchBab]         = useState('')

  // Auto-rotate fun fact every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setFunFactIndex(prev => (prev + 1) % JAPAN_FUN_FACTS.length)
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  // Active Lesson / Player state
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null)
  const [activeLesson, setActiveLesson]   = useState<LessonItem | null>(null)

  // Expanded bab accordions
  const [expandedBabs, setExpandedBabs]   = useState<Set<number>>(new Set([1, 26]))

  // Comments
  const [comments, setComments]                   = useState<CommentItem[]>([])
  const [newComment, setNewComment]               = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Real database lesson map: key = `bab_X_lesson_Y`
  const [progressMap, setProgressMap] = useState<Map<string, { is_completed: boolean; replay_count: number }>>(new Map())

  /* ── Load Course Data from Supabase & Merge Placeholders ── */
  useEffect(() => {
    fetchCourseData()
  }, [user, selectedJilid])

  async function fetchCourseData() {
    setLoading(true)

    // 1. Fetch user's progress if logged in
    let userProgress = new Map<string, { is_completed: boolean; replay_count: number }>()
    if (user) {
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id, is_completed, replay_count')
        .eq('student_id', user.id)

      if (progressData) {
        progressData.forEach((p: any) => {
          userProgress.set(p.lesson_id, { is_completed: p.is_completed, replay_count: p.replay_count || 0 })
        })
      }
    }
    setProgressMap(userProgress)

    // 2. Fetch real database lessons from Supabase (if available)
    const { data: realLessons } = await supabase
      .from('lessons')
      .select('*')
      .order('order_index', { ascending: true })

    const realLessonMap = new Map<string, any>()
    if (realLessons) {
      realLessons.forEach((l: any) => {
        // e.g. title matched or ID matched
        realLessonMap.set(l.id, l)
        realLessonMap.set(l.title?.toLowerCase(), l)
      })
    }

    // 3. Generate 25 chapters for selected Jilid
    const startBab = selectedJilid === 1 ? 1 : 26
    const endBab   = selectedJilid === 1 ? 25 : 50
    const titlesMap = selectedJilid === 1 ? JILID_1_TITLES : JILID_2_TITLES

    const generatedChapters: ChapterItem[] = []

    for (let bab = startBab; bab <= endBab; bab++) {
      const info = titlesMap[bab] || { title: `Bab ${bab}`, subtitle: 'Materi Bahasa Jepang' }

      const lessons: LessonItem[] = CHAPTER_ITEMS_CONFIG.map(item => {
        const lessonCode = `bab_${bab}_item_${item.num}`
        const dbLesson   = realLessonMap.get(lessonCode)

        const isCompleted  = dbLesson ? (userProgress.get(dbLesson.id)?.is_completed || false) : false
        const replayCount  = dbLesson ? (userProgress.get(dbLesson.id)?.replay_count || 0) : 0
        const videoUrl     = dbLesson?.video_id || null

        return {
          id: dbLesson?.id || `placeholder_${bab}_${item.num}`,
          title: item.title,
          lesson_number: item.num,
          content_type: item.type,
          video_id: videoUrl,
          duration_minutes: dbLesson?.duration_minutes || item.duration,
          is_placeholder: item.type === 'video' ? !videoUrl : false,
          is_completed: isCompleted,
          replay_count: replayCount,
        }
      })

      generatedChapters.push({
        bab_number: bab,
        title: `Bab ${bab}: ${info.title}`,
        subtitle: info.subtitle,
        lessons,
      })
    }

    setChapters(generatedChapters)
    setLoading(false)
  }

  // Fetch comments when active lesson changes
  useEffect(() => {
    if (!activeLesson || activeLesson.is_placeholder) {
      setComments([])
      return
    }
    fetchComments(activeLesson.id)
  }, [activeLesson])

  async function fetchComments(lessonId: string) {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        id, body, created_at,
        user:profiles!comments_user_id_fkey(full_name, avatar_url)
      `)
      .eq('lesson_id', lessonId)
      .order('created_at', { ascending: true })

    if (!error && data) {
      setComments(data.map((item: any) => ({
        ...item,
        user: Array.isArray(item.user) ? item.user[0] : item.user,
      })))
    }
  }

  async function handlePostComment(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !activeLesson || activeLesson.is_placeholder || !newComment.trim()) return
    setSubmittingComment(true)

    const { error } = await supabase.from('comments').insert({
      lesson_id: activeLesson.id,
      user_id: user.id,
      body: newComment.trim(),
    })

    if (!error) {
      setNewComment('')
      fetchComments(activeLesson.id)
    }
    setSubmittingComment(false)
  }

  async function handleToggleLessonComplete(lesson: LessonItem) {
    if (!user || lesson.is_placeholder) return
    const nextCompleted = !lesson.is_completed

    const { error } = await supabase.from('lesson_progress').upsert({
      student_id: user.id,
      lesson_id: lesson.id,
      is_completed: nextCompleted,
      last_watched_at: new Date().toISOString(),
    }, { onConflict: 'student_id,lesson_id' })

    if (!error) {
      await supabase.from('learning_streaks').upsert({
        student_id: user.id,
        date: new Date().toISOString().split('T')[0],
      }, { onConflict: 'student_id,date' })

      fetchCourseData()
      setActiveLesson(prev => prev ? { ...prev, is_completed: nextCompleted } : null)
    }
  }

  async function handleIncrementReplay(lesson: LessonItem) {
    if (!user || lesson.is_placeholder) return
    const currentReplay = lesson.replay_count || 0

    await supabase.from('lesson_progress').upsert({
      student_id: user.id,
      lesson_id: lesson.id,
      replay_count: currentReplay + 1,
      last_watched_at: new Date().toISOString(),
    }, { onConflict: 'student_id,lesson_id' })

    setActiveLesson(prev => prev ? { ...prev, replay_count: currentReplay + 1 } : null)
  }

  function toggleBabAccordion(babNum: number) {
    setExpandedBabs(prev => {
      const next = new Set(prev)
      if (next.has(babNum)) next.delete(babNum)
      else next.add(babNum)
      return next
    })
  }

  /* ── Filter Chapters ─────────────────────────────── */
  const filteredChapters = chapters.filter(c => {
    if (!searchBab.trim()) return true
    const q = searchBab.toLowerCase()
    return (
      c.title.toLowerCase().includes(q) ||
      c.subtitle.toLowerCase().includes(q) ||
      `bab ${c.bab_number}`.includes(q)
    )
  })

  // Calculate total progress
  const totalLessonsCount     = chapters.reduce((acc, c) => acc + c.lessons.length, 0)
  const completedLessonsCount = chapters.reduce(
    (acc, c) => acc + c.lessons.filter(l => l.is_completed).length, 0
  )
  const totalProgressPct      = totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0

  const currentFact = JAPAN_FUN_FACTS[funFactIndex]

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">

      {/* ⛩️ Hero Section: Japan Fun Facts Banner */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 mb-7 shadow-xl relative overflow-hidden animate-fade-in border border-rose-900/30">
        {/* Background Kanji Watermark */}
        <div className="absolute right-4 -bottom-6 text-[10rem] font-black text-rose-500/5 select-none pointer-events-none leading-none">
          {currentFact.kanji}
        </div>
        <div className="absolute -left-10 -top-10 size-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex-1 min-w-0">
            {/* Tag Badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[0.65rem] font-black uppercase tracking-widest bg-rose-500/80 text-white px-3 py-1 rounded-full shadow-xs">
                ⛩️ Japan Trivia & Fun Fact
              </span>
              <span className="text-[0.68rem] font-bold text-rose-200/80 bg-white/10 px-2.5 py-0.5 rounded-full">
                {currentFact.tag}
              </span>
            </div>

            {/* Kanji & Title */}
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl sm:text-4xl shrink-0 animate-bounce">{currentFact.icon}</span>
              <div>
                <h2 className="text-lg sm:text-2xl font-black text-white leading-tight">
                  {currentFact.title} <span className="text-rose-300 font-serif text-base ml-2">({currentFact.kanji})</span>
                </h2>
              </div>
            </div>

            {/* Fact Text */}
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-2xl mt-2 bg-black/20 p-3.5 rounded-2xl border border-white/10">
              "{currentFact.fact}"
            </p>
          </div>

          {/* Fact Nav Controls */}
          <div className="flex flex-col items-end gap-3 shrink-0 self-stretch md:self-center justify-between">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setFunFactIndex(prev => (prev === 0 ? JAPAN_FUN_FACTS.length - 1 : prev - 1))}
                className="size-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer flex items-center justify-center text-xs font-bold transition-all"
                title="Fun Fact Sebelumnya"
              >
                ◄
              </button>
              <button
                onClick={() => setFunFactIndex(Math.floor(Math.random() * JAPAN_FUN_FACTS.length))}
                className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white border-none cursor-pointer text-xs font-black transition-all shadow-md flex items-center gap-1.5"
                title="Acak Fun Fact"
              >
                🎲 Acak Fact
              </button>
              <button
                onClick={() => setFunFactIndex(prev => (prev + 1) % JAPAN_FUN_FACTS.length)}
                className="size-9 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer flex items-center justify-center text-xs font-bold transition-all"
                title="Fun Fact Selanjutnya"
              >
                ►
              </button>
            </div>

            {/* Dots Indicator */}
            <div className="flex items-center gap-1.5 self-center md:self-end">
              {JAPAN_FUN_FACTS.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setFunFactIndex(idx)}
                  className={`size-2 rounded-full border-none cursor-pointer transition-all ${
                    idx === funFactIndex ? 'bg-rose-400 w-5' : 'bg-white/30 hover:bg-white/60'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="mb-6 animate-fade-in-up">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight mb-1.5">
          📚 Buku Kursus Minna no Nihongo
        </h1>
        <p className="text-sm sm:text-base text-slate-500">
          Pilih jilid buku dan pelajari 5 video materi + 1 kuis di setiap babnya
        </p>
      </div>

      {/* ── Book Selector Tabs (Jilid 1 vs Jilid 2) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => setSelectedJilid(1)}
          className={`p-5 rounded-2xl border text-left cursor-pointer transition-all flex items-center gap-4 ${
            selectedJilid === 1
              ? 'bg-gradient-to-br from-primary to-primary-light text-white border-primary shadow-lg scale-[1.01]'
              : 'bg-white border-slate-200 text-slate-700 hover:border-primary/40 hover:bg-slate-50 shadow-sm'
          }`}
        >
          <div className={`size-14 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0 ${
            selectedJilid === 1 ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
          }`}>
            📘
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${selectedJilid === 1 ? 'text-white/80' : 'text-slate-400'}`}>
              Jilid 1 (Dasar I)
            </div>
            <div className="text-base sm:text-lg font-extrabold truncate leading-tight">
              Minna no Nihongo I
            </div>
            <div className={`text-xs font-semibold mt-1 ${selectedJilid === 1 ? 'text-white/90' : 'text-slate-500'}`}>
              Bab 1 s/d Bab 25 • 125 Video Materi
            </div>
          </div>
          {selectedJilid === 1 && (
            <span className="text-xl shrink-0 text-white font-bold">✓</span>
          )}
        </button>

        <button
          onClick={() => setSelectedJilid(2)}
          className={`p-5 rounded-2xl border text-left cursor-pointer transition-all flex items-center gap-4 ${
            selectedJilid === 2
              ? 'bg-gradient-to-br from-emerald-600 to-teal-500 text-white border-emerald-600 shadow-lg scale-[1.01]'
              : 'bg-white border-slate-200 text-slate-700 hover:border-emerald-400 hover:bg-slate-50 shadow-sm'
          }`}
        >
          <div className={`size-14 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0 ${
            selectedJilid === 2 ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'
          }`}>
            📗
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-xs font-bold uppercase tracking-wider mb-1 ${selectedJilid === 2 ? 'text-white/80' : 'text-slate-400'}`}>
              Jilid 2 (Dasar II)
            </div>
            <div className="text-base sm:text-lg font-extrabold truncate leading-tight">
              Minna no Nihongo II
            </div>
            <div className={`text-xs font-semibold mt-1 ${selectedJilid === 2 ? 'text-white/90' : 'text-slate-500'}`}>
              Bab 26 s/d Bab 50 • 125 Video Materi
            </div>
          </div>
          {selectedJilid === 2 && (
            <span className="text-xl shrink-0 text-white font-bold">✓</span>
          )}
        </button>
      </div>

      {/* ── Progress & Filter Bar ── */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-auto flex-1 min-w-0">
          <div className="flex justify-between text-xs sm:text-sm font-bold mb-1.5 text-slate-700">
            <span>Progress Minna no Nihongo Jilid {selectedJilid}</span>
            <span className="text-primary font-black">{completedLessonsCount} / {totalLessonsCount} Selesai ({totalProgressPct}%)</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary-light rounded-full transition-all duration-500"
              style={{ width: `${totalProgressPct}%` }}
            />
          </div>
        </div>

        {/* Search Bab */}
        <div className="w-full sm:w-64 relative shrink-0">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Cari bab atau materi..."
            value={searchBab}
            onChange={e => setSearchBab(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-primary bg-slate-50 font-medium"
          />
        </div>
      </div>

      {/* ── Chapters List (25 Bab Grid/Accordion) ── */}
      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 flex flex-col gap-3">
              <div className="h-6 w-1/3 skeleton" />
              <div className="h-4 w-1/2 skeleton" />
            </div>
          ))}
        </div>
      ) : filteredChapters.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 flex flex-col items-center gap-3">
          <span className="text-4xl">🔎</span>
          <h3 className="text-base font-bold text-slate-700">Tidak ada bab yang cocok</h3>
          <p className="text-xs text-slate-400">Coba ubah kata kunci pencarianmu.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredChapters.map(chap => {
            const isExpanded = expandedBabs.has(chap.bab_number)
            const completedInBab = chap.lessons.filter(l => l.is_completed).length

            return (
              <div
                key={chap.bab_number}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all"
              >
                {/* Bab Header */}
                <div
                  onClick={() => toggleBabAccordion(chap.bab_number)}
                  className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all select-none"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="size-10 sm:size-11 rounded-xl bg-primary/10 text-primary font-black text-sm sm:text-base flex items-center justify-center shrink-0">
                      {chap.bab_number}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-extrabold text-slate-800 leading-snug truncate">
                        {chap.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold truncate mt-0.5">
                        {chap.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full hidden sm:inline-block">
                      {completedInBab}/5 Selesai
                    </span>
                    <span className="text-slate-400 text-sm font-bold">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {/* 1 Horizontal Row with Visual Cards (Scrollable inside box) */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 pt-3 border-t border-slate-100 flex items-stretch gap-3 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 pb-4">
                    {chap.lessons.map(lesson => {
                      const isKotoba = lesson.content_type === 'kotoba'
                      const isQuiz   = lesson.content_type === 'quiz'

                      return (
                        <div
                          key={lesson.id}
                          onClick={() => {
                            setActiveChapter(chap)
                            setActiveLesson(lesson)
                          }}
                          className={`w-[230px] sm:w-[250px] shrink-0 rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg ${
                            lesson.is_completed
                              ? 'bg-emerald-50/40 border-emerald-300'
                              : lesson.is_placeholder
                                ? 'bg-slate-50 border-slate-200'
                                : 'bg-white border-slate-200 shadow-sm'
                          }`}
                        >
                          {/* Visual Banner Thumbnail */}
                          <div className={`w-full aspect-[16/9] relative flex items-center justify-center overflow-hidden ${
                            isKotoba
                              ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                              : isQuiz
                                ? 'bg-gradient-to-br from-indigo-600 to-purple-700'
                                : lesson.is_placeholder
                                  ? 'bg-gradient-to-br from-slate-700 to-slate-900'
                                  : 'bg-gradient-to-br from-primary to-primary-dark'
                          }`}>
                            {/* Decorative Background Symbol */}
                            <span className="text-5xl opacity-20 absolute -right-2 -bottom-2 select-none pointer-events-none text-white font-black">
                              {isKotoba ? 'あ' : isQuiz ? '🎯' : '🎥'}
                            </span>

                            {/* Center Visual Icon / Play Button */}
                            <div className="size-11 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white text-lg font-bold shadow-md transition-transform group-hover:scale-110">
                              {isKotoba ? '🔤' : isQuiz ? '🎯' : lesson.is_placeholder ? '🔒' : '▶'}
                            </div>

                            {/* Top Status Badges */}
                            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                              <span className="text-[0.65rem] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md bg-black/40 text-white backdrop-blur-sm">
                                {isKotoba ? 'Kotoba' : isQuiz ? 'Kuis' : `Video ${lesson.lesson_number}`}
                              </span>
                              {lesson.is_completed ? (
                                <span className="text-[0.65rem] font-extrabold bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                                  ✓ Selesai
                                </span>
                              ) : lesson.is_placeholder ? (
                                <span className="text-[0.65rem] font-bold bg-amber-500/90 text-white px-2 py-0.5 rounded-full shadow-xs">
                                  ⏳ Segera Hadir
                                </span>
                              ) : null}
                            </div>

                            {/* Duration Tag */}
                            <span className="absolute bottom-2 right-2 text-[0.65rem] font-bold bg-black/60 text-white/90 px-2 py-0.5 rounded-md backdrop-blur-xs">
                              ⏱️ {lesson.duration_minutes}m
                            </span>
                          </div>

                          {/* Card Content */}
                          <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                            <div>
                              <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 leading-snug line-clamp-2 mb-1">
                                {lesson.title}
                              </h4>
                              <p className="text-[0.7rem] text-slate-400 font-medium">
                                {isKotoba
                                  ? 'Setoran Kosakata & Artinya'
                                  : isQuiz
                                    ? '10 Soal Pilihan Ganda'
                                    : lesson.is_placeholder
                                      ? 'Video sedang disiapkan'
                                      : 'Materi Bahasa Jepang'}
                              </p>
                            </div>

                            <button
                              className={`w-full py-2 rounded-xl text-xs font-extrabold border-none cursor-pointer transition-all ${
                                isKotoba
                                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                                  : isQuiz
                                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                    : lesson.is_placeholder
                                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 shadow-xs'
                                      : 'bg-primary hover:bg-primary-dark text-white shadow-xs'
                              }`}
                            >
                              {isKotoba
                                ? '🔤 Setor Kotoba'
                                : isQuiz
                                  ? '🎯 Kerjakan Kuis'
                                  : lesson.is_placeholder
                                    ? '🔍 Lihat Preview'
                                    : '▶ Putar Video'}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Video Player & Placeholder Modal ── */}
      {activeLesson && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-2 sm:p-6 animate-fade-in">
          <div className="bg-white w-full max-w-5xl h-[92vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">

            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="min-w-0">
                <span className="text-xs text-primary-lighter font-semibold uppercase">
                  {activeChapter?.title || `Minna no Nihongo Jilid ${selectedJilid}`}
                </span>
                <h2 className="text-base sm:text-lg font-bold truncate">{activeLesson.title}</h2>
              </div>
              <button
                onClick={() => { setActiveLesson(null); setActiveChapter(null) }}
                className="size-9 rounded-full bg-white/10 text-white hover:bg-white/20 border-none cursor-pointer text-xl flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Modal Body: Left Player & Comments | Right Lessons list */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] overflow-hidden">

              {/* Left Column: Video Player / Kotoba View / Quiz View / Placeholder */}
              <div className="flex flex-col overflow-y-auto p-4 sm:p-6 gap-5">
                {activeLesson.content_type === 'kotoba' ? (
                  /* 🔤 Setoran Kotoba Interactive Frame */
                  <div className="w-full rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-orange-500/10 border border-amber-200 p-6 flex flex-col gap-4 shadow-sm shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-md">
                          🔤
                        </div>
                        <div>
                          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Setoran Kotoba</span>
                          <h3 className="text-lg font-extrabold text-slate-800 leading-tight">
                            Setoran Kosakata Bahasa Jepang — {activeChapter?.title}
                          </h3>
                        </div>
                      </div>
                      <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                        ⏱️ Est. 10 Menit
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Hafalkan kosakata dasar bab ini sebelum melanjutkan ke video tata bahasa. Kamu dapat mencocokkan kata Jepang dan artinya!
                    </p>

                    {/* Sample Interactive Vocabulary Card */}
                    <div className="bg-white rounded-2xl p-4 border border-amber-200/80 shadow-xs flex flex-col gap-3">
                      <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-2">
                        Daftar Kosakata Bab {activeChapter?.bab_number}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {[
                          { kana: 'わたし (watashi)', arti: 'Saya' },
                          { kana: 'あなた (anata)', arti: 'Anda / Kamu' },
                          { kana: 'あのひと (ano hito)', arti: 'Orang itu' },
                          { kana: 'みなさん (minasan)', arti: 'Hadirin / Semua orang' },
                          { kana: 'せんせい (sensei)', arti: 'Guru / Pengajar' },
                          { kana: 'がくせい (gakusei)', arti: 'Siswa / Mahasiswa' },
                          { kana: 'かいしゃいん (kaishain)', arti: 'Pegawai perusahaan' },
                          { kana: 'エンジニア (enjinia)', arti: 'Insinyur / Engineer' },
                        ].map((item, idx) => (
                          <div key={idx} className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 flex justify-between items-center text-xs">
                            <span className="font-extrabold text-slate-800 text-sm">{item.kana}</span>
                            <span className="font-bold text-amber-700 bg-white px-2.5 py-1 rounded-lg border border-amber-200">{item.arti}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {activeLesson.is_completed ? '🎉 Status: Sudah Disetor' : '⚡ Hafalkan lalu tandai selesai!'}
                      </span>
                      <button
                        onClick={() => handleToggleLessonComplete(activeLesson)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold border-none cursor-pointer transition-all ${
                          activeLesson.is_completed
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                        }`}
                      >
                        {activeLesson.is_completed ? '✅ Setoran Selesai' : ' Tandai Setoran Selesai'}
                      </button>
                    </div>
                  </div>
                ) : activeLesson.content_type === 'quiz' ? (
                  /* 🎯 Kuis Evaluasi Bab Frame */
                  <div className="w-full rounded-2xl bg-gradient-to-br from-indigo-600/10 via-indigo-600/5 to-purple-600/10 border border-indigo-200 p-6 flex flex-col gap-4 shadow-sm shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-md">
                          🎯
                        </div>
                        <div>
                          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Kuis Evaluasi</span>
                          <h3 className="text-lg font-extrabold text-slate-800 leading-tight">
                            Kuis Pemahaman — {activeChapter?.title}
                          </h3>
                        </div>
                      </div>
                      <span className="text-xs font-bold bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full">
                        📝 10 Soal Pilihan Ganda
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Uji pemahamanmu tentang kosakata, tata bahasa, dan kalimat yang sudah dipelajari di Bab ini.
                    </p>

                    <div className="bg-white rounded-2xl p-5 border border-indigo-100 shadow-xs flex flex-col gap-3">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                        <span>Target Kelulusan: <strong className="text-indigo-600">80% (Min 8/10 Benar)</strong></span>
                        <span>Estimasi: 10 Menit</span>
                      </div>
                      <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 leading-relaxed font-medium">
                        💡 Tips: Pastikan kamu sudah menonton Video 1, 2, 3 dan menghafalkan Kotoba sebelum memulai kuis.
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs font-semibold text-slate-500">
                        {activeLesson.is_completed ? '✅ Kuis Telah Diselesaikan' : 'Siap menguji kemampuanmu?'}
                      </span>
                      <button
                        onClick={() => handleToggleLessonComplete(activeLesson)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-bold border-none cursor-pointer transition-all ${
                          activeLesson.is_completed
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm'
                        }`}
                      >
                        {activeLesson.is_completed ? '✅ Kuis Selesai' : '🚀 Mulai Kuis Evaluasi'}
                      </button>
                    </div>
                  </div>
                ) : activeLesson.video_id ? (
                  /* Real HTML5 Video Player */
                  <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-lg shrink-0">
                    <video
                      src={activeLesson.video_id}
                      controls
                      controlsList="nodownload"
                      className="w-full h-full object-contain"
                    >
                      Browser kamu tidak mendukung pemutaran video ini.
                    </video>
                  </div>
                ) : (
                  /* Elegant Placeholder Player Frame (When video not uploaded yet) */
                  <div className="w-full aspect-video rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center text-center p-6 text-white shadow-lg relative overflow-hidden shrink-0">
                    <div className="size-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl mb-3 border border-white/10">
                      🎬
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-3 py-1 rounded-full mb-2 border border-amber-500/30">
                      Video Sedang Disiapkan oleh Pengajar
                    </span>
                    <h3 className="text-base sm:text-lg font-bold max-w-md leading-snug mb-1">
                      {activeLesson.title}
                    </h3>
                    <p className="text-xs text-slate-300 max-w-sm leading-relaxed mb-4">
                      Video materi ini sedang dalam tahap perekaman/upload oleh admin. Kamu tetap bisa mencatat judul bab dan lanjut ke video berikutnya!
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleLessonComplete(activeLesson)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 cursor-pointer transition-all"
                      >
                        {activeLesson.is_completed ? '✅ Sudah Ditandai' : 'Tandai Sudah Dipelajari'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Lesson Details & Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{activeLesson.title}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      ⏱️ Estimasi Durasi: {activeLesson.duration_minutes} menit • Diulang {activeLesson.replay_count || 0} kali
                    </p>
                  </div>

                  {!activeLesson.is_placeholder && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleIncrementReplay(activeLesson)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold border-none cursor-pointer transition-all"
                      >
                        🔄 Ulangi Video
                      </button>
                      <button
                        onClick={() => handleToggleLessonComplete(activeLesson)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border-none cursor-pointer transition-all ${
                          activeLesson.is_completed
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-primary text-white hover:bg-primary-dark'
                        }`}
                      >
                        {activeLesson.is_completed ? '✅ Selesai' : 'Tandai Selesai'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Discussion / Comments */}
                <div className="flex flex-col gap-4">
                  <h4 className="font-bold text-slate-800 text-base">💬 Diskusi & Catatan Siswa ({comments.length})</h4>

                  {activeLesson.is_placeholder ? (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      📌 Diskusi akan dibuka setelah video materi ini dipublikasikan oleh pengajar.
                    </div>
                  ) : (
                    <>
                      <form onSubmit={handlePostComment} className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Tulis pertanyaan atau catatan..."
                          value={newComment}
                          onChange={e => setNewComment(e.target.value)}
                          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-primary bg-slate-50"
                        />
                        <button
                          type="submit"
                          disabled={submittingComment}
                          className="bg-primary text-white font-bold px-4 py-2.5 rounded-xl text-sm border-none cursor-pointer disabled:opacity-50"
                        >
                          Kirim
                        </button>
                      </form>

                      <div className="flex flex-col gap-3">
                        {comments.length === 0 ? (
                          <p className="text-xs text-slate-400 py-2">Belum ada diskusi di materi ini. Jadi yang pertama berkomentar!</p>
                        ) : (
                          comments.map(item => (
                            <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex gap-3 text-sm">
                              <div className="size-8 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary shrink-0 text-xs">
                                {item.user?.full_name?.[0] || 'U'}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-800 text-xs">{item.user?.full_name || 'User'}</span>
                                  <span className="text-[0.65rem] text-slate-400">
                                    {new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-slate-600 mt-1 text-xs leading-relaxed">{item.body}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Right Column: Playlist of 5 Videos in active Chapter */}
              <div className="bg-slate-50 border-l border-slate-200 p-4 overflow-y-auto flex flex-col gap-2">
                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider px-2 mb-2">
                  Materi {activeChapter?.title || 'Bab Ini'}
                </h4>
                {activeChapter?.lessons.map(l => (
                  <button
                    key={l.id}
                    onClick={() => setActiveLesson(l)}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                      activeLesson?.id === l.id
                        ? 'bg-white border-primary shadow-sm text-primary'
                        : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-xs font-bold truncate">{l.title}</div>
                      <div className="text-[0.7rem] text-slate-400 mt-0.5">
                        ⏱️ {l.duration_minutes}m {l.is_placeholder ? '• ⏳ Segera Hadir' : ''}
                      </div>
                    </div>
                    {l.is_completed ? (
                      <span className="text-xs">✅</span>
                    ) : l.is_placeholder ? (
                      <span className="text-[0.65rem] opacity-40">🔒</span>
                    ) : (
                      <span className="text-xs opacity-40">▶</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
