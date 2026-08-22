import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import {
  getChapterSettingsMap,
  getCourseHeaderSettings,
  CHAPTER_UPDATE_EVENT,
  type CourseHeaderSettings,
} from '../lib/chapterService'
import CustomAlertModal, { type AlertModalConfig } from '../components/CustomAlertModal'

/* ── Interfaces ───────────────────────────────────── */
interface LessonItem {
  id: string
  title: string
  lesson_number: number // 1 to 5 for videos, 6 for quiz
  content_type: 'video' | 'artikel' | 'quiz' | 'kotoba'
  video_id: string | null // MP4 URL or null if placeholder

  duration_minutes: number
  duration_text?: string
  is_placeholder: boolean
  is_completed?: boolean
  replay_count?: number
}

interface ChapterItem {
  bab_number: number
  title: string
  subtitle: string
  is_hidden?: boolean
  has_video?: boolean
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

/* ── Standard 5 Items for each Bab in Minna no Nihongo (3 Video + 2 Kuis) ── */
const CHAPTER_ITEMS_CONFIG = [
  { num: 1, title: 'Video 1: Tata Bahasa Bagian 1 (Bunpou A)', icon: '📖', type: 'video' as const, duration: 15, badge: '🎥 Video 1' },
  { num: 2, title: 'Video 2: Tata Bahasa Bagian 2 (Bunpou B)', icon: '📝', type: 'video' as const, duration: 15, badge: '🎥 Video 2' },
  { num: 3, title: 'Video 3: Percakapan & Penerapan (Kaiwa)',  icon: '🗣️', type: 'video' as const, duration: 12, badge: '🎥 Video 3' },
  { num: 4, title: 'Kuis Evaluasi 1: Tata Bahasa & Bunpou',  icon: '🎯', type: 'quiz'  as const, duration: 10, badge: '🎯 Kuis 1'  },
  { num: 5, title: 'Kuis Evaluasi 2: Pemahaman & Kaiwa',     icon: '🎯', type: 'quiz'  as const, duration: 10, badge: '🎯 Kuis 2'  },
]

/* ── Helper to map hosted video files in /kaiwa-1-courses/ ── */
function getHostedVideoUrl(babNumber: number, itemNum: number): string | null {
  // Only items 1, 2, 3 are video lessons (S1, S2, S3)
  if (itemNum > 3) return null

  const folderName = `BAB ${babNumber}`
  const fileName = `Kaiwa Dojo - BAB ${babNumber} S${itemNum}.mov`

  return `/kaiwa-1-courses/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`
}

/* ── Default Chapter Titles for Jilid 1 (Bab 1 - 25) ── */
const JILID_1_TITLES: { [key: number]: { title: string; subtitle: string; has_video?: boolean } } = {
  1:  { title: 'Perkenalan Diri', subtitle: 'わたしはエンジニアです (Saya adalah insinyur)', has_video: true },
  2:  { title: 'Benda-benda Sekitar', subtitle: 'これは本です (Ini adalah buku)', has_video: true },
  3:  { title: 'Tempat & Lokasi', subtitle: 'ここは教室です (Di sini adalah ruang kelas)', has_video: false },
  4:  { title: 'Waktu & Waktu Kerja', subtitle: '今何時ですか (Sekarang jam berapa?)', has_video: false },
  5:  { title: 'Arah & Perpindahan', subtitle: 'どこへ行きますか (Pergi ke mana?)', has_video: false },
  6:  { title: 'Kegiatan Sehari-hari', subtitle: '水を飲みます (Minum air)', has_video: false },
  7:  { title: 'Pemberian & Alat', subtitle: 'スプーンで食べます (Makan dengan sendok)', has_video: false },
  8:  { title: 'Kata Sifat (Adjective)', subtitle: '富士山は高いです (Gunung Fuji tinggi)', has_video: false },
  9:  { title: 'Kesukaan & Keahlian', subtitle: '日本語が好きです (Suka bahasa Jepang)', has_video: false },
  10: { title: 'Keberadaan Benda/Orang', subtitle: '机の上に本があります (Ada buku di atas meja)', has_video: false },
  11: { title: 'Jumlah & Hitungan', subtitle: 'りんごを 5つください (Minta 5 buah apel)', has_video: false },
  12: { title: 'Bentuk Lampau & Perbandingan', subtitle: '昨日は雨でした (Kemarin hujan)', has_video: false },
  13: { title: 'Keinginan (Tai / Hoshii)', subtitle: '日本へ行きたいです (Ingin pergi ke Jepang)', has_video: false },
  14: { title: 'Bentuk -Te (Permintaan)', subtitle: 'ちょっと待ってください (Tolong tunggu sebentar)', has_video: false },
  15: { title: 'Izin & Larangan', subtitle: '写真を撮ってもいいです (Boleh mengambil foto)', has_video: false },
  16: { title: 'Urutan Kegiatan (-Te kara)', subtitle: '朝起きて、顔を洗います (Bangun pagi lalu cuci muka)', has_video: false },
  17: { title: 'Bentuk -Nai (Nai de kudasai)', subtitle: '心配しないでください (Jangan khawatir)', has_video: false },
  18: { title: 'Bentuk Kamus (Koto ga dekiru)', subtitle: 'ピアノを弾くことができます (Bisa bermain piano)', has_video: false },
  19: { title: 'Bentuk -Ta (Pengalaman)', subtitle: '富士山に登ったことがあります (Pernah mendaki G. Fuji)', has_video: false },
  20: { title: 'Biasa (Futsuukei)', subtitle: '明日一緒に行かない？ (Besok mau pergi bareng?)', has_video: false },
  21: { title: 'Pendapat (To omou / To iu)', subtitle: '日本は物価が高いと思います (Saya pikir Jepang mahal)', has_video: false },
  22: { title: 'Modifikasi Kata Benda', subtitle: 'これは私が買った本です (Ini buku yang saya beli)', has_video: false },
  23: { title: 'Waktu (Toki) & Syarat (To)', subtitle: '図書館で本を借りるとき (Saat meminjam buku di perpustakaan)', has_video: false },
  24: { title: 'Kurenai / Ageru / Morau', subtitle: '友達が本をくれました (Teman memberi saya buku)', has_video: false },
  25: { title: 'Pengandaian (-Tara / -Demo)', subtitle: '雨が降ったら、行きません (Jika hujan, tidak pergi)', has_video: false },
}

/* ── Default Chapter Titles for Jilid 2 (Bab 26 - 50) ── */
const JILID_2_TITLES: { [key: number]: { title: string; subtitle: string; has_video?: boolean } } = {
  26: { title: 'Penjelasan Penilaian (n desu)', subtitle: 'どこで買ったんですか (Beli di mana sih?)', has_video: false },
  27: { title: 'Bentuk Potensial (Dekiru)', subtitle: '日本語が話せます (Bisa bicara bahasa Jepang)', has_video: false },
  28: { title: 'Dua Kegiatan Bersamaan (Nagara)', subtitle: '音楽を聞きながら勉強します (Belajar sambil dengar musik)', has_video: false },
  29: { title: 'Keadaan Otomatis (-Te imasu)', subtitle: 'ドアが開いています (Pintunya sedang terbuka)', has_video: false },
  30: { title: 'Persiapan (-Te okimasu)', subtitle: '旅行の前にホテルを予約しておきます (Pesan hotel sebelum liburan)', has_video: false },
  31: { title: 'Bentuk Maksud (Volitional Form)', subtitle: '明日買いに行こうと思っています (Berniat beli besok)', has_video: false },
  32: { title: 'Saran (-Hou ga ii / Shou)', subtitle: '毎日運動したほうがいいです (Sebaiknya olahraga tiap hari)', has_video: false },
  33: { title: 'Perintah & Larangan (Meireikei)', subtitle: '早く走れ！ (Lari cepat!)', has_video: false },
  34: { title: 'Petunjuk (-Toori ni / Ato de)', subtitle: '説明書の通りに組み立てます (Rakit sesuai petunjuk)', has_video: false },
  35: { title: 'Pengandaian (-Ba)', subtitle: '安ければ買います (Kalau murah saya beli)', has_video: false },
  36: { title: 'Usaha (You ni shimasu)', subtitle: '毎日野菜を食べるようにしています (Usahakan makan sayur tiap hari)', has_video: false },
  37: { title: 'Bentuk Pasif (Ukemi)', subtitle: '犬に噛まれました (Digigit anjing)', has_video: false },
  38: { title: 'Penggunaan No (Nominalisasi)', subtitle: '絵を書くのが好きです (Suka menggambar)', has_video: false },
  39: { title: 'Sebab Akibat (-Te / De)', subtitle: 'ニュースを聞いてびっくりしました (Kaget mendengar berita)', has_video: false },
  40: { title: 'Ketidakpastian (Ka dou ka)', subtitle: '間に合うかどうか分かりません (Tidak tahu keburu atau tidak)', has_video: false },
  41: { title: 'Pemberian Hormat (Yaru/Itadaku)', subtitle: '先生にお菓子をいただきました (Menerima kue dari pengajar)', has_video: false },
  42: { title: 'Tujuan (Tame ni / Noni)', subtitle: '自分の店を持つために貯金しています (Menabung demi buka toko)', has_video: false },
  43: { title: 'Kelihatan (Sou desu)', subtitle: '雨が降りそうです (Kelihatannya mau hujan)', has_video: false },
  44: { title: 'Berlebihan (Sugimasu)', subtitle: '食べすぎました (Makan terlalu banyak)', has_video: false },
  45: { title: 'Keadaan (Baai wa)', subtitle: '火事の場合は避難してください (Jika terjadi kebakaran, evakuasi)', has_video: false },
  46: { title: 'Waktu Tepat (Hazu / Tokoro)', subtitle: '今から出かけるところです (Baru mau berangkat sekarang)', has_video: false },
  47: { title: 'Kabar/Dengar-dengar (Sou desu)', subtitle: '天気予報によると明日は晴れるそうです (Dengar-dengar besok cerah)', has_video: false },
  48: { title: 'Bentuk Kausatif (Saseru)', subtitle: '子供に習い事をさせます (Menyuruh anak les)', has_video: false },
  49: { title: 'Hormat Kenjougo & Sonkeigo I', subtitle: '社長はもうお帰りになりました (Bapak Direktur sudah pulang)', has_video: false },
  50: { title: 'Hormat Kenjougo & Sonkeigo II', subtitle: '私が参ります (Saya yang akan datang)', has_video: false },
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
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile } = useAuth()
  const { language, t } = useLanguage()
  const isInstructor = profile?.role === 'pemateri' || profile?.role === 'admin'

