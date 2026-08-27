import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import {
  getChapterSettingsMap,
  getCourseHeaderSettings,
  detectVideoDuration,
  CHAPTER_UPDATE_EVENT,
  subscribeToChapterRealtime,
  type CourseHeaderSettings,
} from '../lib/chapterService'
import CustomAlertModal, { type AlertModalConfig } from '../components/CustomAlertModal'
import { CourseCardSkeleton } from '../components/Skeleton'
import {
  getTodayDateString,
  fetchDailyMission,
  getDailyMission,
  calculateMissionProgress,
} from '../lib/dailyMission'

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
  const fileNameMp4 = `Kaiwa Dojo - Bab ${babNumber} S${itemNum}.mp4`

  return `/kaiwa-1-courses/${encodeURIComponent(folderName)}/${encodeURIComponent(fileNameMp4)}`
}

function getVideoUrlCandidates(originalUrl: string | null, babNumber: number, itemNum: number): string[] {
  const candidates: string[] = []

  if (originalUrl) {
    candidates.push(originalUrl)
    if (originalUrl.toLowerCase().endsWith('.mov')) {
      candidates.push(originalUrl.replace(/\.mov$/i, '.mp4'))
      candidates.push(originalUrl.replace(/\.mov$/i, '.MP4'))
      candidates.push(originalUrl.replace(/\.mov$/i, '.MOV'))
    } else if (originalUrl.toLowerCase().endsWith('.mp4')) {
      candidates.push(originalUrl.replace(/\.mp4$/i, '.MP4'))
      candidates.push(originalUrl.replace(/\.mp4$/i, '.mov'))
      candidates.push(originalUrl.replace(/\.mp4$/i, '.MOV'))
    }
  }

  const folderName = `BAB ${babNumber}`
  const encFolder = encodeURIComponent(folderName)

  const names = [
    // Primary — matches actual uploaded files (lowercase "Bab")
    `Kaiwa Dojo - Bab ${babNumber} S${itemNum}.mp4`,
    `Kaiwa Dojo - Bab ${babNumber} S${itemNum}.MP4`,
    `Kaiwa Dojo - Bab ${babNumber} S${itemNum}.mov`,
    `Kaiwa Dojo - Bab ${babNumber} S${itemNum}.MOV`,
    // Fallback — uppercase "BAB" variant
    `Kaiwa Dojo - BAB ${babNumber} S${itemNum}.mp4`,
    `Kaiwa Dojo - BAB ${babNumber} S${itemNum}.MP4`,
    `Kaiwa Dojo - BAB ${babNumber} S${itemNum}.mov`,
    `Kaiwa Dojo - BAB ${babNumber} S${itemNum}.MOV`,
    `Kaiwa Dojo - BAB ${babNumber} S${itemNum}.Mp4`,
  ]

  names.forEach(name => {
    const encUrl = `/kaiwa-1-courses/${encFolder}/${encodeURIComponent(name)}`
    const rawUrl = `/kaiwa-1-courses/${folderName}/${name}`
    if (!candidates.includes(encUrl)) candidates.push(encUrl)
    if (!candidates.includes(rawUrl)) candidates.push(rawUrl)
  })

  return candidates
}

