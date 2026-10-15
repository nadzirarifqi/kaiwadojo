import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../contexts/LanguageContext'
import {
  getChapterSettingsMap,
  getCourseHeaderSettings,
  CHAPTER_UPDATE_EVENT,
  subscribeToChapterRealtime,
  isChapterAccessibleForUser,
  parseTargetGroups,
  type CourseHeaderSettings,
} from '../lib/chapterService'
import { fetchGroups, type KaiwaGroup, GROUP_UPDATE_EVENT } from '../lib/groupService'
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
  target_group?: string | null
  lessons: LessonItem[]
}

/* ── Standard 5 Items for each Bab in Minna no Nihongo (3 Video + 2 Kuis) ── */
const CHAPTER_ITEMS_CONFIG = [
  { num: 1, title: 'Video 1: Tata Bahasa Bagian 1 (Bunpou A)', icon: 'video', type: 'video' as const, duration: 15, badge: 'Video 1' },
  { num: 2, title: 'Video 2: Tata Bahasa Bagian 2 (Bunpou B)', icon: 'video', type: 'video' as const, duration: 15, badge: 'Video 2' },
  { num: 3, title: 'Video 3: Percakapan & Penerapan (Kaiwa)',  icon: 'video', type: 'video' as const, duration: 12, badge: 'Video 3' },
  { num: 4, title: 'Kuis Evaluasi 1: Tata Bahasa & Bunpou',  icon: 'quiz',  type: 'quiz'  as const, duration: 10, badge: 'Kuis 1'  },
  { num: 5, title: 'Kuis Evaluasi 2: Pemahaman & Kaiwa',     icon: 'quiz',  type: 'quiz'  as const, duration: 10, badge: 'Kuis 2'  },
]

/* ── Helper to map hosted video files in /kaiwa-1-courses/ or /kaiwa-2-courses/ ── */
function getHostedVideoUrl(babNumber: number, itemNum: number): string | null {
  // Only items 1, 2, 3 are video lessons (S1, S2, S3)
  if (itemNum > 3) return null

  const jilidPath = babNumber <= 25 ? '/kaiwa-1-courses' : '/kaiwa-2-courses'
  const folderName = `BAB ${babNumber}`
  const fileNameMov = `Kaiwa Dojo - BAB ${babNumber} S${itemNum}.mov`

  return `${jilidPath}/${encodeURIComponent(folderName)}/${encodeURIComponent(fileNameMov)}`
}

