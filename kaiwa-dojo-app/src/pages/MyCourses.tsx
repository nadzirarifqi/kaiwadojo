import { useState, useEffect, useRef, useMemo, type SyntheticEvent } from 'react'
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
import ModalPortal from '../components/ModalPortal'
import { SubscriptionLockCard } from '../components/SubscriptionLock'
import { getSubscriptionAccess } from '../lib/subscriptionAccess'
import { CourseCardSkeleton } from '../components/Skeleton'
import { MOTIVATION_QUOTES, getDailyQuoteIndex } from '../data/motivationQuotes'
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

function getLessonLabel(l: LessonItem): string {
  if (l.content_type === 'quiz') return `Kuis ${l.lesson_number - 3}`
  if (l.content_type === 'kotoba') return 'Kotoba'
  return `Video ${l.lesson_number}`
}

/* URL video yang sudah terbukti bisa diputar — dipakai ulang agar video berikutnya langsung tampil tanpa mencoba ulang */
const RESOLVED_VIDEO_CACHE_KEY = 'kaiwa_resolved_video_urls'
const resolvedVideoUrls: Map<string, string> = (() => {
  try {
    const raw = sessionStorage.getItem(RESOLVED_VIDEO_CACHE_KEY)
    return new Map<string, string>(raw ? JSON.parse(raw) : [])
  } catch {
    return new Map<string, string>()
  }
})()

function rememberResolvedUrl(cacheKey: string, url: string) {
  if (resolvedVideoUrls.get(cacheKey) === url) return
  resolvedVideoUrls.set(cacheKey, url)
  try { sessionStorage.setItem(RESOLVED_VIDEO_CACHE_KEY, JSON.stringify([...resolvedVideoUrls])) } catch { /* storage diblokir */ }
}

function normalizeVideoUrl(url: string): string {
  try { return encodeURI(decodeURI(url)) } catch { return url }
}

type PlayerStatus = 'loading' | 'ready' | 'error'