function SmartVideoPlayer({
  lesson,
  chapterBab,
  onLoadedMetadata,
  onEnded,
}: {
  lesson: LessonItem
  chapterBab: number
  onLoadedMetadata: (durationSecs: number) => void
  onEnded: () => void
}) {
  const [candidates] = useState<string[]>(() =>
    getVideoUrlCandidates(lesson.video_id, chapterBab, lesson.lesson_number)
  )
  const [candidateIdx, setCandidateIdx] = useState<number>(0)
  const [hasFailedAll, setHasFailedAll] = useState<boolean>(false)

  const currentUrl = candidates[candidateIdx] || lesson.video_id || ''

  function handleError() {
    if (candidateIdx < candidates.length - 1) {
      setCandidateIdx(prev => prev + 1)
    } else {
      setHasFailedAll(true)
    }
  }

  if (hasFailedAll) {
    return (
      <div className="w-full max-w-[340px] aspect-[9/16] rounded-2xl bg-slate-900 border-2 border-amber-500/50 p-5 text-white flex flex-col justify-center items-center text-center gap-3 overflow-y-auto">
        <div className="size-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-2xl font-black">
          ⚠️
        </div>
        <h4 className="text-sm font-extrabold text-white leading-snug">
          Format Video Perlu Penyesuaian
        </h4>
        <p className="text-xs text-slate-300 leading-relaxed">
          Semua ekstensi (.mp4, .MP4, .mov) telah dicoba. Harap pastikan format HandBrake sesuai standar web browser:
        </p>

        <div className="w-full p-3 rounded-xl bg-black/60 border border-slate-800 text-[0.68rem] text-left flex flex-col gap-1 text-slate-300 font-mono">
          <span className="font-bold text-amber-400">💡 Format HandBrake Wajib:</span>
          <span>1. Format Container: <strong>MP4</strong></span>
          <span>2. Video Codec: <strong>H.264 (x264)</strong> — <em>Bukan H.265/HEVC</em></span>
          <span>3. Audio Codec: <strong>AAC</strong></span>
          <span>4. Web Option: Centang <strong>"Web Optimized"</strong></span>
          <span>5. Nama File Server: <code className="text-emerald-400">Kaiwa Dojo - BAB {chapterBab} S{lesson.lesson_number}.mp4</code></span>
        </div>

        <button
          type="button"
          onClick={() => {
            setHasFailedAll(false)
            setCandidateIdx(0)
          }}
          className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs border-none cursor-pointer hover:bg-primary-dark transition-all"
        >
          🔄 Coba Ulang Pemutaran
        </button>
      </div>
    )
  }

  return (
    <video
      key={currentUrl}
      src={currentUrl}
      controls
      controlsList="nodownload"
      playsInline
      preload="metadata"
      className="w-full h-full object-contain bg-black"
      onLoadedMetadata={e => {
        const totalSecs = e.currentTarget.duration
        if (totalSecs && !isNaN(totalSecs) && totalSecs > 0 && isFinite(totalSecs)) {
          onLoadedMetadata(totalSecs)
        }
      }}
      onEnded={onEnded}
      onError={handleError}
    >
      <source src={currentUrl} />
      Browser kamu tidak mendukung pemutaran langsung file video ini.
    </video>
  )
}