function getVideoUrlCandidates(originalUrl: string | null, babNumber: number, itemNum: number): string[] {
  const candidates: string[] = []

  if (originalUrl) {
    candidates.push(originalUrl)
    if (originalUrl.toLowerCase().endsWith('.mov')) {
      candidates.push(originalUrl.replace(/\.mov$/i, '.MOV'))
      candidates.push(originalUrl.replace(/\.mov$/i, '.mp4'))
      candidates.push(originalUrl.replace(/\.mov$/i, '.MP4'))
    } else if (originalUrl.toLowerCase().endsWith('.mp4')) {
      candidates.push(originalUrl.replace(/\.mp4$/i, '.mov'))
      candidates.push(originalUrl.replace(/\.mp4$/i, '.MOV'))
      candidates.push(originalUrl.replace(/\.mp4$/i, '.MP4'))
    }
  }

  const jilidPath = babNumber <= 25 ? '/kaiwa-1-courses' : '/kaiwa-2-courses'
  const folderName = `BAB ${babNumber}`
  const encFolder = encodeURIComponent(folderName)

  const names = [
    // Primary — exact standard name (.mov / uppercase "BAB")
    `Kaiwa Dojo - BAB ${babNumber} S${itemNum}.mov`,
    `Kaiwa Dojo - BAB ${babNumber} S${itemNum}.MOV`,
    `Kaiwa Dojo - Bab ${babNumber} S${itemNum}.mov`,
    `Kaiwa Dojo - Bab ${babNumber} S${itemNum}.MOV`,
    // Fallback — mp4 variant
    `Kaiwa Dojo - BAB ${babNumber} S${itemNum}.mp4`,
    `Kaiwa Dojo - BAB ${babNumber} S${itemNum}.MP4`,
    `Kaiwa Dojo - Bab ${babNumber} S${itemNum}.mp4`,
    `Kaiwa Dojo - Bab ${babNumber} S${itemNum}.MP4`,
  ]

  names.forEach(name => {
    const encUrl = `${jilidPath}/${encFolder}/${encodeURIComponent(name)}`
    const rawUrl = `${jilidPath}/${folderName}/${name}`
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
  const candidates = useMemo(
    () => getVideoUrlCandidates(lesson.video_id, chapterBab, lesson.lesson_number),
    [lesson.video_id, chapterBab, lesson.lesson_number]
  )
  const [candidateIdx, setCandidateIdx] = useState<number>(0)
  const [hasFailedAll, setHasFailedAll] = useState<boolean>(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // Reset index and error state whenever the target lesson changes
  useEffect(() => {
    setCandidateIdx(0)
    setHasFailedAll(false)
  }, [lesson.id, lesson.video_id, lesson.lesson_number, chapterBab])

  const currentUrl = candidates[candidateIdx] || lesson.video_id || ''

  // Explicitly call load() on HTML5 video element when currentUrl changes
  useEffect(() => {
    if (videoRef.current && currentUrl) {
      videoRef.current.load()
    }
  }, [currentUrl])

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
        <div className="size-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
          Format Video Perlu Penyesuaian
        </h4>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Semua ekstensi (.mp4, .MP4, .mov) telah dicoba. Harap pastikan format HandBrake sesuai standar web browser:
        </p>

        <div className="w-full p-3 rounded-xl bg-black/60 border border-slate-800 text-xs sm:text-sm text-left flex flex-col gap-1 text-slate-300 font-mono">
          <span className="font-bold text-amber-400 flex items-center gap-1.5">
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Format HandBrake Wajib:</span>
          </span>
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
          className="px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs sm:text-sm border-none cursor-pointer hover:bg-primary-dark transition-all flex items-center gap-2"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Coba Ulang Pemutaran</span>
        </button>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      key={currentUrl}
      src={currentUrl}
      controls
      autoPlay
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
    icon: '富士',
    kanji: '富士山',
    title: 'Gunung Fuji Sakral & Aktif',
    fact: 'Gunung Fuji (3.776m) adalah simbol sakral Jepang yang sebenarnya merupakan gunung berapi aktif dan dikelilingi 5 danau eksotis!',
    tag: '#GeografiJepang',
  },
  {
    icon: '新幹',
    kanji: '新幹線',
    title: 'Kecepatan & Presisi Shinkansen',
    fact: 'Rata-rata keterlambatan tahunan kereta cepat Shinkansen kurang dari 1 menit! Bukti ketepatan waktu budaya Jepang yang luar biasa.',
    tag: '#TeknologiJepang',
  },
  {
    icon: '桜',
    kanji: '花見',
    title: 'Tradisi Hanami 1.000 Tahun',
    fact: 'Piknik Hanami (menikmati bunga Sakura mekar) sudah mentradisi sejak Zaman Heian (794 M). Bunga mekar melambangkan keindahan yang sementara.',
    tag: '#BudayaJepang',
  },
  {
    icon: '鳥居',
    kanji: '鳥居',
    title: 'Gerbang Torii Merah Kuil Shinto',
    fact: 'Gerbang Torii merah melambangkan batas spiritual antara dunia manusia dan kawasan suci para Kami (dewa) di kuil Shinto.',
    tag: '#SejarahJepang',
  },
  {
    icon: '自動',
    kanji: '自動販売機',
    title: '5 Juta Mesin Penjual Otomatis',
    fact: 'Jepang memiliki lebih dari 5 juta Jidouhanbaiki (Vending Machine). Kamu bisa membeli kopi hangat, es krim, bahkan sup di pinggir jalan!',
    tag: '#KehidupanJepang',
  },
  {
    icon: '心',
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
    page_title: 'Buku Kursus Minna no Nihongo',
    page_subtitle: 'Pilih jilid buku dan pelajari 5 video materi + 1 kuis di setiap babnya',
  })

  // Fun Fact State
  const [funFactIndex, setFunFactIndex]   = useState(0)

  // State Tabs
  const [selectedJilid, setSelectedJilid] = useState<1 | 2>(1)
  const [chapters, setChapters]           = useState<ChapterItem[]>([])
  const [groups, setGroups]               = useState<KaiwaGroup[]>([])
  const [loading, setLoading]             = useState(true)
  const [searchBab, setSearchBab]         = useState('')

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

  /* ── Load Course Data from Supabase & Subscribe to Realtime Updates ── */
  useEffect(() => {
    fetchCourseData(false)

    // 1. Instant local window event sync (for same browser / role switcher / multi-tabs / focus)
    const handleSync = () => {
      fetchCourseData(true)
    }
    window.addEventListener(CHAPTER_UPDATE_EVENT, handleSync)
    window.addEventListener(GROUP_UPDATE_EVENT, handleSync)
    window.addEventListener('kaiwa_profile_updated', handleSync)
    window.addEventListener('storage', handleSync)
    window.addEventListener('focus', handleSync)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCourseData(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    const unsubscribeChapterRealtime = subscribeToChapterRealtime(handleSync)

    // 2. Realtime listener for lesson_progress across all user devices
    const effectiveUserId = profile?.id || user?.id || null
    const progressChannelId = 'my_courses_progress_' + (effectiveUserId || 'guest') + '_' + Math.random().toString(36).slice(2)
    const progressChannel = supabase
      .channel(progressChannelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_progress' }, () => {
        fetchCourseData(true)
      })
      .subscribe()

    // 3. Fallback polling every 6 seconds to ensure instant sync even if WebSocket reconnects
    const pollInterval = setInterval(() => {
      fetchCourseData(true)
    }, 6000)

    return () => {
      window.removeEventListener(CHAPTER_UPDATE_EVENT, handleSync)
      window.removeEventListener(GROUP_UPDATE_EVENT, handleSync)
      window.removeEventListener('kaiwa_profile_updated', handleSync)
      window.removeEventListener('storage', handleSync)
      window.removeEventListener('focus', handleSync)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(pollInterval)
      unsubscribeChapterRealtime()
      supabase.removeChannel(progressChannel)
    }
  }, [user, profile?.id, profile?.role, selectedJilid])

  async function fetchCourseData(silent = false) {
    if (!silent) {
      setLoading(true)
    }

    // 0. Fetch Admin Chapter Settings, Header Settings & Groups
    const [adminChapterMap, adminHeader, groupList] = await Promise.all([
      getChapterSettingsMap(),
      getCourseHeaderSettings(),
      fetchGroups(true),
    ])
    setHeaderSettings(adminHeader)
    setGroups(groupList)

    // 1. Fetch user's progress — DB is source of truth, scoped strictly per user ID
    const effectiveUserId = profile?.id || user?.id || null
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

      const dbMap = new Map<string, { is_completed: boolean; replay_count: number }>()
      if (progressData) {
        progressData.forEach((p: any) => {
          if (p.lesson_id) {
            dbMap.set(p.lesson_id, {
              is_completed: p.is_completed || false,
              replay_count: p.replay_count || 0,
            })
          }
        })
      }

      // Reconcile: check if there are local completed items not yet in DB (e.g. from previous offline sessions)
      const toSyncToDb: any[] = []
      userProgress.forEach((localVal, lessonId) => {
        if (localVal.is_completed && !dbMap.has(lessonId)) {
          toSyncToDb.push({
            student_id: effectiveUserId,
            lesson_id: lessonId,
            is_completed: true,
            replay_count: localVal.replay_count || 1,
            last_watched_at: new Date().toISOString(),
          })
          dbMap.set(lessonId, localVal)
        }
      })

      if (toSyncToDb.length > 0) {
        supabase.from('lesson_progress').upsert(toSyncToDb, { onConflict: 'student_id,lesson_id' }).then(() => {})
      }

      // Overwrite userProgress map with authoritative DB records
      dbMap.forEach((val, key) => {
        userProgress.set(key, val)
      })
    }
    setProgressMap(userProgress)
    // Persist back to user-specific key
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
        if (item.num === 1) customVideoOverride = adminSetting?.custom_video_s1 || adminSetting?.video1_url || null
        if (item.num === 2) customVideoOverride = adminSetting?.custom_video_s2 || adminSetting?.video2_url || null
        if (item.num === 3) customVideoOverride = adminSetting?.custom_video_s3 || adminSetting?.video3_url || null

        const videoUrl = customVideoOverride || dbLesson?.video_url || hostedUrl

        let customVideoTitle = ''
        if (item.num === 1 && adminSetting?.video1_title) customVideoTitle = adminSetting.video1_title
        else if (item.num === 2 && adminSetting?.video2_title) customVideoTitle = adminSetting.video2_title
        else if (item.num === 3 && adminSetting?.video3_title) customVideoTitle = adminSetting.video3_title

        let lessonTitle = ''
        if (customVideoTitle && !customVideoTitle.toLowerCase().startsWith('video ')) {
          lessonTitle = /part\s*\d+/i.test(customVideoTitle) ? customVideoTitle : `${customVideoTitle} - Part ${item.num <= 3 ? item.num : item.num - 3}`
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
        target_group: adminSetting?.target_group || null,
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
      const chap = chapters.find(c => c.bab_number === babNum)
      if (chap) {
        const isAccessible = isChapterAccessibleForUser(chap, profile, groups)
        if (!isAccessible && !isInstructor) {
          setAlertConfig({
            isOpen: true,
            title: 'Materi Tidak Tersedia',
            message: `Bab ${babNum} saat ini tidak tersedia untuk akun Anda.`,
            type: 'lock',
            buttonText: 'Kembali',
            onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
          })
          return
        }

        setExpandedBabs(prev => new Set(prev).add(babNum))
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
  }, [chapters, searchParams, profile, groups, isInstructor])

  // Automatically scroll to top whenever a lesson/video modal opens
  useEffect(() => {
    if (activeLesson) {
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
  }, [activeLesson])

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

      try {
        const todayStr = getTodayDateString()
        const mission = (await fetchDailyMission(effectiveUserId, todayStr)) || getDailyMission(effectiveUserId, todayStr)
        if (mission) {
          await calculateMissionProgress(effectiveUserId, mission)
        }
      } catch (e) {
        console.warn('Streak replay progress sync note:', e)
      }
    }
  }

  // Auto refresh state for smooth video player transitions
  const [isVideoRefreshing, setIsVideoRefreshing] = useState(false)
  const [videoKey, setVideoKey] = useState(0)

  function handleSwitchLesson(newLesson: LessonItem) {
    if (newLesson.id === activeLesson?.id && !isVideoRefreshing) return

    // Briefly unmount and refresh the video player to reload cleanly and smoothly
    setIsVideoRefreshing(true)
    setActiveLesson(newLesson)
    setVideoKey(prev => prev + 1)

    setTimeout(() => {
      setIsVideoRefreshing(false)
    }, 150)
  }

  function toggleBabAccordion(babNum: number) {
    const chap = chapters.find(c => c.bab_number === babNum)
    if (chap && !isInstructor && !isChapterAccessibleForUser(chap, profile, groups)) {
      setAlertConfig({
        isOpen: true,
        title: 'Materi Tidak Tersedia',
        message: `Bab ${babNum} saat ini tidak tersedia untuk akun Anda.`,
        type: 'lock',
        buttonText: 'Mengerti',
        onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
      })
      return
    }

    setExpandedBabs(prev => {
      const next = new Set(prev)
      if (next.has(babNum)) next.delete(babNum)
      else next.add(babNum)
      return next
    })
  }

  /* ── Filter Chapters ─────────────────────────────── */
  const shouldHideUnreleased = !isInstructor || (profile?.role === 'admin' && adminStudentViewMode)

  const filteredChapters = chapters.filter(c => {
    // If student OR if admin is in adminStudentViewMode: hide if marked hidden by Admin
    if (shouldHideUnreleased && c.is_hidden) return false

    // If student view, filter out group-restricted chapters the user cannot access
    if (shouldHideUnreleased && !isChapterAccessibleForUser(c, profile, groups)) {
      return false
    }

    if (!searchBab.trim()) return true
    const q = searchBab.toLowerCase()
    const targetList = parseTargetGroups(c.target_group)
    return (
      c.title.toLowerCase().includes(q) ||
      c.subtitle.toLowerCase().includes(q) ||
      `bab ${c.bab_number}`.includes(q) ||
      `第${c.bab_number}課`.toLowerCase().includes(q) ||
      (!shouldHideUnreleased && targetList.some(g => g.toLowerCase().includes(q)))
    )
  })

  // Calculate total progress (based on chapters accessible/visible to the user)
  const totalLessonsCount     = filteredChapters.reduce((acc, c) => acc + c.lessons.length, 0)
  const completedLessonsCount = filteredChapters.reduce(
    (acc, c) => acc + c.lessons.filter(l => l.is_completed).length, 0
  )
  const totalProgressPct      = totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0

  const currentFact = JAPAN_FUN_FACTS[funFactIndex]
  const currentLessonIdx = activeChapter?.lessons.findIndex(l => l.id === activeLesson?.id) ?? -1
  const prevLesson = currentLessonIdx > 0 && activeChapter ? activeChapter.lessons[currentLessonIdx - 1] : null
  const nextLesson = currentLessonIdx >= 0 && activeChapter && currentLessonIdx < activeChapter.lessons.length - 1
    ? activeChapter.lessons[currentLessonIdx + 1]
    : null

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-x-clip animate-page-slide">
      {/* Admin Preview Control Bar */}
      {profile?.role === 'admin' && (
        <div className="mb-5 p-3.5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs sm:text-sm font-bold flex items-center gap-1.5">
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>Preview Tampilan Pelajar</span>
            </span>
            <span className="text-xs sm:text-sm font-medium text-slate-300">
              {adminStudentViewMode
                ? 'Menampilkan daftar bab persis seperti yang dilihat oleh Siswa (Bab Sembunyi & Bab luar grup disaring).'
                : 'Menampilkan seluruh 50 Bab (Termasuk Bab yang disembunyikan / khusus grup).'}
            </span>
          </div>
          <button
            onClick={() => setAdminStudentViewMode(!adminStudentViewMode)}
            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold transition-all border border-white/20 cursor-pointer shrink-0 flex items-center gap-1.5"
          >
            {adminStudentViewMode ? (
              <>
                <svg className="size-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Mode Full Admin</span>
              </>
            ) : (
              <>
                <svg className="size-3.5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <span>Mode Tampilan Pelajar</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Hero Section: Japan Fun Facts Banner */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-indigo-950 text-white rounded-xl sm:rounded-2xl p-3 sm:p-4.5 mb-4 sm:mb-6 shadow-md relative overflow-hidden animate-fade-in border border-rose-900/30 min-h-[145px] sm:min-h-[160px] flex flex-col justify-between">
        {/* Background Kanji Watermark */}
        <div className="absolute right-2 -bottom-3 sm:right-3 sm:-bottom-4 text-sm sm:text-base scale-[5] sm:scale-[7] origin-bottom-right font-bold text-rose-500/5 select-none pointer-events-none leading-none font-japanese">
          {currentFact.kanji}
        </div>
        <div className="absolute -left-10 -top-10 size-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-2.5 sm:gap-4 flex-1">
          <div className="flex-1 min-w-0 w-full">
            {/* Tag Badge */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs sm:text-sm font-bold uppercase tracking-wider bg-rose-500/80 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                <span className="font-japanese text-xs sm:text-sm">日</span>
                <span>{t('mc_trivia_title', 'Japan Trivia & Fun Fact')}</span>
              </span>
              <span className="text-xs sm:text-sm font-semibold text-rose-200/80 bg-white/10 px-1.5 py-0.2 rounded-full">
                {currentFact.tag}
              </span>
            </div>

            {/* Kanji & Title */}
            <div className="flex items-center gap-2 mb-1 min-h-[24px] sm:min-h-[28px]">
              <span className="size-7 sm:size-8 rounded-lg bg-rose-500/20 text-rose-300 font-serif font-black text-sm sm:text-base flex items-center justify-center border border-rose-500/30 shrink-0 font-japanese">
                {currentFact.kanji.charAt(0)}
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white leading-tight truncate">
                {currentFact.title} <span className="text-rose-300 font-serif text-xs sm:text-sm ml-1 font-normal">({currentFact.kanji})</span>
              </h2>
            </div>

            {/* Fact Text */}
            <div className="bg-black/25 p-2 sm:p-2.5 rounded-lg sm:rounded-xl border border-white/10 min-h-[46px] sm:min-h-[48px] flex items-center">
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-2xl line-clamp-2">
                "{currentFact.fact}"
              </p>
            </div>
          </div>

          {/* Fact Nav Controls & Dots */}
          <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 shrink-0 w-full md:w-auto pt-1.5 md:pt-0 border-t md:border-t-0 border-white/10">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setFunFactIndex(prev => (prev === 0 ? JAPAN_FUN_FACTS.length - 1 : prev - 1))}
                className="size-6.5 sm:size-7.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer flex items-center justify-center text-xs sm:text-sm font-bold transition-all"
                title="Fun Fact Sebelumnya"
              >
                &lt;
              </button>
              <button
                type="button"
                onClick={() => setFunFactIndex(Math.floor(Math.random() * JAPAN_FUN_FACTS.length))}
                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white border-none cursor-pointer text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-1"
                title="Acak Fun Fact"
              >
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Acak Fact</span>
              </button>
              <button
                type="button"
                onClick={() => setFunFactIndex(prev => (prev + 1) % JAPAN_FUN_FACTS.length)}
                className="size-6.5 sm:size-7.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 cursor-pointer flex items-center justify-center text-xs sm:text-sm font-bold transition-all"
                title="Fun Fact Selanjutnya"
              >
                &gt;
              </button>
            </div>

            {/* Dots Indicator */}
            <div className="flex items-center gap-1">
              {JAPAN_FUN_FACTS.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setFunFactIndex(idx)}
                  className={`h-1 rounded-full border-none cursor-pointer transition-all ${
                    idx === funFactIndex ? 'bg-rose-400 w-3.5 sm:w-4' : 'bg-white/30 hover:bg-white/60 w-1'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="mb-4 sm:mb-6 animate-fade-in-up flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white tracking-tight mb-0.5 leading-tight">
            {t('mc_title', headerSettings.page_title)}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t('mc_subtitle', headerSettings.page_subtitle)}
          </p>
        </div>

        {isInstructor && (
          <button
            onClick={() => navigate('/kelola-kursus')}
            className="px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-gradient-to-r from-primary to-primary-light hover:from-primary-dark hover:to-primary text-white text-xs sm:text-sm font-bold border-none cursor-pointer shadow-xs transition-all shrink-0 flex items-center justify-center gap-1.5 hover:-translate-y-0.5 group min-h-[28px] sm:min-h-[32px]"
          >
            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Edit Judul & Visibilitas</span>
          </button>
        )}
      </div>

      {/* ── Book Selector Tabs (Jilid 1 vs Jilid 2) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 mb-4 sm:mb-6">
        <button
          onClick={() => setSelectedJilid(1)}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left cursor-pointer transition-all flex items-center gap-3 ${
            selectedJilid === 1
              ? 'bg-gradient-to-br from-primary to-primary-light text-white border-primary shadow-md scale-[1.005]'
              : 'bg-white border-slate-200 text-slate-700 hover:border-primary/40 hover:bg-slate-50 shadow-xs'
          }`}
        >
          <div className={`size-10 sm:size-12 rounded-xl flex items-center justify-center text-sm sm:text-base font-bold shrink-0 ${
            selectedJilid === 1 ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
          }`}>
            <span className="font-japanese text-sm sm:text-base">一</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className={`text-xs sm:text-sm font-bold uppercase tracking-wider mb-0.5 ${selectedJilid === 1 ? 'text-white/80' : 'text-slate-400'}`}>
              {t('dash_jilid_1_title', 'Jilid 1 (Dasar I)')}
            </div>
            <div className="text-xs sm:text-sm font-bold truncate leading-tight">
              {t('course_title_vol1', 'Bahasa Jepang Dasar (Jilid 1)')}
            </div>
            <div className={`text-xs sm:text-sm font-medium mt-0.5 ${selectedJilid === 1 ? 'text-white/90' : 'text-slate-500'}`}>
              {t('dash_jilid_1_desc', 'Bab 1 s/d Bab 25 • 75 Video & 50 Kuis')}
            </div>
          </div>
          {selectedJilid === 1 && (
            <span className="size-5 rounded-full bg-white/20 flex items-center justify-center shrink-0 text-white">
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
        </button>

        <div
          className="p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-left transition-all flex items-center gap-3 relative overflow-hidden opacity-70 cursor-not-allowed bg-slate-50 border-slate-200 shadow-xs select-none"
        >
          {/* Coming Soon Ribbon */}
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-amber-400 text-amber-900 text-xs sm:text-sm font-bold uppercase tracking-wider px-2 py-0.2 rounded-full shadow-xs">
            <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Coming Soon</span>
          </div>
          <div className="size-10 sm:size-12 rounded-xl flex items-center justify-center text-sm sm:text-base font-bold shrink-0 bg-slate-100 text-slate-400 grayscale font-japanese">
            二
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs sm:text-sm font-bold uppercase tracking-wider mb-0.5 text-slate-400">
              {t('dash_jilid_2_title', 'Jilid 2 (Dasar II)')}
            </div>
            <div className="text-xs sm:text-sm font-bold truncate leading-tight text-slate-500">
              {t('course_title_vol2', 'Bahasa Jepang Menengah (Jilid 2)')}
            </div>
            <div className="text-xs sm:text-sm font-medium mt-0.5 text-slate-400">
              Segera Hadir • Bab 26 s/d Bab 50
            </div>
          </div>
        </div>
      </div>

      {/* ── Progress & Filter Bar (only Jilid 1) ── */}
      {selectedJilid === 1 && (
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
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder={t('mc_search_placeholder', 'Cari bab atau materi...')}
              value={searchBab}
              onChange={e => setSearchBab(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm outline-none focus:border-primary bg-slate-50 font-medium"
            />
          </div>
        </div>
      )}

      {/* ── Coming Soon Panel (Jilid 2) ── */}
      {selectedJilid === 2 && (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-white rounded-3xl border border-slate-200 shadow-sm text-center gap-5">
          <div className="relative">
            <div className="size-24 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-sm sm:text-base text-white shadow-lg font-japanese font-bold">
              二
            </div>
            <div className="absolute -top-2 -right-2 bg-amber-400 text-amber-900 text-xs sm:text-sm font-bold uppercase tracking-widest px-2.5 py-1 rounded-full shadow border border-amber-300">
              Coming Soon
            </div>
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800 mb-2">
              Minna no Nihongo — Jilid 2
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-sm mx-auto leading-relaxed">
              Materi <strong>Bab 26 s/d Bab 50</strong> sedang dalam persiapan oleh tim kaiwadojo.<br />
              Selesaikan materi Jilid 1 terlebih dahulu untuk membuka akses.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-xs sm:text-sm font-bold text-slate-400">
            {[26,27,28,29,30,31,32,33,34,35].map(n => (
              <span key={n} className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 grayscale opacity-60">
                第{n}課
              </span>
            ))}
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-300">…+15 Bab</span>
          </div>
          <button
            onClick={() => setSelectedJilid(1)}
            className="mt-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-primary to-primary-light text-white font-bold text-xs sm:text-sm border-none cursor-pointer hover:opacity-90 active:scale-95 transition-all shadow-md flex items-center gap-2 group mx-auto"
          >
            <span className="size-4.5 rounded-full bg-white/20 flex items-center justify-center text-xs sm:text-sm font-bold group-hover:-translate-x-0.5 transition-transform">
              &lt;
            </span>
            <span>Kembali ke Jilid 1</span>
          </button>
        </div>
      )}

      {/* ── Chapters List (25 Bab Grid/Accordion) ── */}
      {selectedJilid === 1 && loading ? (
        <CourseCardSkeleton count={5} />
      ) : selectedJilid === 1 && filteredChapters.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 flex flex-col items-center gap-3">
          <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-700">Tidak ada bab yang cocok</h3>
          <p className="text-xs sm:text-sm text-slate-400">Coba ubah kata kunci pencarianmu.</p>
        </div>
      ) : selectedJilid === 1 ? (
        <div className="flex flex-col gap-4">
          {filteredChapters.map(chap => {
            const isExpanded = expandedBabs.has(chap.bab_number)
            const completedInBab = chap.lessons.filter(l => l.is_completed).length
            const targetGroupList = parseTargetGroups(chap.target_group)
            const isRestricted = targetGroupList.length > 0

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
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-snug truncate">
                          {chap.title.replace(/^Bab\s+(\d+):\s*/i, '第$1課: ')}
                        </h3>
                        {!shouldHideUnreleased && isRestricted && (
                          <span className="text-xs sm:text-sm font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0 flex items-center gap-1.5">
                            <svg className="size-3 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                            <span>Khusus ({targetGroupList.length}):</span>
                            <span>{targetGroupList.join(', ')}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 font-medium truncate mt-0.5">
                        {chap.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full hidden sm:inline-block">
                      {completedInBab}/5 {t('completed', 'Selesai')}
                    </span>
                    <span className="text-slate-400 text-xs sm:text-sm font-bold">
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
                                title: 'Kuis Masih Terkunci',
                                message: `Kamu harus menonton seluruh 3 video materi pada "${chap.title}" terlebih dahulu sebelum dapat membuka Kuis Evaluasi ini!\n\n(Progress: ${watchedCount}/3 Video Selesai)`,
                                type: 'lock',
                                buttonText: 'Siap, Nonton Dulu!',
                                onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
                              })
                              return
                            }
                            setActiveChapter(chap)
                            handleSwitchLesson(lesson)
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
                            <span className="text-sm sm:text-base scale-[4] origin-bottom-right opacity-20 absolute right-1 bottom-1 select-none pointer-events-none text-white font-bold font-japanese">
                              {isQuizLocked ? '鎖' : isKotoba ? '語' : isQuiz ? '試' : '画'}
                            </span>

                            {/* Center Visual Icon / Play Button */}
                            <div className="size-11 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white text-sm sm:text-base font-bold shadow-md transition-transform group-hover:scale-110">
                              {isQuizLocked ? (
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                              ) : isKotoba ? (
                                <span className="font-japanese font-bold text-sm sm:text-base">語</span>
                              ) : isQuiz ? (
                                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              ) : (
                                <span className="size-3.5 border-y-transparent border-y-4 border-l-7 border-l-white ml-0.5" />
                              )}
                            </div>

                            {/* Top Status Badges */}
                            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                              <span className="text-xs sm:text-sm font-bold uppercase tracking-wide px-2 py-0.5 rounded-md bg-black/40 text-white backdrop-blur-sm">
                                {isKotoba ? t('mc_lesson_kotoba', 'Kotoba') : isQuiz ? t('mc_lesson_quiz', 'Kuis') : `${t('mc_lesson_video', 'Video')} ${lesson.lesson_number}`}
                              </span>
                              {isQuizLocked ? (
                                <span className="text-xs sm:text-sm font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                  <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                  </svg>
                                  <span>{t('mc_locked', 'Terkunci')} ({watchedCount}/3)</span>
                                </span>
                              ) : lesson.is_completed ? (
                                <span className="text-xs sm:text-sm font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                  <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span>{t('completed', 'Selesai')}</span>
                                </span>
                              ) : lesson.is_placeholder ? (
                                <span className="text-xs sm:text-sm font-bold bg-amber-500/90 text-white px-2 py-0.5 rounded-full shadow-xs">
                                  {t('mc_coming_soon', 'Segera Hadir')}
                                </span>
                              ) : null}
                            </div>

                            {/* Duration Tag */}
                            <span className="absolute bottom-2 right-2 text-xs sm:text-sm font-bold bg-black/60 text-white/90 px-2 py-0.5 rounded-md backdrop-blur-xs font-mono flex items-center gap-1">
                              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>{lesson.duration_text || `${lesson.duration_minutes}.00`}</span>
                            </span>
                          </div>

                          {/* Card Content */}
                          <div className="p-3 sm:p-3.5 flex-1 flex flex-col justify-between gap-2.5 sm:gap-3">
                            <div>
                              <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-snug line-clamp-2 mb-0.5">
                                {lesson.title}
                              </h4>
                              <p className="text-xs sm:text-sm text-slate-400 font-medium">
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
                              className={`w-full min-h-[28px] sm:min-h-[32px] py-1.5 sm:py-2 px-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold border-none cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
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
                              {isQuizLocked ? (
                                <span>Terkunci ({watchedCount}/3 Video)</span>
                              ) : isKotoba ? (
                                <>
                                  <span className="font-japanese font-bold text-xs sm:text-sm">語</span>
                                  <span>Setor Kotoba</span>
                                </>
                              ) : isQuiz ? (
                                <span>Kerjakan Kuis</span>
                              ) : lesson.is_placeholder ? (
                                <span>Lihat Preview</span>
                              ) : (
                                <>
                                  <span>Buka Materi</span>
                                  <span className="size-4 rounded-full bg-white/20 flex items-center justify-center text-xs sm:text-sm font-bold">
                                    &gt;
                                  </span>
                                </>
                              )}
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
      ) : null}

      {/* ── Video Player & Placeholder Modal ── */}
      {activeLesson && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[999] flex items-start justify-center p-2 sm:p-4 pt-2 sm:pt-4 md:pt-6 pb-6 animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[92dvh] rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up">

            {/* Modal Header */}
            <div className="px-3.5 py-2 sm:px-6 sm:py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="min-w-0 pr-2">
                <span className="text-xs sm:text-sm text-primary-lighter font-bold uppercase tracking-wider block truncate">
                  {activeChapter?.title || `Minna no Nihongo Jilid ${selectedJilid}`}
                </span>
                <h2 className="text-sm sm:text-base font-bold truncate leading-tight">{activeLesson.title}</h2>
              </div>
              <button
                onClick={() => { setActiveLesson(null); setActiveChapter(null) }}
                className="size-7 sm:size-9 rounded-full bg-white/10 text-white hover:bg-white/20 border-none cursor-pointer text-sm sm:text-base flex items-center justify-center shrink-0"
              >
                ×
              </button>
            </div>

            {/* Modal Body: Left Player | Right Lessons list */}
            {/* On mobile: stack with toggle button. On lg+: side-by-side columns */}
            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_320px] overflow-hidden">

              {/* Left Column: Video Player / Kotoba View / Quiz View / Placeholder */}
              <div className="flex flex-col overflow-y-auto p-1.5 sm:p-6 gap-1.5 sm:gap-4 flex-1">

                {/* Mobile-only: Toggle button for lesson list */}
                <div className="lg:hidden flex items-center justify-between shrink-0 py-0.5 px-1">
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 font-medium truncate">
                    <svg className="size-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.328.477-4.5 1.253" />
                    </svg>
                    <span>{activeChapter?.lessons.length || 0} Materi di Bab Ini</span>
                  </div>
                  <button
                    onClick={() => setShowLessonList(prev => !prev)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-bold border-none cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                    <span>Daftar Materi</span>
                    <span className="text-xs sm:text-sm font-bold">{showLessonList ? '▲' : '▼'}</span>
                  </button>
                </div>

                {/* Mobile-only: Collapsible lesson list (shows when toggled) */}
                {showLessonList && (
                  <div className="lg:hidden animate-slide-down bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 p-2 flex flex-col gap-1 shrink-0">
                    <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm sm:text-base uppercase tracking-wider mb-0.5">
                      Materi {activeChapter?.title || 'Bab Ini'}
                    </h4>
                    {activeChapter?.lessons.map(l => {
                      const lIsQuiz = l.content_type === 'quiz'
                      const babVids = activeChapter.lessons.filter(v => v.content_type === 'video' || v.lesson_number <= 3)
                      const watchedVids = babVids.filter(v => v.is_completed || (v.replay_count && v.replay_count > 0)).length
                      const lIsLocked = lIsQuiz && watchedVids < 3
                      const quizNum = l.lesson_number - 3
                      const contentLabel = lIsQuiz
                        ? `Kuis ${quizNum}`
                        : `Video ${l.lesson_number}`
                      return (
                        <button
                          key={l.id}
                          onClick={() => {
                            if (lIsLocked) {
                              setAlertConfig({
                                isOpen: true,
                                title: 'Kuis Masih Terkunci',
                                message: `Kamu harus menonton seluruh 3 video materi pada "${activeChapter.title}" terlebih dahulu sebelum dapat membuka Kuis Evaluasi ini!\n\n(Progress: ${watchedVids}/3 Video Selesai)`,
                                type: 'lock',
                                buttonText: 'Siap, Nonton Dulu!',
                                onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
                              })
                              return
                            }
                            handleSwitchLesson(l)
                            setShowLessonList(false)
                          }}
                          className={`p-2 rounded-xl text-left border transition-all flex items-center justify-between ${
                            lIsLocked
                              ? 'bg-slate-100 dark:bg-slate-700/40 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed opacity-70'
                              : activeLesson?.id === l.id
                                ? 'bg-white dark:bg-slate-900 border-primary shadow-xs text-primary cursor-pointer'
                                : 'bg-white/60 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-white cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`text-xs sm:text-sm font-bold px-1.5 py-0.5 rounded-md ${
                                lIsLocked ? 'bg-amber-500/20 text-amber-600' :
                                lIsQuiz ? 'bg-indigo-100 text-indigo-600' : 'bg-primary/10 text-primary'
                              }`}>
                                {lIsLocked ? `Kuis ${quizNum} (Terkunci)` : contentLabel}
                              </span>
                              {l.is_completed && (
                                <svg className="size-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <div className="text-xs sm:text-sm font-bold truncate">{l.title}</div>
                            <div className="text-xs sm:text-sm text-slate-400 mt-0.5 flex items-center gap-1">
                              <span>{l.duration_minutes}m</span>
                              {lIsLocked ? (
                                <span className="text-amber-500 font-semibold">• Tonton {3 - watchedVids} video lagi</span>
                              ) : l.is_placeholder ? (
                                <span>• Segera Hadir</span>
                              ) : null}
                            </div>
                          </div>
                          {l.is_completed ? (
                            <svg className="size-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : lIsLocked ? (
                            <svg className="size-3.5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                          ) : (
                            <span className="size-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs sm:text-sm font-bold text-slate-600 shrink-0">
                              &gt;
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
                {activeLesson.content_type === 'kotoba' ? (
                  /* Setoran Kotoba Interactive Frame */
                  <div className="w-full rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-orange-500/10 border border-amber-200 p-4 sm:p-6 flex flex-col gap-3 sm:gap-4 shadow-sm shrink-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-10 sm:size-12 bg-amber-500 text-white rounded-2xl flex items-center justify-center text-sm sm:text-base font-bold shadow-md font-japanese">
                          語
                        </div>
                        <div>
                          <span className="text-xs sm:text-sm font-bold text-amber-700 uppercase tracking-wider">Setoran Kotoba</span>
                          <h3 className="text-sm sm:text-base font-bold text-slate-800 leading-tight">
                            Setoran Kosakata Bahasa Jepang — {activeChapter?.title}
                          </h3>
                        </div>
                      </div>
                      <span className="text-xs sm:text-sm font-bold bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Est. 10 Menit</span>
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      Hafalkan kosakata dasar bab ini sebelum melanjutkan ke video tata bahasa. Kamu dapat mencocokkan kata Jepang dan artinya!
                    </p>

                    {/* Sample Interactive Vocabulary Card */}
                    <div className="bg-white rounded-2xl p-3 sm:p-4 border border-amber-200/80 shadow-xs flex flex-col gap-2.5">
                      <div className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1.5">
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
                          <div key={idx} className="p-2.5 rounded-xl bg-amber-50/50 border border-amber-100 flex justify-between items-center text-xs sm:text-sm">
                            <span className="font-bold text-slate-800 text-xs sm:text-sm">{item.kana}</span>
                            <span className="font-bold text-amber-700 bg-white px-2 py-0.5 rounded-lg border border-amber-200 text-xs sm:text-sm">{item.arti}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs sm:text-sm font-medium text-slate-500">
                        {activeLesson.is_completed ? 'Status: Sudah Disetor' : 'Hafalkan lalu tandai selesai!'}
                      </span>
                      <button
                        onClick={() => handleToggleLessonComplete(activeLesson)}
                        className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border-none cursor-pointer transition-all flex items-center gap-1.5 ${
                          activeLesson.is_completed
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                        }`}
                      >
                        {activeLesson.is_completed ? (
                          <>
                            <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Setoran Selesai</span>
                          </>
                        ) : (
                          <span>Tandai Selesai</span>
                        )}
                      </button>
                    </div>
                  </div>
                ) : activeLesson.content_type === 'quiz' ? (
                  /* Kuis Evaluasi Bab Frame (Coming Soon State) */
                  <div className="w-full rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-950 border border-indigo-800/60 p-4 sm:p-8 flex flex-col items-center justify-center text-center gap-3 sm:gap-4 shadow-xl shrink-0 min-h-[300px] relative overflow-hidden">
                    <div className="absolute inset-0 bg-indigo-500/10 blur-3xl pointer-events-none" />

                    <div className="size-12 sm:size-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shadow-lg relative z-10">
                      <svg className="size-7 sm:size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>

                    <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-300 relative z-10">
                      <span>Fitur Kuis Segera Hadir</span>
                    </div>

                    <div className="relative z-10 max-w-md">
                      <h3 className="text-sm sm:text-base font-bold text-white mb-1">
                        Kuis Evaluasi — {activeChapter?.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
                        Soal kuis pilihan ganda untuk Bab ini sedang dalam tahap penyusunan & validasi oleh pengajar. Kamu bisa mempelajari video & setoran kotoba terlebih dahulu!
                      </p>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-xs sm:text-sm text-indigo-200 max-w-md w-full relative z-10 flex flex-col gap-0.5 text-left">
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <svg className="size-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Info Pengajar:</span>
                      </span>
                      <span>Target Kuis: 10 Soal Pilihan Ganda (Passing Grade 80%)</span>
                    </div>
                  </div>
                ) : activeLesson.video_id ? (
                  /* Real HTML5 Portrait Video Player */
                  <div className="w-full bg-slate-950 sm:bg-gradient-to-b sm:from-slate-950 sm:via-slate-900 sm:to-slate-950 rounded-2xl sm:rounded-3xl p-1.5 sm:p-5 flex flex-col items-center justify-start sm:justify-center shadow-xl border border-slate-800 shrink-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-primary/5 blur-3xl pointer-events-none" />

                    <div className="hidden sm:flex items-center gap-1.5 mb-2 z-10 text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                      <svg className="size-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span>Format Video Mobile (Portrait 9:16)</span>
                    </div>

                    <div
                      className="w-full max-w-[280px] xs:max-w-[310px] sm:max-w-[340px] rounded-xl sm:rounded-2xl overflow-hidden bg-black shadow-2xl border sm:border-4 border-slate-800 relative z-10 group flex items-center justify-center"
                      style={{ aspectRatio: '9/16', maxHeight: 'min(58vh, 540px)' }}
                    >
                      {isVideoRefreshing ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-white gap-3 p-4 select-none animate-fade-in">
                          <div className="size-9 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs sm:text-sm font-bold text-slate-300 animate-pulse">Memuat materi video...</span>
                        </div>
                      ) : (
                        <SmartVideoPlayer
                          key={`video_${videoKey}_${activeChapter?.bab_number || 1}_${activeLesson.id}_${activeLesson.lesson_number}`}
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
                      )}
                    </div>
                  </div>
                ) : (
                  /* Elegant Placeholder Player Frame */
                  <div className="w-full aspect-video rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center text-center p-6 text-white shadow-lg relative overflow-hidden shrink-0">
                    <div className="size-16 bg-white/10 rounded-2xl flex items-center justify-center text-white mb-3 border border-white/10">
                      <svg className="size-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <span className="text-xs sm:text-sm font-bold uppercase tracking-wider text-amber-400 bg-amber-500/20 px-3 py-1 rounded-full mb-2 border border-amber-500/30">
                      Video Sedang Disiapkan oleh Pengajar
                    </span>
                    <h3 className="text-sm sm:text-base font-bold max-w-md leading-snug mb-1">
                      {activeLesson.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-sm leading-relaxed">
                      Video materi ini sedang dalam tahap perekaman/upload oleh admin. Kamu tetap bisa mencatat judul bab dan lanjut ke video berikutnya!
                    </p>
                  </div>
                )}

                {/* Lesson Details & Direct Navigation Controls */}
                <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white leading-tight">
                        {activeLesson.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                        <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Estimasi Durasi: {activeLesson.duration_minutes} menit • Diulang {activeLesson.replay_count || 0} kali</span>
                      </p>
                    </div>

                    {activeLesson.is_completed && (
                      <span className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-1.5 self-start sm:self-center">
                        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Selesai</span>
                      </span>
                    )}
                  </div>

                  {/* Previous / Next Lesson Quick Navigation Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                    <button
                      type="button"
                      disabled={!prevLesson}
                      onClick={() => prevLesson && handleSwitchLesson(prevLesson)}
                      className={`min-h-[28px] sm:min-h-[32px] px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center gap-1.5 group ${
                        !prevLesson
                          ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                          : 'cursor-pointer bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary shadow-2xs'
                      }`}
                    >
                      <span className="size-3.5 sm:size-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs sm:text-sm font-bold group-hover:-translate-x-0.5 transition-transform">
                        &lt;
                      </span>
                      <span>Materi Sebelumnya</span>
                    </button>

                    <button
                      type="button"
                      disabled={!nextLesson}
                      onClick={() => {
                        if (!nextLesson) return
                        const isQuiz = nextLesson.content_type === 'quiz'
                        const babVids = activeChapter?.lessons.filter(v => v.content_type === 'video' || v.lesson_number <= 3) || []
                        const watchedVids = babVids.filter(v => v.is_completed || (v.replay_count && v.replay_count > 0)).length
                        if (isQuiz && watchedVids < 3) {
                          setAlertConfig({
                            isOpen: true,
                            title: 'Kuis Masih Terkunci',
                            message: `Kamu harus menonton seluruh 3 video materi pada "${activeChapter?.title}" terlebih dahulu sebelum dapat membuka Kuis Evaluasi ini!\n\n(Progress: ${watchedVids}/3 Video Selesai)`,
                            type: 'lock',
                            buttonText: 'Siap, Nonton Dulu!',
                            onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
                          })
                          return
                        }
                        handleSwitchLesson(nextLesson)
                      }}
                      className={`min-h-[28px] sm:min-h-[32px] px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold border transition-all flex items-center gap-1.5 group ${
                        !nextLesson
                          ? 'opacity-40 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700'
                          : 'cursor-pointer bg-primary text-white border-primary hover:bg-primary-dark shadow-xs'
                      }`}
                    >
                      <span>Materi Selanjutnya</span>
                      <span className="size-3.5 sm:size-4 rounded-full bg-white/20 flex items-center justify-center text-xs sm:text-sm font-bold group-hover:translate-x-0.5 transition-transform">
                        &gt;
                      </span>
                    </button>
                  </div>
                </div>

              </div>

              {/* Right Column: Playlist of 5 Videos in active Chapter (desktop only) */}
              <div className="hidden lg:flex bg-slate-50 border-l border-slate-200 p-4 overflow-y-auto flex-col gap-2">
                <h4 className="font-bold text-slate-700 text-sm sm:text-base uppercase tracking-wider px-2 mb-1">
                  Materi {activeChapter?.title || 'Bab Ini'}
                </h4>
                <p className="text-xs sm:text-sm text-slate-400 px-2 mb-2 font-medium">
                  {activeChapter?.lessons.filter(l => l.is_completed).length || 0} / {activeChapter?.lessons.length || 0} selesai
                </p>
                {activeChapter?.lessons.map(l => {
                  const lIsQuiz = l.content_type === 'quiz'
                  const babVids = activeChapter!.lessons.filter(v => v.content_type === 'video' || v.lesson_number <= 3)
                  const watchedVids = babVids.filter(v => v.is_completed || (v.replay_count && v.replay_count > 0)).length
                  const lIsLocked = lIsQuiz && watchedVids < 3
                  const quizNum = l.lesson_number - 3
                  const contentLabel = lIsQuiz
                    ? `Kuis ${quizNum}`
                    : `Video ${l.lesson_number}`
                  const isActive = activeLesson?.id === l.id
                  return (
                    <button
                      key={l.id}
                      onClick={() => {
                        if (lIsLocked) {
                          setAlertConfig({
                            isOpen: true,
                            title: 'Kuis Masih Terkunci',
                            message: `Kamu harus menonton seluruh 3 video materi pada "${activeChapter!.title}" terlebih dahulu sebelum dapat membuka Kuis Evaluasi ini!\n\n(Progress: ${watchedVids}/3 Video Selesai)`,
                            type: 'lock',
                            buttonText: 'Siap, Nonton Dulu!',
                            onClose: () => setAlertConfig(prev => ({ ...prev, isOpen: false })),
                          })
                          return
                        }
                        handleSwitchLesson(l)
                      }}
                      className={`p-3 rounded-xl text-left border transition-all flex items-start gap-2.5 ${
                        lIsLocked
                          ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                          : isActive
                            ? 'bg-white border-primary shadow-sm text-primary cursor-pointer'
                            : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white hover:shadow-xs cursor-pointer'
                      }`}
                    >
                      {/* Left: type icon */}
                      <div className={`size-8 rounded-lg flex items-center justify-center text-xs sm:text-sm shrink-0 mt-0.5 ${
                        lIsLocked ? 'bg-amber-100 text-amber-500' :
                        isActive ? 'bg-primary/15 text-primary' :
                        lIsQuiz ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {lIsLocked ? (
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        ) : lIsQuiz ? (
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        ) : l.is_placeholder ? (
                          <span className="text-xs sm:text-sm font-bold">N/A</span>
                        ) : isActive ? (
                          <span className="size-2.5 border-y-transparent border-y-3 border-l-5 border-l-primary ml-0.5" />
                        ) : (
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>

                      {/* Right: text */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-xs sm:text-sm font-bold px-1.5 py-0.5 rounded-md leading-none ${
                            lIsLocked ? 'bg-amber-100 text-amber-600' :
                            isActive ? 'bg-primary/10 text-primary' :
                            lIsQuiz ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {lIsLocked ? `Kuis ${quizNum} (Terkunci)` : contentLabel}
                          </span>
                          {l.is_completed && !lIsLocked && (
                            <span className="text-xs sm:text-sm text-emerald-600 font-bold flex items-center gap-0.5">
                              <svg className="size-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Selesai</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs sm:text-sm font-bold truncate leading-snug">{l.title}</div>
                        <div className="text-xs sm:text-sm text-slate-400 mt-0.5 flex items-center gap-1">
                          <span>{l.duration_minutes}m</span>
                          {lIsLocked ? (
                            <span className="text-amber-500 font-semibold">• Tonton {3 - watchedVids} video lagi</span>
                          ) : l.is_placeholder ? (
                            <span>• Segera Hadir</span>
                          ) : null}
                        </div>
                      </div>

                      {/* Right badge */}
                      {!lIsLocked && (
                        l.is_completed ? (
                          <svg className="size-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : l.is_placeholder ? (
                          <span className="text-xs sm:text-sm text-slate-400 shrink-0">N/A</span>
                        ) : isActive ? (
                          <span className="size-2 rounded-full bg-primary shrink-0 mt-2"></span>
                        ) : (
                          <span className="size-3.5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs sm:text-sm font-bold text-slate-500 shrink-0">
                            &gt;
                          </span>
                        )
                      )}
                    </button>
                  )
                })}
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