  // Admin student preview mode state
  const [adminStudentViewMode, setAdminStudentViewMode] = useState(true)

  // Header Settings State
  const [headerSettings, setHeaderSettings] = useState<CourseHeaderSettings>({
    page_title: '📚 Buku Kursus Minna no Nihongo',
    page_subtitle: 'Pilih jilid buku dan pelajari 5 video materi + 1 kuis di setiap babnya',
  })

  // Fun Fact State
  const [funFactIndex, setFunFactIndex]   = useState(0)

  // State Tabs
  const [selectedJilid, setSelectedJilid] = useState<1 | 2>(1)
  const [chapters, setChapters]           = useState<ChapterItem[]>([])
  const [loading, setLoading]             = useState(true)
  const [searchBab, setSearchBab]         = useState('')

  /* ── Load Course Data from Supabase & Subscribe to Realtime Updates ── */
  useEffect(() => {
    fetchCourseData()

    // 1. Instant local window event sync (for same browser / role switcher / multi-tabs)
    const handleLocalSync = () => {
      fetchCourseData()
    }
    window.addEventListener(CHAPTER_UPDATE_EVENT, handleLocalSync)
    window.addEventListener('storage', handleLocalSync)

    // 2. Supabase Realtime channel for cross-device sync
    const channel = supabase
      .channel('chapter_settings_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chapter_settings' },
        () => {
          fetchCourseData()
        }
      )
      .subscribe()

    return () => {
      window.removeEventListener(CHAPTER_UPDATE_EVENT, handleLocalSync)
      window.removeEventListener('storage', handleLocalSync)
      supabase.removeChannel(channel)
    }
  }, [user, profile?.role, selectedJilid])

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
  // Mobile toggle for lesson list panel
  const [showLessonList, setShowLessonList] = useState(false)

  // Expanded bab accordions
  const [expandedBabs, setExpandedBabs]   = useState<Set<number>>(new Set([1, 26]))

  // Comments
  const [comments, setComments]                   = useState<CommentItem[]>([])
  const [newComment, setNewComment]               = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Custom Alert Modal State
  const [alertConfig, setAlertConfig] = useState<AlertModalConfig>({
    isOpen: false,
    title: '',
    message: '',
    type: 'lock',
    buttonText: 'Mengerti',
    onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
  })

  // Real database lesson map: key = `bab_X_lesson_Y`
  const [_progressMap, setProgressMap] = useState<Map<string, { is_completed: boolean; replay_count: number }>>(new Map())


  /* ── Load Course Data from Supabase & Merge Placeholders ── */
  useEffect(() => {
    fetchCourseData()
  }, [user, selectedJilid])

  async function fetchCourseData() {
    setLoading(true)

    // 0. Fetch Admin Chapter Settings & Header Settings
    const [adminChapterMap, adminHeader] = await Promise.all([
      getChapterSettingsMap(),
      getCourseHeaderSettings(),
    ])
    setHeaderSettings(adminHeader)

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
      const info = titlesMap[bab] || { title: `Bab ${bab}`, subtitle: 'Materi Bahasa Jepang', has_video: false }
      const adminSetting = adminChapterMap[bab]

      const rawBabTitle = adminSetting?.title || info.title
      const babCleanTitle = rawBabTitle.replace(/^Bab\s+\d+:\s*/i, '')

      const lessons: LessonItem[] = CHAPTER_ITEMS_CONFIG.map(item => {
        const lessonCode = `bab_${bab}_item_${item.num}`
        const dbLesson   = realLessonMap.get(lessonCode)

        const isCompleted  = dbLesson ? (userProgress.get(dbLesson.id)?.is_completed || false) : false
        const replayCount  = dbLesson ? (userProgress.get(dbLesson.id)?.replay_count || 0) : 0
        const hostedUrl    = getHostedVideoUrl(bab, item.num)
        
        let customVideoOverride = null
        if (item.num === 1) customVideoOverride = adminSetting?.custom_video_s1
        if (item.num === 2) customVideoOverride = adminSetting?.custom_video_s2
        if (item.num === 3) customVideoOverride = adminSetting?.custom_video_s3

        const videoUrl = customVideoOverride || dbLesson?.video_id || hostedUrl

        // Format Title: [JUDUL BAB] Part 1, Part 2, Part 3
        let lessonTitle = item.title
        if (item.num === 1) lessonTitle = `${babCleanTitle} Part 1`
        if (item.num === 2) lessonTitle = `${babCleanTitle} Part 2`
        if (item.num === 3) lessonTitle = `${babCleanTitle} Part 3`
        if (item.num === 4) lessonTitle = `Kuis Evaluasi 1 — ${babCleanTitle}`
        if (item.num === 5) lessonTitle = `Kuis Evaluasi 2 — ${babCleanTitle}`

        // Duration text (e.g. "3.44", "15.30")
        let durationText = `${item.duration}.00`
        if (item.num === 1 && adminSetting?.duration_s1) durationText = String(adminSetting.duration_s1)
        if (item.num === 2 && adminSetting?.duration_s2) durationText = String(adminSetting.duration_s2)
        if (item.num === 3 && adminSetting?.duration_s3) durationText = String(adminSetting.duration_s3)

        return {
          id: dbLesson?.id || `lesson_bab_${bab}_${item.num}`,
          title: lessonTitle,
          lesson_number: item.num,
          content_type: item.type,
          video_id: videoUrl,
          duration_minutes: Math.ceil(parseFloat(durationText) || item.duration),
          duration_text: durationText,
          is_placeholder: item.type === 'video' ? !videoUrl : false,
          is_completed: isCompleted,
          replay_count: replayCount,
        }
      })

      const finalTitle = adminSetting?.title
        ? adminSetting.title.startsWith(`Bab ${bab}:`) ? adminSetting.title : `Bab ${bab}: ${adminSetting.title}`
        : `Bab ${bab}: ${info.title}`

      generatedChapters.push({
        bab_number: bab,
        title: finalTitle,
        subtitle: adminSetting?.subtitle || info.subtitle,
        is_hidden: adminSetting?.is_hidden ?? false,
        has_video: adminSetting?.has_video ?? (info as any).has_video ?? false,
        lessons,
      })
    }

    setChapters(generatedChapters)
    setLoading(false)
  }

  // Handle URL search params for direct video navigation from Daily Missions (e.g. ?jilid=1&bab=1&item=1)
  useEffect(() => {
    if (chapters.length === 0) return
    const paramJilid = searchParams.get('jilid')
    const paramBab   = searchParams.get('bab')
    const paramItem  = searchParams.get('item') || searchParams.get('lesson')

    if (paramJilid) {
      const jNum = parseInt(paramJilid, 10)
      if (jNum === 1 || jNum === 2) {
        setSelectedJilid(jNum as 1 | 2)
      }
    }

    if (paramBab) {
      const babNum = parseInt(paramBab, 10)
      setExpandedBabs(prev => new Set(prev).add(babNum))
      const chap = chapters.find(c => c.bab_number === babNum)
      if (chap) {
        setActiveChapter(chap)
        if (paramItem) {
          const itemNum = parseInt(paramItem, 10)
          const lessonObj = chap.lessons.find(item => item.lesson_number === itemNum)
          if (lessonObj) {
            setActiveLesson(lessonObj)
          } else if (chap.lessons.length > 0) {
            setActiveLesson(chap.lessons[0])
          }
        } else if (chap.lessons.length > 0) {
          setActiveLesson(chap.lessons[0])
        }
      }
    }
  }, [chapters, searchParams])

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
    const newStatus = !lesson.is_completed

    // 1. Update lesson_progress in Supabase
    await supabase.from('lesson_progress').upsert({
      student_id: user.id,
      lesson_id: lesson.id,
      is_completed: newStatus,
      last_watched_at: new Date().toISOString(),
    }, { onConflict: 'student_id,lesson_id' })

    // 2. Update state & active lesson
    setChapters(prev =>
      prev.map(chap => ({
        ...chap,
        lessons: chap.lessons.map(l =>
          l.id === lesson.id ? { ...l, is_completed: newStatus } : l
        ),
      }))
    )

    if (activeLesson?.id === lesson.id) {
      setActiveLesson(prev => (prev ? { ...prev, is_completed: newStatus } : null))
    }

    // 3. Upsert overall course progress to Supabase enrollments table
    try {
      const courseId = selectedJilid === 1 ? 'minna-no-nihongo-1' : 'minna-no-nihongo-2'
      const updatedCompletedCount = chapters.reduce(
        (acc, c) => acc + c.lessons.filter(l => l.id === lesson.id ? newStatus : l.is_completed).length, 0
      )
      const newProgressPct = Math.min(100, Math.round((updatedCompletedCount / (25 * 5)) * 100))

      await supabase.from('enrollments').upsert({
        student_id: user.id,
        course_id: courseId,
        progress_pct: newProgressPct,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'student_id,course_id' })
    } catch (e) {
      console.warn('Course progress enrollments sync note:', e)
    }

    // 4. Update learning streak
    await supabase.from('learning_streaks').upsert({
      student_id: user.id,
      date: new Date().toISOString().split('T')[0],
    }, { onConflict: 'student_id,date' })
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
    // If student OR if admin is in adminStudentViewMode: hide if marked hidden by Admin
    const shouldHideUnreleased = !isInstructor || (profile?.role === 'admin' && adminStudentViewMode)
    if (shouldHideUnreleased && c.is_hidden) return false

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
      {/* Admin Preview Control Bar */}
      {profile?.role === 'admin' && (
        <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-black">
              👁️ Preview Tampilan Pelajar
            </span>
            <span className="text-xs font-semibold text-slate-300">
              {adminStudentViewMode
                ? 'Menampilkan daftar bab persis seperti yang dilihat oleh Siswa (Bab Sembunyi disaring).'
                : 'Menampilkan seluruh 50 Bab (Termasuk Bab yang disembunyikan).'}
            </span>
          </div>
          <button
            onClick={() => setAdminStudentViewMode(!adminStudentViewMode)}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 cursor-pointer shrink-0"
          >
            {adminStudentViewMode ? '🛠️ Lihat Mode Full Admin' : '👁️ Lihat Mode Tampilan Pelajar'}
          </button>
        </div>
      )}

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
                {t('mc_trivia_title', '⛩️ Japan Trivia & Fun Fact')}
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
      <div className="mb-6 animate-fade-in-up flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight mb-1.5">
            {t('mc_title', headerSettings.page_title)}
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400">
            {t('mc_subtitle', headerSettings.page_subtitle)}
          </p>
        </div>

        {isInstructor && (
          <button
            onClick={() => navigate('/kelola-kursus')}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-extrabold border-none cursor-pointer shadow-md transition-all shrink-0 flex items-center justify-center gap-2 hover:-translate-y-0.5"
          >
            <span>⚙️ Edit Judul & Visibilitas Bab</span>
          </button>
        )}
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
              {t('dash_jilid_1_title', 'Jilid 1 (Dasar I)')}
            </div>
            <div className="text-base sm:text-lg font-extrabold truncate leading-tight">
              {t('course_title_vol1', 'Bahasa Jepang Dasar (Jilid 1)')}
            </div>
            <div className={`text-xs font-semibold mt-1 ${selectedJilid === 1 ? 'text-white/90' : 'text-slate-500'}`}>
              {t('dash_jilid_1_desc', 'Bab 1 s/d Bab 25 • 125 Video Materi')}
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
              {t('dash_jilid_2_title', 'Jilid 2 (Dasar II)')}
            </div>
            <div className="text-base sm:text-lg font-extrabold truncate leading-tight">
              {t('course_title_vol2', 'Bahasa Jepang Menengah (Jilid 2)')}
            </div>
            <div className={`text-xs font-semibold mt-1 ${selectedJilid === 2 ? 'text-white/90' : 'text-slate-500'}`}>
              {t('dash_jilid_2_desc', 'Bab 26 s/d Bab 50 • 125 Video Materi')}
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
            <span>{t('dash_book_progress_title', 'Progress Minna no Nihongo')} (Jilid {selectedJilid})</span>
            <span className="text-primary font-black">{completedLessonsCount} / {totalLessonsCount} {t('completed', 'Selesai')} ({totalProgressPct}%)</span>
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
            placeholder={t('mc_search_placeholder', 'Cari bab atau materi...')}
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
                        {language === 'ja' ? `第${chap.bab_number}課 ${chap.title.replace(/^Bab\s+\d+:\s*/i, '')}` : language === 'en' ? `Chapter ${chap.bab_number}: ${chap.title.replace(/^Bab\s+\d+:\s*/i, '')}` : chap.title}
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold truncate mt-0.5">
                        {chap.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full hidden sm:inline-block">
                      {completedInBab}/5 {t('completed', 'Selesai')}
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

                      // Check if all 3 videos in this chapter are watched by user
                      const babVideos = chap.lessons.filter(l => l.content_type === 'video' || l.lesson_number <= 3)
                      const watchedCount = babVideos.filter(l => l.is_completed || (l.replay_count && l.replay_count > 0)).length
                      const areAllVideosWatched = watchedCount >= 3

                      const isQuizLocked = isQuiz && !areAllVideosWatched

                      return (
                        <div
                          key={lesson.id}
                          onClick={() => {
                            if (isQuizLocked) {
                              setAlertConfig({
                                isOpen: true,
                                title: 'Kuis Masih Terkunci 🔒',
                                message: `Kamu harus menonton seluruh 3 video materi pada "${chap.title}" terlebih dahulu sebelum dapat membuka Kuis Evaluasi ini!\n\n(Progress: ${watchedCount}/3 Video Selesai)`,
                                type: 'lock',
                                buttonText: 'Siap, Nonton Dulu!',
                                onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
                              })
                              return
                            }
                            setActiveChapter(chap)
                            setActiveLesson(lesson)
                          }}
                          className={`w-[230px] sm:w-[250px] shrink-0 rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg ${
                            isQuizLocked
                              ? 'bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700 opacity-80'
                              : lesson.is_completed
                                ? 'bg-emerald-50/40 border-emerald-300'
                                : lesson.is_placeholder
                                  ? 'bg-slate-50 border-slate-200'
                                  : 'bg-white border-slate-200 shadow-sm'
                          }`}
                        >
                          {/* Visual Banner Thumbnail */}
                          <div className={`w-full aspect-[16/9] relative flex items-center justify-center overflow-hidden ${
                            isQuizLocked
                              ? 'bg-gradient-to-br from-slate-700 to-slate-900'
                              : isKotoba
                                ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                                : isQuiz
                                  ? 'bg-gradient-to-br from-indigo-600 to-purple-700'
                                  : lesson.is_placeholder
                                    ? 'bg-gradient-to-br from-slate-700 to-slate-900'
                                    : 'bg-gradient-to-br from-primary to-primary-dark'
                          }`}>
                            {/* Decorative Background Symbol */}
                            <span className="text-5xl opacity-20 absolute -right-2 -bottom-2 select-none pointer-events-none text-white font-black">
                              {isQuizLocked ? '🔒' : isKotoba ? 'あ' : isQuiz ? '🎯' : '🎥'}
                            </span>

                            {/* Center Visual Icon / Play Button */}
                            <div className="size-11 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white text-lg font-bold shadow-md transition-transform group-hover:scale-110">
                              {isQuizLocked ? '🔒' : isKotoba ? '🔤' : isQuiz ? '🎯' : lesson.is_placeholder ? '🔒' : '▶'}
                            </div>

                            {/* Top Status Badges */}
                            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                              <span className="text-[0.65rem] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-md bg-black/40 text-white backdrop-blur-sm">
                                {isKotoba ? t('mc_lesson_kotoba', 'Kotoba') : isQuiz ? t('mc_lesson_quiz', 'Kuis') : `${t('mc_lesson_video', 'Video')} ${lesson.lesson_number}`}
                              </span>
                              {isQuizLocked ? (
                                <span className="text-[0.65rem] font-extrabold bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                                  🔒 {t('mc_locked', 'Terkunci')} ({watchedCount}/3)
                                </span>
                              ) : lesson.is_completed ? (
                                <span className="text-[0.65rem] font-extrabold bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-xs">
                                  ✓ {t('completed', 'Selesai')}
                                </span>
                              ) : lesson.is_placeholder ? (
                                <span className="text-[0.65rem] font-bold bg-amber-500/90 text-white px-2 py-0.5 rounded-full shadow-xs">
                                  ⏳ {t('mc_coming_soon', 'Segera Hadir')}
                                </span>
                              ) : null}
                            </div>

                            {/* Duration Tag */}
                            <span className="absolute bottom-2 right-2 text-[0.65rem] font-bold bg-black/60 text-white/90 px-2 py-0.5 rounded-md backdrop-blur-xs font-mono">
                              ⏱️ {lesson.duration_text || `${lesson.duration_minutes}.00`}
                            </span>
                          </div>

                          {/* Card Content */}
                          <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                            <div>
                              <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 leading-snug line-clamp-2 mb-1">
                                {isQuiz
                                  ? (language === 'ja' ? `評価クイズ ${lesson.lesson_number - 3}` : language === 'en' ? `Evaluation Quiz ${lesson.lesson_number - 3}` : `Kuis Evaluasi ${lesson.lesson_number - 3}`)
                                  : isKotoba
                                    ? (language === 'ja' ? `第${chap.bab_number}課 単語提出` : language === 'en' ? `Chapter ${chap.bab_number} Vocabulary` : `Setoran Kotoba Bab ${chap.bab_number}`)
                                    : (language === 'ja' ? `第${chap.bab_number}課 パート${lesson.lesson_number}` : language === 'en' ? `Chapter ${chap.bab_number} Part ${lesson.lesson_number}` : `Bab ${chap.bab_number} Part ${lesson.lesson_number}`)}
                              </h4>
                              <p className="text-[0.7rem] text-slate-400 font-medium">
                                {isQuizLocked
                                  ? (language === 'ja' ? `あと${3 - watchedCount}個の動画を視聴して解除` : language === 'en' ? `Watch ${3 - watchedCount} more video(s) to unlock` : `Tonton ${3 - watchedCount} video lagi untuk membuka`)
                                  : isKotoba
                                    ? t('mc_kotoba_desc', 'Setoran Kosakata & Artinya')
                                    : isQuiz
                                      ? t('mc_quiz_desc', '10 Soal Pilihan Ganda')
                                      : lesson.is_placeholder
                                        ? t('mc_video_prep_desc', 'Video sedang disiapkan')
                                        : t('mc_video_desc', 'Materi Bahasa Jepang')}
                              </p>
                            </div>

                            <button
                              className={`w-full py-2 rounded-xl text-xs font-extrabold border-none cursor-pointer transition-all ${
                                isQuizLocked
                                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                  : isKotoba
                                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs'
                                    : isQuiz
                                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                      : lesson.is_placeholder
                                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-600 border border-slate-300 dark:border-slate-600 shadow-xs'
                                        : 'bg-primary hover:bg-primary-dark text-white shadow-xs'
                              }`}
                            >
                              {isQuizLocked
                                ? `🔒 Terkunci (${watchedCount}/3 Video)`
                                : isKotoba
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
            {/* On mobile: stack with toggle button. On lg+: side-by-side columns */}
            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_320px] overflow-hidden">

              {/* Left Column: Video Player / Kotoba View / Quiz View / Placeholder */}
              <div className="flex flex-col overflow-y-auto p-4 sm:p-6 gap-5">

                {/* Mobile-only: Toggle button for lesson list */}
                <div className="lg:hidden flex items-center justify-between">
                  <p className="text-xs text-slate-500 font-semibold">
                    📚 {activeChapter?.lessons.length || 0} Materi di Bab Ini
                  </p>
                  <button
                    onClick={() => setShowLessonList(prev => !prev)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border-none cursor-pointer flex items-center gap-1.5"
                  >
                    <span>📋 Daftar Materi</span>
                    <span>{showLessonList ? '▲' : '▼'}</span>
                  </button>
                </div>

                {/* Mobile-only: Collapsible lesson list (shows when toggled) */}
                {showLessonList && (
                  <div className="lg:hidden animate-slide-down bg-slate-50 rounded-2xl border border-slate-200 p-3 flex flex-col gap-2">
                    <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-1">
                      Materi {activeChapter?.title || 'Bab Ini'}
                    </h4>
                    {activeChapter?.lessons.map(l => (
                      <button
                        key={l.id}
                        onClick={() => { setActiveLesson(l); setShowLessonList(false) }}
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
                )}
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
                  /* 🎯 Kuis Evaluasi Bab Frame (Coming Soon State) */
                  <div className="w-full rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-800/60 p-6 sm:p-8 flex flex-col items-center justify-center text-center gap-4 shadow-xl shrink-0 min-h-[420px] relative overflow-hidden">
                    {/* Ambient Glow */}
                    <div className="absolute inset-0 bg-indigo-500/10 blur-3xl pointer-events-none" />

                    <div className="size-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-3xl shadow-lg relative z-10">
                      🎯
                    </div>

                    <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-[0.7rem] font-extrabold uppercase tracking-wider text-amber-300 relative z-10">
                      <span>⏳ Fitur Kuis Coming Soon</span>
                    </div>

                    <div className="relative z-10 max-w-md">
                      <h3 className="text-lg sm:text-xl font-extrabold text-white mb-2">
                        Kuis Evaluasi — {activeChapter?.title}
                      </h3>
                      <p className="text-xs text-slate-300 leading-relaxed font-medium">
                        Soal kuis pilihan ganda untuk Bab ini sedang dalam tahap penyusunan & validasi oleh pengajar. Kamu bisa mempelajari video & setoran kotoba terlebih dahulu!
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-indigo-200 max-w-md w-full relative z-10 flex flex-col gap-1 text-left">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span>💡 Info Pengajar:</span>
                      </span>
                      <span>Target Kuis: 10 Soal Pilihan Ganda (Passing Grade 80%)</span>
                    </div>

                    <div className="pt-2 relative z-10">
                      <button
                        onClick={() => handleToggleLessonComplete(activeLesson)}
                        className={`px-5 py-2.5 rounded-xl text-xs font-extrabold border-none cursor-pointer transition-all ${
                          activeLesson.is_completed
                            ? 'bg-emerald-500 text-white shadow-md'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                        }`}
                      >
                        {activeLesson.is_completed ? '✅ Kuis Ditandai Selesai' : 'Tandai Kuis Selesai (Simulasi)'}
                      </button>
                    </div>
                  </div>
                ) : activeLesson.video_id ? (
                  /* Real HTML5 Portrait Video Player (Mobile 9:16 Responsive Container) */
                  <div className="w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-3 sm:p-6 flex flex-col items-center justify-center shadow-xl border border-slate-800 shrink-0 min-h-[460px] sm:min-h-[580px] relative overflow-hidden">
                    {/* Ambient Glow */}
                    <div className="absolute inset-0 bg-primary/5 blur-3xl pointer-events-none" />

                    {/* Header Badge */}
                    <div className="flex items-center gap-2 mb-3 z-10 text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider bg-white/5 px-3 py-1 rounded-full border border-white/10">
                      <span>📱 Format Video Mobile (Portrait 9:16)</span>
                    </div>

                    {/* Portrait Phone Frame Container */}
                    <div className="w-full max-w-[340px] aspect-[9/16] max-h-[65vh] sm:max-h-[540px] rounded-2xl overflow-hidden bg-black shadow-2xl border-2 sm:border-4 border-slate-800 relative z-10 group">
                      <video
                        key={activeLesson.video_id}
                        controls
                        controlsList="nodownload"
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-contain bg-black"
                        onLoadedMetadata={e => {
                          const totalSecs = e.currentTarget.duration
                          if (totalSecs && !isNaN(totalSecs) && totalSecs > 0 && isFinite(totalSecs)) {
                            const mins = Math.floor(totalSecs / 60)
                            const secs = Math.floor(totalSecs % 60)
                            const formatted = `${mins}.${String(secs).padStart(2, '0')}`
                            if (activeLesson) {
                              activeLesson.duration_text = formatted
                              activeLesson.duration_minutes = Math.ceil(totalSecs / 60)
                            }
                          }
                        }}
                        onEnded={() => {
                          handleIncrementReplay(activeLesson)
                          if (!activeLesson.is_completed) {
                            handleToggleLessonComplete(activeLesson)
                          }
                        }}
                      >
                        <source src={activeLesson.video_id} type="video/quicktime" />
                        <source src={activeLesson.video_id} type="video/mp4" />
                        Browser kamu tidak mendukung pemutaran langsung file video ini.
                      </video>
                    </div>
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

              {/* Right Column: Playlist of 5 Videos in active Chapter (desktop only) */}
              <div className="hidden lg:flex bg-slate-50 border-l border-slate-200 p-4 overflow-y-auto flex-col gap-2">
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
      {/* Beautiful Custom Alert Modal */}
      <CustomAlertModal {...alertConfig} />
    </main>
  )
}