/* ── Default Chapter Titles for Jilid 1 (Bab 1 - 25) ── */
const JILID_1_TITLES: { [key: number]: { title: string; subtitle: string; has_video?: boolean } } = {
  1:  { title: 'Perkenalan Diri', subtitle: 'わたしはエンジニアです (Saya adalah insinyur)', has_video: true },
  2:  { title: 'Benda-benda Sekitar', subtitle: 'これは本です (Ini adalah buku)', has_video: true },
  3:  { title: 'Tempat & Lokasi', subtitle: 'ここは教室です (Di sini adalah ruang kelas)', has_video: false },
  4:  { title: 'Waktu & Waktu Kerja', subtitle: '今何時ですか (Sekarang jam berapa?)', has_video: false },
  5:  { title: 'Arah & Perpindahan', subtitle: 'どこへ行きますか (Pergi ke mana?)', has_video: true },
  6:  { title: 'Kegiatan Sehari-hari', subtitle: '水を飲みます (Minum air)', has_video: false },
  7:  { title: 'Pemberian & Alat', subtitle: 'スプーンで食べます (Makan dengan sendok)', has_video: false },
  8:  { title: 'Kata Sifat (Adjective)', subtitle: '富士山は高いです (Gunung Fuji tinggi)', has_video: false },
  9:  { title: 'Kesukaan & Keahlian', subtitle: '日本語が好きです (Suka bahasa Jepang)', has_video: false },
  10: { title: 'Keberadaan Benda/Orang', subtitle: '机の上に本があります (Ada buku di atas meja)', has_video: true },
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

  // Expanded bab accordions — all collapsed by default, user clicks to expand
  const [expandedBabs, setExpandedBabs]   = useState<Set<number>>(new Set())

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

    const handleSync = () => {
      fetchCourseData()
    }

    window.addEventListener(CHAPTER_UPDATE_EVENT, handleSync)
    window.addEventListener('storage', handleSync)
    const unsubscribeRealtime = subscribeToChapterRealtime(handleSync)

    return () => {
      window.removeEventListener(CHAPTER_UPDATE_EVENT, handleSync)
      window.removeEventListener('storage', handleSync)
      unsubscribeRealtime()
    }
  }, [user, selectedJilid])

  async function fetchCourseData() {
    setLoading(true)

    // 0. Fetch Admin Chapter Settings & Header Settings
    const [adminChapterMap, adminHeader] = await Promise.all([
      getChapterSettingsMap(),
      getCourseHeaderSettings(),
      new Promise(r => setTimeout(r, 1000)),
    ])
    setHeaderSettings(adminHeader)

    // 1. Fetch user's progress — DB is source of truth, scoped strictly per user ID
    const effectiveUserId = profile?.id || user?.id || null
    // NEVER use a shared 'active_global' key for logged-in users — it leaks
    // progress from previous users on the same device/browser.
    const storageKey = effectiveUserId
      ? `kaiwa_lesson_progress_${effectiveUserId}`
      : null

    let userProgress = new Map<string, { is_completed: boolean; replay_count: number }>()

    // Load from user-specific local storage (fast initial render)
    if (storageKey) {
      const savedLocal = localStorage.getItem(storageKey)
      if (savedLocal) {
        try {
          const parsedArr: [string, { is_completed: boolean; replay_count: number }][] = JSON.parse(savedLocal)
          parsedArr.forEach(([lId, val]) => userProgress.set(lId, val))
        } catch {}
      }
    }

    if (effectiveUserId) {
      // DB always wins — override stale localStorage values
      const { data: progressData } = await supabase
        .from('lesson_progress')
        .select('lesson_id, is_completed, replay_count')
        .eq('student_id', effectiveUserId)

      if (progressData) {
        progressData.forEach((p: any) => {
          const local = userProgress.get(p.lesson_id)
          userProgress.set(p.lesson_id, {
            is_completed: p.is_completed || false,
            replay_count: Math.max(p.replay_count || 0, local?.replay_count || 0),
          })
        })
      }
    }
    setProgressMap(userProgress)
    // Persist back only to user-specific key (never shared global key)
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(userProgress.entries())))
    }

    // 2. Fetch real database lessons from Supabase (if available)
    const { data: realLessons } = await supabase
      .from('lessons')
      .select('*')
      .order('order_index', { ascending: true })

    const realLessonMap = new Map<string, any>()
    if (realLessons) {
      realLessons.forEach((l: any) => {
        realLessonMap.set(l.id, l)
        realLessonMap.set(l.title?.toLowerCase(), l)
        realLessonMap.set(`bab_${l.bab_number}_video_${l.lesson_number}`, l)
      })
    }

    // 3. Generate 25 chapters for selected Jilid
    const startBab = selectedJilid === 1 ? 1 : 26
    const endBab   = selectedJilid === 1 ? 25 : 50
    const titlesMap = selectedJilid === 1 ? JILID_1_TITLES : JILID_2_TITLES

    const generatedChapters: ChapterItem[] = []

    for (let bab = startBab; bab <= endBab; bab++) {
      const info = titlesMap[bab] || { title: `Bab ${bab}`, subtitle: 'Materi Bahasa Jepang', has_video: false }
      const adminSetting = (adminChapterMap && typeof (adminChapterMap as any).get === 'function')
        ? (adminChapterMap as any).get(bab)
        : (adminChapterMap as any)?.[bab]

      const rawBabTitle = adminSetting?.title || info.title
      const cleanBabTitle = rawBabTitle.replace(/^(第\d+課|Bab\s+\d+):\s*/i, '').trim()

      const lessons: LessonItem[] = CHAPTER_ITEMS_CONFIG.map(item => {
        const lessonCode = `bab_${bab}_item_${item.num}`
        const dbLesson   = realLessonMap.get(lessonCode) || realLessonMap.get(`bab_${bab}_video_${item.num}`) || realLessonMap.get(`lesson_bab_${bab}_${item.num}`)
        
        const dbLessonId = dbLesson?.id || `lesson_bab_${bab}_${item.num}`
        const pState = userProgress.get(dbLessonId) || userProgress.get(`lesson_bab_${bab}_${item.num}`) || userProgress.get(`bab_${bab}_video_${item.num}`)

        const isCompleted  = pState?.is_completed || false
        const replayCount  = pState?.replay_count || 0
        const hostedUrl    = getHostedVideoUrl(bab, item.num)
        
        let customVideoOverride = null
        if (item.num === 1 && adminSetting?.video1_url) customVideoOverride = adminSetting.video1_url
        if (item.num === 2 && adminSetting?.video2_url) customVideoOverride = adminSetting.video2_url
        if (item.num === 3 && adminSetting?.video3_url) customVideoOverride = adminSetting.video3_url

        const videoUrl = customVideoOverride || dbLesson?.video_url || hostedUrl

        let baseTitle = ''
        if (item.num === 1 && adminSetting?.video1_title) baseTitle = adminSetting.video1_title
        else if (item.num === 2 && adminSetting?.video2_title) baseTitle = adminSetting.video2_title
        else if (item.num === 3 && adminSetting?.video3_title) baseTitle = adminSetting.video3_title
        else if (dbLesson?.title) baseTitle = dbLesson.title

        let lessonTitle = ''
        if (baseTitle) {
          lessonTitle = /part\s*\d+/i.test(baseTitle) ? baseTitle : `${baseTitle} - Part ${item.num <= 3 ? item.num : item.num - 3}`
        } else if (item.type === 'video') {
          lessonTitle = `${cleanBabTitle} - Part ${item.num}`
        } else if (item.type === 'quiz') {
          lessonTitle = `Kuis Evaluasi ${cleanBabTitle} - Part ${item.num - 3}`
        } else {
          lessonTitle = `${cleanBabTitle} - Part ${item.num}`
        }

        let durationText = item.duration.toString()
        if (item.num === 1 && adminSetting?.duration_s1) durationText = String(adminSetting.duration_s1)
        if (item.num === 2 && adminSetting?.duration_s2) durationText = String(adminSetting.duration_s2)
        if (item.num === 3 && adminSetting?.duration_s3) durationText = String(adminSetting.duration_s3)

        return {
          id: dbLessonId,
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
        ? adminSetting.title.startsWith(`第${bab}課:`) || adminSetting.title.startsWith(`Bab ${bab}:`)
          ? adminSetting.title.replace(/^Bab\s+(\d+):\s*/i, '第$1課: ')
          : `第${bab}課: ${adminSetting.title}`
        : `第${bab}課: ${info.title}`

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

  // Non-blocking background prefetch for video durations from Rumahweb server
  useEffect(() => {
    if (chapters.length === 0) return

    const checkLessons = chapters.flatMap(c => c.lessons).filter(l => l.content_type === 'video' && l.video_id && (!l.duration_text || l.duration_text === '15' || l.duration_text === '15.00' || l.duration_text === '12' || l.duration_text === '12.00'))

    if (checkLessons.length === 0) return

    let mounted = true
    checkLessons.forEach(async lesson => {
      if (!lesson.video_id) return
      try {
        const detected = await detectVideoDuration(lesson.video_id)
        if (!mounted) return
        setChapters(prevChapters =>
          prevChapters.map(chap => ({
            ...chap,
            lessons: chap.lessons.map(l => {
              if (l.id === lesson.id) {
                const mins = Math.ceil(parseFloat(detected) || l.duration_minutes)
                return { ...l, duration_text: detected, duration_minutes: mins }
              }
              return l
            }),
          }))
        )
      } catch {}
    })

    return () => {
      mounted = false
    }
  }, [chapters.length])

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
            window.scrollTo({ top: 0, behavior: 'instant' })
          } else if (chap.lessons.length > 0) {
            setActiveLesson(chap.lessons[0])
            window.scrollTo({ top: 0, behavior: 'instant' })
          }
        } else if (chap.lessons.length > 0) {
          setActiveLesson(chap.lessons[0])
          window.scrollTo({ top: 0, behavior: 'instant' })
        }
      }
    }
  }, [chapters, searchParams])

  async function handleToggleLessonComplete(lesson: LessonItem) {
    if (lesson.is_placeholder) return
    const newStatus = !lesson.is_completed
    const effectiveUserId = profile?.id || user?.id || null

    // 1. Update local progress map & local storage (per-user key only)
    const storageKey = effectiveUserId ? `kaiwa_lesson_progress_${effectiveUserId}` : null

    setProgressMap(prev => {
      const next = new Map(prev)
      const existing = next.get(lesson.id)
      next.set(lesson.id, {
        is_completed: newStatus,
        replay_count: existing?.replay_count || lesson.replay_count || 0,
      })
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(Array.from(next.entries())))
      return next
    })

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

    window.dispatchEvent(new Event('kaiwa_mission_progress_updated'))
    window.dispatchEvent(new Event('storage'))

    // 3. Update lesson_progress in Supabase if logged in
    if (effectiveUserId) {
      await supabase.from('lesson_progress').upsert({
        student_id: effectiveUserId,
        lesson_id: lesson.id,
        is_completed: newStatus,
        last_watched_at: new Date().toISOString(),
      }, { onConflict: 'student_id,lesson_id' })
    }

    // 4. Upsert overall course progress to Supabase enrollments table
    try {
      const courseId = selectedJilid === 1 ? 'minna-no-nihongo-1' : 'minna-no-nihongo-2'
      const updatedCompletedCount = chapters.reduce(
        (acc, c) => acc + c.lessons.filter(l => l.id === lesson.id ? newStatus : l.is_completed).length, 0
      )
      const newProgressPct = Math.min(100, Math.round((updatedCompletedCount / (25 * 5)) * 100))

      if (effectiveUserId) {
        await supabase.from('enrollments').upsert({
          student_id: effectiveUserId,
          course_id: courseId,
          progress_pct: newProgressPct,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'student_id,course_id' })
      }
    } catch (e) {
      console.warn('Course progress enrollments sync note:', e)
    }

    // 5. Update learning streak ONLY IF daily mission progress reaches 100%
    if (effectiveUserId) {
      try {
        const todayStr = getTodayDateString()
        const mission = (await fetchDailyMission(effectiveUserId, todayStr)) || getDailyMission(effectiveUserId, todayStr)
        if (mission) {
          await calculateMissionProgress(effectiveUserId, mission)
        }
      } catch (e) {
        console.warn('Streak 100% progress check note:', e)
      }
    }
  }

  async function handleIncrementReplay(lesson: LessonItem) {
    if (lesson.is_placeholder) return
    const currentReplay = lesson.replay_count || 0
    const newReplayCount = currentReplay + 1
    const effectiveUserId = profile?.id || user?.id || null

    // 1. Update local progress map & local storage (per-user key only)
    const storageKey = effectiveUserId ? `kaiwa_lesson_progress_${effectiveUserId}` : null

    setProgressMap(prev => {
      const next = new Map(prev)
      const existing = next.get(lesson.id)
      next.set(lesson.id, {
        is_completed: existing?.is_completed || lesson.is_completed || false,
        replay_count: newReplayCount,
      })
      if (storageKey) localStorage.setItem(storageKey, JSON.stringify(Array.from(next.entries())))
      return next
    })

    // 2. Update state & active lesson
    setChapters(prev =>
      prev.map(chap => ({
        ...chap,
        lessons: chap.lessons.map(l =>
          l.id === lesson.id ? { ...l, replay_count: newReplayCount } : l
        ),
      }))
    )

    setActiveLesson(prev => (prev ? { ...prev, replay_count: newReplayCount } : null))

    window.dispatchEvent(new Event('kaiwa_mission_progress_updated'))
    window.dispatchEvent(new Event('storage'))

    // 3. Update lesson_progress in Supabase if logged in
    if (effectiveUserId) {
      await supabase.from('lesson_progress').upsert({
        student_id: effectiveUserId,
        lesson_id: lesson.id,
        replay_count: newReplayCount,
        last_watched_at: new Date().toISOString(),
      }, { onConflict: 'student_id,lesson_id' })
    }
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
      `bab ${c.bab_number}`.includes(q) ||
      `第${c.bab_number}課`.toLowerCase().includes(q)
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
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">
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
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white rounded-2xl lg:rounded-[28px] px-6 py-8 sm:px-8 sm:py-10 lg:px-11 lg:py-12 mb-7 shadow-xl relative overflow-hidden animate-fade-in border border-rose-900/30">
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
              {t('dash_jilid_1_desc', 'Bab 1 s/d Bab 25 • 75 Video & 50 Kuis')}
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
              {t('dash_jilid_2_desc', 'Bab 26 s/d Bab 50 • 75 Video & 50 Kuis')}
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
        <CourseCardSkeleton count={5} />
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
                        {chap.title.replace(/^Bab\s+(\d+):\s*/i, '第$1課: ')}
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
                              <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white leading-snug line-clamp-2 mb-1">
                                {lesson.title}
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
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[500] flex items-center justify-center p-1.5 sm:p-6 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[96vh] sm:h-[92vh] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">

            {/* Modal Header */}
            <div className="px-4 py-2.5 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="min-w-0 pr-2">
                <span className="text-[0.65rem] sm:text-xs text-primary-lighter font-bold uppercase tracking-wider block truncate">
                  {activeChapter?.title || `Minna no Nihongo Jilid ${selectedJilid}`}
                </span>
                <h2 className="text-sm sm:text-lg font-bold truncate leading-tight">{activeLesson.title}</h2>
              </div>
              <button
                onClick={() => { setActiveLesson(null); setActiveChapter(null) }}
                className="size-8 sm:size-9 rounded-full bg-white/10 text-white hover:bg-white/20 border-none cursor-pointer text-lg sm:text-xl flex items-center justify-center shrink-0"
              >
                ×
              </button>
            </div>

            {/* Modal Body: Left Player | Right Lessons list */}
            {/* On mobile: stack with toggle button. On lg+: side-by-side columns */}
            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_320px] overflow-hidden">

              {/* Left Column: Video Player / Kotoba View / Quiz View / Placeholder */}
              <div className="flex flex-col overflow-y-auto p-2 sm:p-6 gap-2 sm:gap-4 flex-1">

                {/* Mobile-only: Toggle button for lesson list */}
                <div className="lg:hidden flex items-center justify-between shrink-0 py-0.5 px-1">
                  <p className="text-[0.7rem] text-slate-500 font-semibold truncate">
                    📚 {activeChapter?.lessons.length || 0} Materi di Bab Ini
                  </p>
                  <button
                    onClick={() => setShowLessonList(prev => !prev)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[0.7rem] font-bold border-none cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <span>📋 Daftar Materi</span>
                    <span>{showLessonList ? '▲' : '▼'}</span>
                  </button>
                </div>

                {/* Mobile-only: Collapsible lesson list (shows when toggled) */}
                {showLessonList && (
                  <div className="lg:hidden animate-slide-down bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 p-2.5 flex flex-col gap-1.5 shrink-0">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-[0.65rem] uppercase tracking-wider mb-0.5">
                      Materi {activeChapter?.title || 'Bab Ini'}
                    </h4>
                    {activeChapter?.lessons.map(l => (
                      <button
                        key={l.id}
                        onClick={() => { setActiveLesson(l); setShowLessonList(false) }}
                        className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                          activeLesson?.id === l.id
                            ? 'bg-white dark:bg-slate-900 border-primary shadow-xs text-primary'
                            : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white'
                        }`}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="text-xs font-bold truncate">{l.title}</div>
                          <div className="text-[0.65rem] text-slate-400 mt-0.5">
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
                  <div className="w-full rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-orange-500/10 border border-amber-200 p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 shadow-sm shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 sm:size-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-black shadow-md">
                          🔤
                        </div>
                        <div>
                          <span className="text-[0.65rem] sm:text-xs font-bold text-amber-700 uppercase tracking-wider">Setoran Kotoba</span>
                          <h3 className="text-sm sm:text-lg font-extrabold text-slate-800 leading-tight">
                            Setoran Kosakata Bahasa Jepang — {activeChapter?.title}
                          </h3>
                        </div>
                      </div>
                      <span className="text-[0.65rem] sm:text-xs font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full">
                        ⏱️ Est. 10 Menit
                      </span>
                    </div>

                    <p className="text-[0.7rem] sm:text-xs text-slate-600 leading-relaxed">
                      Hafalkan kosakata dasar bab ini sebelum melanjutkan ke video tata bahasa. Kamu dapat mencocokkan kata Jepang dan artinya!
                    </p>

                    {/* Sample Interactive Vocabulary Card */}
                    <div className="bg-white rounded-2xl p-3 sm:p-4 border border-amber-200/80 shadow-xs flex flex-col gap-2.5">
                      <div className="text-[0.65rem] sm:text-xs font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
                        Daftar Kosakata Bab {activeChapter?.bab_number}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                          <div key={idx} className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-100 flex justify-between items-center text-xs">
                            <span className="font-extrabold text-slate-800 text-xs sm:text-sm">{item.kana}</span>
                            <span className="font-bold text-amber-700 bg-white px-2 py-0.5 rounded-lg border border-amber-200 text-[0.68rem]">{item.arti}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[0.7rem] font-semibold text-slate-500">
                        {activeLesson.is_completed ? '🎉 Status: Sudah Disetor' : '⚡ Hafalkan lalu tandai selesai!'}
                      </span>
                      <button
                        onClick={() => handleToggleLessonComplete(activeLesson)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border-none cursor-pointer transition-all ${
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
                  <div className="w-full rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-800/60 p-4 sm:p-8 flex flex-col items-center justify-center text-center gap-3 sm:gap-4 shadow-xl shrink-0 min-h-[300px] relative overflow-hidden">
                    {/* Ambient Glow */}
                    <div className="absolute inset-0 bg-indigo-500/10 blur-3xl pointer-events-none" />

                    <div className="size-12 sm:size-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-2xl sm:text-3xl shadow-lg relative z-10">
                      🎯
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[0.65rem] sm:text-[0.7rem] font-extrabold uppercase tracking-wider text-amber-300 relative z-10">
                      <span>⏳ Fitur Kuis Coming Soon</span>
                    </div>

                    <div className="relative z-10 max-w-md">
                      <h3 className="text-base sm:text-xl font-extrabold text-white mb-1">
                        Kuis Evaluasi — {activeChapter?.title}
                      </h3>
                      <p className="text-[0.7rem] sm:text-xs text-slate-300 leading-relaxed font-medium">
                        Soal kuis pilihan ganda untuk Bab ini sedang dalam tahap penyusunan & validasi oleh pengajar. Kamu bisa mempelajari video & setoran kotoba terlebih dahulu!
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-[0.7rem] text-indigo-200 max-w-md w-full relative z-10 flex flex-col gap-0.5 text-left">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <span>💡 Info Pengajar:</span>
                      </span>
                      <span>Target Kuis: 10 Soal Pilihan Ganda (Passing Grade 80%)</span>
                    </div>
                  </div>
                ) : activeLesson.video_id ? (
                  /* Real HTML5 Portrait Video Player — optimized for 100% mobile fit */
                  <div className="w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 rounded-2xl sm:rounded-3xl p-2 sm:p-5 flex flex-col items-center justify-center shadow-xl border border-slate-800 shrink-0 relative overflow-hidden flex-1">
                    {/* Ambient Glow */}
                    <div className="absolute inset-0 bg-primary/5 blur-3xl pointer-events-none" />

                    {/* Header Badge */}
                    <div className="flex items-center gap-1.5 mb-2 z-10 text-[0.65rem] sm:text-[0.7rem] font-bold text-slate-400 uppercase tracking-wider bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                      <span>📱 Format Video Mobile (Portrait 9:16)</span>
                    </div>

                    {/* Portrait Phone Frame — scaled down on small mobile screens to fit 100% without scroll */}
                    <div
                      className="w-full max-w-[270px] xs:max-w-[300px] sm:max-w-[340px] rounded-2xl overflow-hidden bg-black shadow-2xl border-2 sm:border-4 border-slate-800 relative z-10 group"
                      style={{ aspectRatio: '9/16', maxHeight: 'min(48vh, 520px)' }}
                    >
                      <SmartVideoPlayer
                        lesson={activeLesson}
                        chapterBab={activeChapter?.bab_number || 1}
                        onLoadedMetadata={totalSecs => {
                          const mins = Math.floor(totalSecs / 60)
                          const secs = Math.floor(totalSecs % 60)
                          const formatted = `${mins}.${String(secs).padStart(2, '0')}`
                          if (activeLesson) {
                            activeLesson.duration_text = formatted
                            activeLesson.duration_minutes = Math.ceil(totalSecs / 60)
                          }
                        }}
                        onEnded={() => {
                          handleIncrementReplay(activeLesson)
                          if (!activeLesson.is_completed) {
                            handleToggleLessonComplete(activeLesson)
                          }
                        }}
                      />
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
                    <p className="text-xs text-slate-300 max-w-sm leading-relaxed">
                      Video materi ini sedang dalam tahap perekaman/upload oleh admin. Kamu tetap bisa mencatat judul bab dan lanjut ke video berikutnya!
                    </p>
                  </div>
                )}

                {/* Lesson Details */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">{activeLesson.title}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-0.5">
                      ⏱️ Estimasi Durasi: {activeLesson.duration_minutes} menit • Diulang {activeLesson.replay_count || 0} kali
                    </p>
                  </div>
                  {activeLesson.is_completed && (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold flex items-center gap-1.5 self-start sm:self-center">
                      ✓ Video Selesai Ditonton
                    </span>
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