/**
 * Pemutar video materi. Video disembunyikan di balik layar "memuat" sampai frame pertama siap,
 * sehingga user tidak melihat kedipan player kosong / gagal saat mencari format file yang cocok.
 */
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
  const cacheKey = `${chapterBab}_${lesson.lesson_number}_${lesson.video_id || ''}`
  const candidates = useMemo(() => {
    // Buang duplikat (URL mentah vs ter-encode menghasilkan request yang sama)
    const unique = Array.from(new Set(
      getVideoUrlCandidates(lesson.video_id, chapterBab, lesson.lesson_number).map(normalizeVideoUrl)
    ))
    const cached = resolvedVideoUrls.get(cacheKey)
    return cached ? [cached, ...unique.filter(u => u !== cached)] : unique
  }, [lesson.video_id, chapterBab, lesson.lesson_number, cacheKey])

  const [candidateIdx, setCandidateIdx] = useState(0)
  const [status, setStatus] = useState<PlayerStatus>('loading')
  const [isBuffering, setIsBuffering] = useState(false)
  const [needsTap, setNeedsTap] = useState(false)
  const [isSlow, setIsSlow] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const startedRef = useRef(false)

  const currentUrl = candidates[candidateIdx] || ''

  // Beri tahu user bila koneksi lambat, alih-alih spinner tanpa penjelasan
  useEffect(() => {
    if (status !== 'loading') return
    setIsSlow(false)
    const t = window.setTimeout(() => setIsSlow(true), 8000)
    return () => window.clearTimeout(t)
  }, [status, candidateIdx])

  function handleError() {
    if (startedRef.current) {
      // Error di tengah pemutaran (mis. jaringan putus) — jangan berpindah file
      setStatus('error')
      return
    }
    if (candidateIdx < candidates.length - 1) {
      setCandidateIdx(prev => prev + 1)
    } else {
      setStatus('error')
    }
  }

  // Metadata terbaca = file valid. Simpan URL-nya, lalu langsung coba putar (overlay tetap tampil sampai frame pertama siap)
  function handleMetadata(e: SyntheticEvent<HTMLVideoElement>) {
    const totalSecs = e.currentTarget.duration
    if (totalSecs && !isNaN(totalSecs) && totalSecs > 0 && isFinite(totalSecs)) {
      onLoadedMetadata(totalSecs)
    }
    if (startedRef.current) return
    startedRef.current = true
    rememberResolvedUrl(cacheKey, currentUrl)
    const playPromise = e.currentTarget.play()
    if (playPromise) {
      // Autoplay diblokir browser (umum di iOS) → tampilkan video dengan tombol putar besar
      playPromise.catch(() => { setStatus('ready'); setNeedsTap(true) })
    }
  }

  function markReady() {
    if (startedRef.current) setStatus('ready')
  }

  // Layar penuh: API standar, dengan fallback iOS Safari (webkitEnterFullscreen pada elemen video)
  function handleFullscreen() {
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null
    if (!video) return
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {})
    } else if (video.requestFullscreen) {
      video.requestFullscreen().catch(() => video.webkitEnterFullscreen?.())
    } else {
      video.webkitEnterFullscreen?.()
    }
  }

  function handleManualPlay() {
    setNeedsTap(false)
    videoRef.current?.play().catch(() => setNeedsTap(true))
  }

  function handleRetry() {
    startedRef.current = false
    setStatus('loading')
    setNeedsTap(false)
    setCandidateIdx(0)
    videoRef.current?.load()
  }

  if (status === 'error') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-3 p-5 bg-slate-950 text-white animate-fade-in">
        <div className="size-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center">
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div>
          <h4 className="text-base font-bold leading-snug">Video belum bisa diputar</h4>
          <p className="text-sm text-slate-400 leading-relaxed mt-1 max-w-[240px]">
            Periksa koneksi internetmu, lalu coba lagi.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          className="h-11 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors flex items-center gap-2"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Coba lagi
        </button>
        <details className="w-full max-w-[260px] text-left text-xs text-slate-400">
          <summary className="cursor-pointer text-center text-slate-500 hover:text-slate-300 py-1">Info teknis untuk pengajar</summary>
          <ul className="mt-2 p-3 rounded-xl bg-white/5 border border-white/10 flex flex-col gap-1 font-mono leading-relaxed">
            <li>Container: <strong className="text-slate-200">MP4</strong></li>
            <li>Video: <strong className="text-slate-200">H.264</strong> (bukan HEVC)</li>
            <li>Audio: <strong className="text-slate-200">AAC</strong>, centang "Web Optimized"</li>
            <li className="break-all">File: <span className="text-emerald-400">Kaiwa Dojo - BAB {chapterBab} S{lesson.lesson_number}.mp4</span></li>
          </ul>
        </details>
      </div>
    )
  }

  return (
    <>
      <video
        ref={videoRef}
        src={currentUrl}
        controls={status === 'ready'}
        controlsList="nodownload"
        playsInline
        preload="auto"
        className={`absolute inset-0 w-full h-full object-contain bg-black transition-opacity duration-300 ${status === 'ready' ? 'opacity-100' : 'opacity-0'}`}
        onLoadedMetadata={handleMetadata}
        onLoadedData={markReady}
        onCanPlay={markReady}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => { markReady(); setIsBuffering(false); setNeedsTap(false) }}
        onCanPlayThrough={() => setIsBuffering(false)}
        onEnded={onEnded}
        onError={handleError}
      >
        Browser kamu tidak mendukung pemutaran video ini.
      </video>

      {/* Layar memuat — menutupi proses pencarian file & buffering awal */}
      {status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 text-white select-none">
          <div className="size-10 rounded-full border-[3px] border-white/15 border-t-primary-lighter animate-spin" />
          <p className="text-sm font-semibold text-slate-300">Menyiapkan video…</p>
          {isSlow && (
            <p className="text-xs text-slate-500 max-w-[220px] text-center leading-relaxed animate-fade-in">
              Koneksi sedang lambat. Video akan diputar begitu siap.
            </p>
          )}
        </div>
      )}

      {/* Buffering di tengah pemutaran */}
      {status === 'ready' && isBuffering && !needsTap && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="size-12 rounded-full bg-black/50 flex items-center justify-center">
            <div className="size-7 rounded-full border-[3px] border-white/25 border-t-white animate-spin" />
          </div>
        </div>
      )}

      {/* Tombol layar penuh yang jelas (tombol bawaan browser kecil dan sulit ditekan di HP) */}
      {status === 'ready' && !needsTap && (
        <button
          type="button"
          onClick={handleFullscreen}
          aria-label="Layar penuh"
          title="Layar penuh"
          className="absolute top-2 right-2 z-10 size-10 rounded-xl bg-black/55 hover:bg-black/75 text-white border-none cursor-pointer flex items-center justify-center backdrop-blur-sm transition-colors"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" />
          </svg>
        </button>
      )}

      {/* Autoplay diblokir: tombol putar besar */}
      {status === 'ready' && needsTap && (
        <button
          type="button"
          onClick={handleManualPlay}
          aria-label="Putar video"
          className="absolute inset-0 flex items-center justify-center bg-black/30 border-none cursor-pointer animate-fade-in"
        >
          <span className="size-16 rounded-full bg-white/95 text-primary shadow-xl flex items-center justify-center hover:scale-105 transition-transform">
            <svg className="size-7 ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 001.52.85l11-6.86a1 1 0 000-1.7l-11-6.86A1 1 0 008 5.14z" /></svg>
          </span>
        </button>
      )}
    </>
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

export default function MyCourses() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, profile } = useAuth()
  // Pelajar belum bayar / langganan habis: boleh lihat daftar materi, tapi video dikunci
  const isSubscriptionLocked = getSubscriptionAccess(profile).isLocked
  const { t } = useLanguage()
  const isInstructor = profile?.role === 'pemateri' || profile?.role === 'admin'

  // Admin student preview mode state
  const [adminStudentViewMode, setAdminStudentViewMode] = useState(true)

  // Header Settings State
  const [headerSettings, setHeaderSettings] = useState<CourseHeaderSettings>({
    page_title: 'Buku Kursus Minna no Nihongo',
    page_subtitle: 'Pilih jilid buku dan pelajari 5 video materi + 1 kuis di setiap babnya',
  })

  // Kata penyemangat (berganti harian) & filter status bab
  const [quoteIndex, setQuoteIndex]       = useState(() => getDailyQuoteIndex(getTodayDateString()))
  const [chapterFilter, setChapterFilter] = useState<'all' | 'progress' | 'done'>('all')

  // State Tabs
  const [selectedJilid, setSelectedJilid] = useState<1 | 2>(1)
  const [chapters, setChapters]           = useState<ChapterItem[]>([])
  const [groups, setGroups]               = useState<KaiwaGroup[]>([])
  const [loading, setLoading]             = useState(true)
  const [searchBab, setSearchBab]         = useState('')

  // Active Lesson / Player state
  const [activeChapter, setActiveChapter] = useState<ChapterItem | null>(null)
  const [activeLesson, setActiveLesson]   = useState<LessonItem | null>(null)
  // Sheet daftar materi di modal (HP/tablet) — otomatis tertutup saat berpindah materi
  const [showPlaylistSheet, setShowPlaylistSheet] = useState(false)
  const activeLessonId = activeLesson?.id
  useEffect(() => { setShowPlaylistSheet(false) }, [activeLessonId])

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
  // Diproses sekali per link — tanpa ini, polling data tiap 6 detik membuka ulang modal yang sudah ditutup user
  const handledDeepLinkRef = useRef<string | null>(null)
  useEffect(() => {
    if (chapters.length === 0) return
    if (handledDeepLinkRef.current === searchParams.toString()) return
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
        handledDeepLinkRef.current = searchParams.toString()
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

  function handleSwitchLesson(newLesson: LessonItem) {
    if (newLesson.id === activeLesson?.id) return
    // Player di-mount ulang lewat `key` per materi — tidak perlu jeda/spinner buatan yang membuat layar berkedip
    setActiveLesson(newLesson)
  }

  function closePlayer() {
    setActiveLesson(null)
    setActiveChapter(null)
  }

  // Saat modal terbuka: kunci scroll halaman di belakang & tutup dengan tombol Escape
  const isPlayerOpen = activeLesson !== null
  const isAlertOpen = alertConfig.isOpen
  useEffect(() => {
    if (!isPlayerOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isAlertOpen) {
        setShowPlaylistSheet(false)
        setActiveLesson(null)
        setActiveChapter(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [isPlayerOpen, isAlertOpen])

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

  // Bab yang boleh dilihat user (tanpa filter pencarian) — dasar perhitungan progres
  const accessibleChapters = chapters.filter(c => {
    if (shouldHideUnreleased && c.is_hidden) return false
    if (shouldHideUnreleased && !isChapterAccessibleForUser(c, profile, groups)) return false
    return true
  })

  function isChapterDone(c: ChapterItem) {
    return c.lessons.length > 0 && c.lessons.every(l => l.is_completed)
  }

  const filteredChapters = accessibleChapters.filter(c => {
    if (chapterFilter === 'done' && !isChapterDone(c)) return false
    if (chapterFilter === 'progress' && isChapterDone(c)) return false

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

  // Progres total dihitung dari semua bab yang dapat diakses (tidak ikut berubah saat mencari)
  const totalLessonsCount     = accessibleChapters.reduce((acc, c) => acc + c.lessons.length, 0)
  const completedLessonsCount = accessibleChapters.reduce((acc, c) => acc + c.lessons.filter(l => l.is_completed).length, 0)
  const totalProgressPct      = totalLessonsCount > 0 ? Math.round((completedLessonsCount / totalLessonsCount) * 100) : 0
  const doneChaptersCount     = accessibleChapters.filter(isChapterDone).length

  function getLessonState(chap: ChapterItem, lesson: LessonItem) {
    const isKotoba = lesson.content_type === 'kotoba'
    const isQuiz = lesson.content_type === 'quiz'
    const babVideos = chap.lessons.filter(l => l.content_type === 'video' || l.lesson_number <= 3)
    const watchedCount = babVideos.filter(l => l.is_completed || (l.replay_count && l.replay_count > 0)).length
    const isQuizLocked = isQuiz && watchedCount < 3
    return { isKotoba, isQuiz, watchedCount, isQuizLocked }
  }

  function openLesson(chap: ChapterItem, lesson: LessonItem) {
    const { isQuizLocked, watchedCount } = getLessonState(chap, lesson)
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
  }

  // Materi berikutnya yang bisa dikerjakan (untuk kartu "Lanjutkan belajar")
  let nextUp: { chap: ChapterItem; lesson: LessonItem } | null = null
  outer: for (const chap of accessibleChapters) {
    for (const lesson of chap.lessons) {
      if (lesson.is_completed || lesson.is_placeholder) continue
      if (getLessonState(chap, lesson).isQuizLocked) continue
      nextUp = { chap, lesson }
      break outer
    }
  }

  // Buka otomatis bab tempat materi berikutnya berada (sekali saat halaman pertama dimuat)
  const autoExpandedRef = useRef(false)
  const nextUpBab = nextUp?.chap.bab_number
  useEffect(() => {
    if (loading || autoExpandedRef.current || !nextUpBab) return
    autoExpandedRef.current = true
    setExpandedBabs(prev => new Set(prev).add(nextUpBab))
  }, [loading, nextUpBab])

  const quote = MOTIVATION_QUOTES[quoteIndex]
  const progressMessage =
    totalProgressPct === 0 ? 'Langkah pertamamu dimulai hari ini. Ayo buka materi pertama!'
    : totalProgressPct < 25 ? 'Awal yang bagus! Pertahankan ritme belajarmu.'
    : totalProgressPct < 50 ? 'Kamu sudah melangkah jauh. Terus konsisten!'
    : totalProgressPct < 75 ? 'Lebih dari setengah jalan. Hebat sekali!'
    : totalProgressPct < 100 ? 'Sedikit lagi menuju garis akhir Jilid 1!'
    : 'Luar biasa! Semua materi Jilid 1 sudah kamu selesaikan. おめでとう!'

  // Bab aktif selalu diambil dari data terbaru agar status selesai di daftar materi modal ikut ter-update
  const modalChapter = activeChapter
    ? chapters.find(c => c.bab_number === activeChapter.bab_number) ?? activeChapter
    : null
  const modalLessons = modalChapter?.lessons ?? []
  const liveMatch = activeLesson ? modalLessons.find(l => l.id === activeLesson.id) : undefined
  const liveLesson = activeLesson && {
    ...activeLesson,
    is_completed: liveMatch?.is_completed ?? activeLesson.is_completed,
    replay_count: Math.max(liveMatch?.replay_count ?? 0, activeLesson.replay_count ?? 0),
  }
  const modalCompletedCount = modalLessons.filter(l => l.is_completed).length
  const modalChapterPct = modalLessons.length > 0 ? Math.round((modalCompletedCount / modalLessons.length) * 100) : 0

  const currentLessonIdx = activeLesson ? modalLessons.findIndex(l => l.id === activeLesson.id) : -1
  const prevLesson = currentLessonIdx > 0 ? modalLessons[currentLessonIdx - 1] : null
  const nextLesson = currentLessonIdx >= 0 && currentLessonIdx < modalLessons.length - 1
    ? modalLessons[currentLessonIdx + 1]
    : null

  function renderPlaylistItem(l: LessonItem) {
    if (!modalChapter) return null
    const { isQuiz, isQuizLocked, watchedCount } = getLessonState(modalChapter, l)
    const isActive = activeLesson?.id === l.id
    const meta = isQuizLocked
      ? `Tonton ${3 - watchedCount} video lagi untuk membuka`
      : l.is_placeholder ? 'Segera hadir' : `${l.duration_minutes} menit`

    return (
      <button
        type="button"
        onClick={() => openLesson(modalChapter, l)}
        aria-current={isActive ? 'true' : undefined}
        className={`w-full min-h-[60px] p-2.5 rounded-xl text-left flex items-center gap-3 border transition-colors cursor-pointer ${
          isActive
            ? 'bg-primary/5 dark:bg-primary/15 border-primary/30'
            : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/70'
        }`}
      >
        <span className={`size-10 shrink-0 rounded-xl flex items-center justify-center ${
          l.is_completed ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
          : isQuizLocked ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'
          : isActive ? 'bg-primary text-white'
          : isQuiz ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}>
          {l.is_completed ? (
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          ) : isQuizLocked ? (
            <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          ) : isQuiz ? (
            <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          ) : l.is_placeholder ? (
            <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          ) : (
            <svg className="size-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v13.72a1 1 0 001.52.85l11-6.86a1 1 0 000-1.7l-11-6.86A1 1 0 008 5.14z" /></svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-xs font-semibold ${isActive ? 'text-primary dark:text-primary-lighter' : 'text-slate-500 dark:text-slate-400'}`}>
            {getLessonLabel(l)}{isActive ? ' · Sedang dibuka' : ''}
          </span>
          <span className={`block text-sm font-semibold leading-snug line-clamp-2 ${isQuizLocked ? 'text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
            {l.title}
          </span>
          <span className={`block text-xs mt-0.5 ${isQuizLocked ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-slate-400'}`}>
            {meta}
          </span>
        </span>
      </button>
    )
  }

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

      {/* ── HEADER: progres & kata penyemangat ── */}
      <header className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-dark rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 text-white shadow-md animate-fade-in">
        <div className="absolute -top-16 -right-16 size-60 bg-white/10 rounded-full pointer-events-none" />
        <span aria-hidden="true" className="absolute -bottom-10 left-1/3 font-serif font-black text-[11rem] leading-none text-white/[0.05] select-none pointer-events-none">学</span>

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-4 lg:gap-8 items-center">
          <div className="min-w-0">
            <span className="inline-block text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full mb-2">
              {t('nav_my_courses', 'Kursus Saya')}
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">{t('mc_title', headerSettings.page_title)}</h1>
            <p className="text-sm text-white/85 mt-1 leading-relaxed">{t('mc_subtitle', headerSettings.page_subtitle)}</p>

            {selectedJilid === 1 && (
              <div className="mt-4 max-w-md">
                <div className="flex items-end justify-between gap-3 mb-1.5">
                  <p className="text-sm text-white/85">
                    <span className="font-bold text-white">{completedLessonsCount}</span> dari {totalLessonsCount} materi selesai
                    <span className="text-white/60"> · {doneChaptersCount} bab tuntas</span>
                  </p>
                  <span className="text-2xl font-black tabular-nums leading-none">{totalProgressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                  <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${totalProgressPct}%` }} />
                </div>
                <p className="text-[13px] text-white/80 mt-2">{progressMessage}</p>
              </div>
            )}

            {isInstructor && (
              <button
                onClick={() => navigate('/kelola-kursus')}
                className="mt-4 h-10 px-4 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-sm font-semibold cursor-pointer transition-colors inline-flex items-center gap-2"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Judul & Visibilitas
              </button>
            )}
          </div>

          {/* Kata penyemangat */}
          <figure className="m-0 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <figcaption className="text-xs font-semibold text-white/80">Kata penyemangat hari ini</figcaption>
              <button
                type="button"
                onClick={() => setQuoteIndex(i => (i + 1 + Math.floor(Math.random() * (MOTIVATION_QUOTES.length - 1))) % MOTIVATION_QUOTES.length)}
                aria-label="Kata penyemangat lain"
                title="Kata penyemangat lain"
                className="size-9 rounded-lg bg-white/10 hover:bg-white/20 text-white border-none cursor-pointer flex items-center justify-center transition-colors"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
            <blockquote className="m-0" aria-live="polite">
              <p className="font-serif text-2xl font-bold leading-snug">{quote.jp}</p>
              <p className="text-xs italic text-white/70 mt-0.5">{quote.reading}</p>
              <p className="text-sm font-semibold mt-2">“{quote.meaning}”</p>
              <p className="text-[13px] text-white/80 mt-1 leading-relaxed">{quote.message}</p>
            </blockquote>
          </figure>
        </div>
      </header>

      {/* ── Lanjutkan belajar ── */}
      {selectedJilid === 1 && !loading && nextUp && (() => {
        const { chap, lesson } = nextUp
        const { isQuiz, isKotoba } = getLessonState(chap, lesson)
        const typeLabel = isKotoba ? 'Kotoba' : isQuiz ? `Kuis ${lesson.lesson_number - 3}` : `Video ${lesson.lesson_number}`
        return (
          <button
            type="button"
            onClick={() => openLesson(chap, lesson)}
            className="group w-full text-left mb-4 sm:mb-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/40 transition-all p-3.5 sm:p-4 flex items-center gap-3.5 sm:gap-4 cursor-pointer"
          >
            <span className={`size-12 sm:size-14 shrink-0 rounded-xl flex items-center justify-center text-white shadow-sm ${
              isQuiz ? 'bg-gradient-to-br from-indigo-500 to-indigo-700' : isKotoba ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-primary to-primary-dark'
            }`}>
              {isQuiz ? (
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ) : (
                <svg className="size-6 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 001.52.85l10.29-6.86a1 1 0 000-1.7L9.52 4.29A1 1 0 008 5.14z" /></svg>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold text-primary dark:text-red-400">
                {completedLessonsCount === 0 ? 'Mulai belajar' : 'Lanjutkan belajar'}
              </span>
              <span className="block text-[15px] sm:text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-1">{lesson.title}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                Bab {chap.bab_number} · {typeLabel} · {lesson.duration_text || lesson.duration_minutes} menit
              </span>
            </span>
            <span className="shrink-0 h-10 sm:px-4 w-10 sm:w-auto rounded-xl bg-primary group-hover:bg-primary-dark text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-colors">
              <span className="hidden sm:inline">{completedLessonsCount === 0 ? 'Mulai' : 'Lanjutkan'}</span>
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
            </span>
          </button>
        )
      })()}

      {/* ── Toolbar: jilid, filter, pencarian ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-3 sm:p-4 mb-4 sm:mb-5 flex flex-col lg:flex-row lg:items-center gap-3">
        <div role="tablist" aria-label="Pilih jilid" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 lg:w-80 shrink-0">
          <button
            role="tab"
            aria-selected={selectedJilid === 1}
            onClick={() => setSelectedJilid(1)}
            className={`min-h-11 px-2 rounded-lg border-none cursor-pointer transition-all flex flex-col items-center justify-center ${
              selectedJilid === 1 ? 'bg-white dark:bg-slate-900 text-primary dark:text-red-400 shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="text-sm font-bold leading-tight">Jilid 1</span>
            <span className="text-[11px] font-medium opacity-80 leading-tight">Bab 1–25</span>
          </button>
          <button
            role="tab"
            aria-selected={selectedJilid === 2}
            onClick={() => setSelectedJilid(2)}
            className={`min-h-11 px-2 rounded-lg border-none cursor-pointer transition-all flex flex-col items-center justify-center ${
              selectedJilid === 2 ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400'
            }`}
          >
            <span className="text-sm font-bold leading-tight flex items-center gap-1">
              Jilid 2
              <span className="text-[10px] font-bold uppercase px-1.5 py-px rounded-full bg-amber-400 text-amber-950">Segera</span>
            </span>
            <span className="text-[11px] font-medium opacity-80 leading-tight">Bab 26–50</span>
          </button>
        </div>

        {selectedJilid === 1 && (
          <>
            <div role="tablist" aria-label="Filter bab" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 lg:w-72 shrink-0">
              {([
                { key: 'all', label: 'Semua' },
                { key: 'progress', label: 'Berjalan' },
                { key: 'done', label: 'Selesai' },
              ] as const).map(f => (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={chapterFilter === f.key}
                  onClick={() => setChapterFilter(f.key)}
                  className={`min-h-10 px-2 rounded-lg text-[13px] sm:text-sm font-semibold border-none cursor-pointer transition-all ${
                    chapterFilter === f.key ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'bg-transparent text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative flex-1 min-w-0">
              <svg className="size-4.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                enterKeyHint="search"
                placeholder={t('mc_search_placeholder', 'Cari bab atau materi...')}
                value={searchBab}
                onChange={e => setSearchBab(e.target.value)}
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-base sm:text-sm text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchBab && (
                <button
                  type="button"
                  onClick={() => setSearchBab('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 border-none bg-transparent cursor-pointer"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Jilid 2: segera hadir ── */}
      {selectedJilid === 2 && (
        <div className="flex flex-col items-center justify-center py-12 sm:py-16 px-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-center gap-5">
          <div className="relative">
            <div className="size-20 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-4xl text-white shadow-lg font-serif font-black">二</div>
            <span className="absolute -top-2 -right-4 bg-amber-400 text-amber-950 text-[11px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shadow">Segera</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1.5">Minna no Nihongo — Jilid 2</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Materi <strong className="text-slate-700 dark:text-slate-200">Bab 26–50</strong> sedang disiapkan tim kaiwadojo. Selesaikan Jilid 1 terlebih dahulu, ya!
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
            {[26, 27, 28, 29, 30, 31, 32, 33].map(n => (
              <span key={n} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-400">第{n}課</span>
            ))}
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-400">+17 bab</span>
          </div>
          <button
            onClick={() => setSelectedJilid(1)}
            className="h-11 px-5 rounded-xl bg-primary hover:bg-primary-dark text-white text-sm font-bold border-none cursor-pointer transition-colors"
          >
            Kembali ke Jilid 1
          </button>
        </div>
      )}

      {/* ── Daftar bab ── */}
      {selectedJilid === 1 && (
        loading ? (
          <CourseCardSkeleton count={5} />
        ) : filteredChapters.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-10 text-center border border-slate-200 dark:border-slate-800 flex flex-col items-center gap-3">
            <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
              <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {chapterFilter === 'done' && !searchBab ? 'Belum ada bab yang tuntas' : 'Tidak ada bab yang cocok'}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {chapterFilter === 'done' && !searchBab ? 'Selesaikan semua materi dalam satu bab untuk melihatnya di sini.' : 'Coba ubah kata kunci atau filter.'}
            </p>
            <button
              onClick={() => { setSearchBab(''); setChapterFilter('all') }}
              className="mt-1 h-11 px-5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-bold border-none cursor-pointer"
            >
              Tampilkan Semua Bab
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredChapters.map(chap => {
              const isExpanded = expandedBabs.has(chap.bab_number)
              const completedInBab = chap.lessons.filter(l => l.is_completed).length
              const babPct = chap.lessons.length ? Math.round((completedInBab / chap.lessons.length) * 100) : 0
              const isDone = isChapterDone(chap)
              const targetGroupList = parseTargetGroups(chap.target_group)
              const isRestricted = targetGroupList.length > 0
              const plainTitle = chap.title.replace(/^(第\d+課|Bab\s+\d+):\s*/i, '')
              const hasNextUp = nextUp?.chap.bab_number === chap.bab_number

              return (
                <article
                  key={chap.bab_number}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border shadow-xs overflow-hidden transition-colors ${
                    isExpanded ? 'border-slate-300 dark:border-slate-700' : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleBabAccordion(chap.bab_number)}
                    aria-expanded={isExpanded}
                    className="w-full p-3.5 sm:p-4 flex items-center gap-3 sm:gap-4 text-left bg-transparent border-none cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Ring progres bab */}
                    <span
                      className="size-12 shrink-0 rounded-full p-[3px]"
                      style={{ background: `conic-gradient(${isDone ? '#10b981' : 'var(--color-primary)'} ${babPct * 3.6}deg, rgba(148,163,184,0.25) 0deg)` }}
                      aria-hidden="true"
                    >
                      <span className={`size-full rounded-full flex items-center justify-center text-sm font-black ${
                        isDone ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white'
                      }`}>
                        {isDone ? (
                          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        ) : chap.bab_number}
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-xs font-bold text-primary dark:text-red-400 font-serif">第{chap.bab_number}課</span>
                        {hasNextUp && (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-px rounded-full bg-primary/10 text-primary dark:text-red-300">Sedang dipelajari</span>
                        )}
                        {!shouldHideUnreleased && isRestricted && (
                          <span className="text-[11px] font-semibold px-2 py-px rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 truncate max-w-[12rem]">
                            Khusus: {targetGroupList.join(', ')}
                          </span>
                        )}
                        {!shouldHideUnreleased && chap.is_hidden && (
                          <span className="text-[11px] font-semibold px-2 py-px rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">Disembunyikan</span>
                        )}
                      </span>
                      <span className="block text-[15px] sm:text-base font-bold text-slate-900 dark:text-white leading-snug line-clamp-1">{plainTitle}</span>
                      <span className="block text-[13px] text-slate-500 dark:text-slate-400 line-clamp-1">{chap.subtitle}</span>
                    </span>

                    <span className="shrink-0 flex items-center gap-2 sm:gap-3">
                      <span className={`text-xs font-bold tabular-nums ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {completedInBab}/{chap.lessons.length}
                      </span>
                      <svg className={`size-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </span>
                  </button>

                  {isExpanded && (
                    <ul className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 animate-fade-in">
                      {chap.lessons.map(lesson => {
                        const { isKotoba, isQuiz, watchedCount, isQuizLocked } = getLessonState(chap, lesson)
                        const isNext = nextUp?.lesson.id === lesson.id
                        const typeLabel = isKotoba ? 'Kotoba' : isQuiz ? `Kuis ${lesson.lesson_number - 3}` : `Video ${lesson.lesson_number}`
                        const meta = isQuizLocked
                          ? `Tonton ${3 - watchedCount} video lagi untuk membuka`
                          : lesson.is_placeholder
                            ? t('mc_video_prep_desc', 'Video sedang disiapkan')
                            : isQuiz
                              ? t('mc_quiz_desc', '10 soal pilihan ganda')
                              : `${lesson.duration_text || lesson.duration_minutes} menit${lesson.replay_count ? ` · ditonton ${lesson.replay_count}x` : ''}`

                        return (
                          <li key={lesson.id}>
                            <button
                              type="button"
                              onClick={() => openLesson(chap, lesson)}
                              className={`w-full px-3.5 sm:px-4 py-3 flex items-center gap-3 text-left border-none cursor-pointer transition-colors ${
                                isNext ? 'bg-primary/[0.04] dark:bg-primary/10 hover:bg-primary/[0.07]' : 'bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              <span className={`relative size-11 shrink-0 rounded-xl flex items-center justify-center ${
                                isQuizLocked || lesson.is_placeholder
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                  : isQuiz
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                                    : isKotoba
                                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                                      : 'bg-primary/10 dark:bg-primary/20 text-primary dark:text-red-400'
                              }`}>
                                {isQuizLocked ? (
                                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>
                                ) : lesson.is_placeholder ? (
                                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 7v5l3 2" /></svg>
                                ) : isQuiz ? (
                                  <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                ) : isKotoba ? (
                                  <span className="font-serif font-black text-base">語</span>
                                ) : (
                                  <svg className="size-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 001.52.85l10.29-6.86a1 1 0 000-1.7L9.52 4.29A1 1 0 008 5.14z" /></svg>
                                )}
                                {lesson.is_completed && (
                                  <span className="absolute -bottom-1 -right-1 size-5 rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-slate-900 flex items-center justify-center">
                                    <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  </span>
                                )}
                              </span>

                              <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-2">
                                  <span className={`text-[11px] font-bold uppercase tracking-wide ${
                                    isQuiz ? 'text-indigo-600 dark:text-indigo-400' : isKotoba ? 'text-amber-600 dark:text-amber-400' : 'text-primary dark:text-red-400'
                                  }`}>{typeLabel}</span>
                                  {isNext && <span className="text-[10px] font-bold uppercase px-1.5 py-px rounded-full bg-primary text-white">Berikutnya</span>}
                                </span>
                                <span className={`block text-sm font-semibold leading-snug line-clamp-2 ${
                                  isQuizLocked || lesson.is_placeholder ? 'text-slate-500 dark:text-slate-400' : 'text-slate-900 dark:text-white'
                                }`}>{lesson.title}</span>
                                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{meta}</span>
                              </span>

                              {lesson.is_completed ? (
                                <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400">{t('completed', 'Selesai')}</span>
                              ) : (
                                <svg className="size-5 shrink-0 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              )}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </article>
              )
            })}
          </div>
        )
      )}

      {/* ── Modal Pemutar Materi ── */}
      {activeLesson && liveLesson && (
        <ModalPortal>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="lesson-player-title"
          className="modal-overlay fixed inset-0 z-[998] flex items-stretch sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm sm:p-4 lg:p-6 animate-fade-in"
          onClick={closePlayer}
        >
          <div
            className="relative w-full h-dvh sm:h-[min(92dvh,880px)] sm:max-w-6xl bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-fade-in-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <header className="shrink-0 flex items-center gap-3 px-3 sm:px-5 pt-[calc(0.625rem+env(safe-area-inset-top))] pb-2.5 sm:py-3.5 border-b border-slate-200 dark:border-slate-800">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-primary dark:text-primary-lighter truncate">
                  {modalChapter?.title || `Minna no Nihongo Jilid ${selectedJilid}`}
                </p>
                <h2 id="lesson-player-title" className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate leading-snug">
                  {liveLesson.title}
                </h2>
              </div>

              {modalChapter && (
                <div className="hidden sm:flex items-center gap-2.5 shrink-0 mr-1">
                  <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${modalChapterPct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                    {modalCompletedCount}/{modalLessons.length} selesai
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={closePlayer}
                aria-label="Tutup pemutar"
                className="size-10 shrink-0 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border-none cursor-pointer transition-colors"
              >
                <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </header>

            {/* Body */}
            <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
              <div className="flex-1 min-w-0 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

                  {/* Stage */}
                  {liveLesson.content_type === 'kotoba' ? (
                    <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 bg-amber-50/60 dark:bg-amber-950/20 flex items-center justify-center">
                      <div className="w-full max-w-md text-center flex flex-col items-center gap-3 py-6">
                        <div className="size-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-serif font-bold text-2xl shadow-sm">語</div>
                        <div>
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Setoran Kotoba</p>
                          <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug mt-0.5">Hafalkan kosakata bab ini</h3>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-1.5">
                            Kuasai kosakata dasar sebelum lanjut ke video tata bahasa, lalu tandai materi ini selesai.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleLessonComplete(activeLesson)}
                          className={`h-11 px-5 rounded-xl text-sm font-bold border-none cursor-pointer transition-colors flex items-center gap-2 ${
                            liveLesson.is_completed
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-amber-500 hover:bg-amber-600 text-white'
                          }`}
                        >
                          {liveLesson.is_completed && (
                            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          )}
                          {liveLesson.is_completed ? 'Sudah disetor' : 'Tandai selesai'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative flex-1 min-h-0 bg-slate-950 flex items-center justify-center sm:p-4 overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.06),transparent_65%)] pointer-events-none" />

                      {liveLesson.content_type === 'quiz' ? (
                        <div className="relative w-full max-w-md max-h-full overflow-y-auto text-center text-white flex flex-col items-center gap-3 px-5 py-8">
                          <div className="size-14 shrink-0 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                            </svg>
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300">Segera hadir</span>
                          <div>
                            <h3 className="text-lg font-bold leading-snug">Kuis sedang disiapkan</h3>
                            <p className="text-sm text-slate-400 leading-relaxed mt-1.5">
                              Soal pilihan ganda untuk bab ini sedang disusun dan divalidasi pengajar. Sambil menunggu, ulangi video materinya agar makin paham.
                            </p>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">Rencana: 10 soal pilihan ganda · nilai lulus 80%</p>
                        </div>
                      ) : liveLesson.video_id && isSubscriptionLocked ? (
                        <div className="relative w-full max-w-md max-h-full overflow-y-auto flex flex-col items-center">
                          <SubscriptionLockCard feature="Video materi" />
                        </div>
                      ) : liveLesson.video_id ? (
                        <div className="relative h-full aspect-[9/16] max-w-full bg-black sm:rounded-2xl overflow-hidden sm:shadow-2xl sm:ring-1 sm:ring-white/10">
                          <SmartVideoPlayer
                            key={`${modalChapter?.bab_number || 1}_${activeLesson.id}`}
                            lesson={activeLesson}
                            chapterBab={modalChapter?.bab_number || 1}
                            onLoadedMetadata={totalSecs => {
                              activeLesson.duration_text = `${Math.floor(totalSecs / 60)}.${String(Math.floor(totalSecs % 60)).padStart(2, '0')}`
                              activeLesson.duration_minutes = Math.ceil(totalSecs / 60)
                            }}
                            onEnded={() => {
                              handleIncrementReplay(activeLesson)
                              if (!activeLesson.is_completed) {
                                handleToggleLessonComplete(activeLesson)
                              }
                            }}
                          />
                        </div>
                      ) : (
                        <div className="relative w-full max-w-md max-h-full overflow-y-auto text-center text-white flex flex-col items-center gap-3 px-5 py-8">
                          <div className="size-14 shrink-0 rounded-2xl bg-white/10 text-slate-200 flex items-center justify-center">
                            <svg className="size-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300">Segera hadir</span>
                          <div>
                            <h3 className="text-lg font-bold leading-snug">Video sedang disiapkan</h3>
                            <p className="text-sm text-slate-400 leading-relaxed mt-1.5">
                              Pengajar sedang merekam dan mengunggah video ini. Kamu bisa lanjut ke materi lain dulu.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Info materi */}
                  <section className="shrink-0 px-4 sm:px-6 py-2.5 lg:py-4">
                    <div className="flex flex-wrap items-center gap-1.5 lg:mb-1.5">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
                        liveLesson.content_type === 'quiz'
                          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'
                          : 'bg-primary/10 text-primary dark:text-primary-lighter'
                      }`}>
                        {getLessonLabel(liveLesson)}
                      </span>
                      {liveLesson.is_completed ? (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1">
                          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Selesai
                        </span>
                      ) : null}
                      <span className="lg:hidden text-xs text-slate-500 dark:text-slate-400">
                        {liveLesson.duration_minutes} menit
                        {liveLesson.content_type === 'video' && !liveLesson.is_placeholder && <> · ditonton {liveLesson.replay_count || 0}×</>}
                      </span>
                    </div>
                    <h3 className="hidden lg:block text-lg font-bold text-slate-900 dark:text-white leading-snug">{liveLesson.title}</h3>
                    <p className="hidden lg:block text-sm text-slate-500 dark:text-slate-400 mt-1">
                      {liveLesson.duration_minutes} menit
                      {liveLesson.content_type === 'video' && !liveLesson.is_placeholder && <> · ditonton {liveLesson.replay_count || 0}×</>}
                    </p>
                    {liveLesson.content_type === 'video' && liveLesson.video_id && !liveLesson.is_completed && (
                      <p className="hidden lg:flex mt-3 text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-3 py-2.5 items-start gap-2">
                        <svg className="size-4 shrink-0 mt-0.5 text-primary dark:text-primary-lighter" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Tonton sampai akhir, materi akan otomatis ditandai selesai.</span>
                      </p>
                    )}
                  </section>

                </div>

                {/* Navigasi sebelumnya / berikutnya */}
                <nav
                  aria-label="Navigasi materi"
                  className="shrink-0 flex items-center gap-2 px-3 sm:px-6 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                >
                  <button
                    type="button"
                    disabled={!prevLesson}
                    onClick={() => prevLesson && modalChapter && openLesson(modalChapter, prevLesson)}
                    aria-label="Materi sebelumnya"
                    className="h-11 min-w-11 px-3 sm:px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white dark:disabled:hover:bg-slate-900"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    <span className="hidden sm:inline">Sebelumnya</span>
                  </button>

                  {/* HP/tablet: daftar materi dibuka sebagai sheet, bukan ikut di-scroll di bawah video */}
                  <button
                    type="button"
                    onClick={() => setShowPlaylistSheet(true)}
                    aria-label="Daftar materi di bab ini"
                    className="lg:hidden h-11 px-3 rounded-xl text-sm font-semibold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h10" /></svg>
                    <span>Materi</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">{modalCompletedCount}/{modalLessons.length}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!nextLesson}
                    onClick={() => nextLesson && modalChapter && openLesson(modalChapter, nextLesson)}
                    className="flex-1 sm:flex-none sm:ml-auto h-11 px-4 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 border-none bg-primary hover:bg-primary-dark text-white cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary min-w-0"
                  >
                    {nextLesson && modalChapter && getLessonState(modalChapter, nextLesson).isQuizLocked && (
                      <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                    <span className="truncate">
                      {nextLesson ? <>Berikutnya<span className="hidden sm:inline">: {getLessonLabel(nextLesson)}</span></> : 'Materi terakhir'}
                    </span>
                    <svg className="size-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </button>
                </nav>
              </div>

              {/* Daftar materi — desktop */}
              <aside className="hidden lg:flex w-[340px] shrink-0 flex-col border-l border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900">
                <div className="px-5 pt-5 pb-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Materi di bab ini</h4>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">{modalCompletedCount}/{modalLessons.length} selesai</span>
                  </div>
                  <div className="mt-2.5 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${modalChapterPct}%` }} />
                  </div>
                </div>
                <ul className="flex-1 min-h-0 overflow-y-auto px-3 pb-4 flex flex-col gap-1">
                  {modalLessons.map(l => <li key={l.id}>{renderPlaylistItem(l)}</li>)}
                </ul>
              </aside>
            </div>

            {/* Sheet daftar materi — HP/tablet */}
            {showPlaylistSheet && (
              <div className="lg:hidden absolute inset-0 z-20 flex items-end bg-slate-950/50 animate-fade-in" onClick={() => setShowPlaylistSheet(false)}>
                <div
                  role="dialog"
                  aria-label="Materi di bab ini"
                  onClick={e => e.stopPropagation()}
                  className="w-full max-h-[75%] flex flex-col bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl animate-fade-in-up"
                >
                  <div className="shrink-0 px-4 sm:px-6 pt-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white">Materi di bab ini</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{modalCompletedCount} dari {modalLessons.length} selesai</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPlaylistSheet(false)}
                        aria-label="Tutup daftar materi"
                        className="size-10 shrink-0 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-none cursor-pointer"
                      >
                        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                    <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${modalChapterPct}%` }} />
                    </div>
                  </div>
                  <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] flex flex-col gap-1">
                    {modalLessons.map(l => <li key={l.id}>{renderPlaylistItem(l)}</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Beautiful Custom Alert Modal */}
      <CustomAlertModal {...alertConfig} />
    </main>
  )
}
