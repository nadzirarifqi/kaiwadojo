import { supabase } from './supabaseClient'

export interface ChapterSetting {
  bab_number: number
  title: string
  subtitle: string
  is_hidden: boolean // true = Sembunyikan dari siswa, false = Tampilkan
  has_video?: boolean // true jika video sudah diupload di server
  duration_s1?: string | number // Durasi Video 1 (Menit.Detik, contoh: 3.44)
  duration_s2?: string | number // Durasi Video 2 (Menit.Detik, contoh: 15.30)
  duration_s3?: string | number // Durasi Video 3 (Menit.Detik, contoh: 12.00)
  custom_video_s1?: string
  custom_video_s2?: string
  custom_video_s3?: string
}

export interface CourseHeaderSettings {
  page_title: string
  page_subtitle: string
}

const SETTINGS_KEY = 'kaiwa_chapter_settings_v2'
const HEADER_KEY = 'kaiwa_course_header_v2'

/* ── Default Chapter Titles for Jilid 1 (Bab 1 - 25) ── */
export const DEFAULT_JILID_1: { [key: number]: { title: string; subtitle: string; has_video: boolean } } = {
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
export const DEFAULT_JILID_2: { [key: number]: { title: string; subtitle: string; has_video: boolean } } = {
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

/* ── Fetch Chapter Settings (Merged from Supabase & LocalStorage) ── */
export async function getChapterSettingsMap(): Promise<Record<number, ChapterSetting>> {
  const result: Record<number, ChapterSetting> = {}

  // Populate default 1-50
  for (let i = 1; i <= 50; i++) {
    const def = i <= 25 ? DEFAULT_JILID_1[i] : DEFAULT_JILID_2[i]
    // Default rule: Only Bab 1 & 2 have video uploaded right now.
    // Bab 3-50 without video are hidden by default from students until admin uploads/publishes them.
    const isDefaultVisible = def?.has_video || false

    result[i] = {
      bab_number: i,
      title: def?.title || `Bab ${i}`,
      subtitle: def?.subtitle || '',
      is_hidden: !isDefaultVisible, // If no video, default to hidden for students
      has_video: isDefaultVisible,
    }
  }

  // 1. Read LocalStorage cache first
  try {
    const localStr = localStorage.getItem(SETTINGS_KEY)
    if (localStr) {
      const parsed = JSON.parse(localStr)
      Object.keys(parsed).forEach(k => {
        const babNum = Number(k)
        if (result[babNum]) {
          result[babNum] = { ...result[babNum], ...parsed[babNum] }
        }
      })
    }
  } catch (e) {
    console.error('LocalStorage read error:', e)
  }

  // 2. Try Supabase DB query (real-time sync across devices)
  try {
    const { data, error } = await supabase.from('chapter_settings').select('*')
    if (!error && data && data.length > 0) {
      data.forEach((item: any) => {
        if (result[item.bab_number]) {
          result[item.bab_number] = {
            ...result[item.bab_number],
            title: item.title || result[item.bab_number].title,
            subtitle: item.subtitle || result[item.bab_number].subtitle,
            is_hidden: typeof item.is_hidden === 'boolean' ? item.is_hidden : result[item.bab_number].is_hidden,
            has_video: typeof item.has_video === 'boolean' ? item.has_video : result[item.bab_number].has_video,
            duration_s1: item.duration_s1 != null ? String(item.duration_s1) : result[item.bab_number].duration_s1 ?? '15.00',
            duration_s2: item.duration_s2 != null ? String(item.duration_s2) : result[item.bab_number].duration_s2 ?? '15.00',
            duration_s3: item.duration_s3 != null ? String(item.duration_s3) : result[item.bab_number].duration_s3 ?? '12.00',
            custom_video_s1: item.custom_video_s1,
            custom_video_s2: item.custom_video_s2,
            custom_video_s3: item.custom_video_s3,
          }
        }
      })

      // Update LocalStorage cache with fresh DB data
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(result))
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    // Graceful fallback to LocalStorage if DB table doesn't exist
  }

  return result
}

export const CHAPTER_UPDATE_EVENT = 'kaiwa_chapter_updated'

export function notifyChapterChanged(detail?: any) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHAPTER_UPDATE_EVENT, { detail }))
  }
}

export function subscribeToChapterRealtime(onUpdate: () => void) {
  if (typeof window === 'undefined') return () => {}

  const channel = supabase
    .channel('public_chapter_settings_realtime_channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chapter_settings' }, () => {
      notifyChapterChanged()
      onUpdate()
    })
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/* ── Save Chapter Setting to LocalStorage & Supabase DB ── */
export async function saveChapterSetting(setting: ChapterSetting): Promise<boolean> {
  // 1. Save to Supabase DB for ground truth cross-user / cross-device synchronization
  try {
    const { error } = await supabase.from('chapter_settings').upsert({
      bab_number: setting.bab_number,
      title: setting.title,
      subtitle: setting.subtitle,
      is_hidden: setting.is_hidden,
      has_video: setting.has_video ?? !setting.is_hidden,
      duration_s1: setting.duration_s1 != null ? String(setting.duration_s1) : '15.00',
      duration_s2: setting.duration_s2 != null ? String(setting.duration_s2) : '15.00',
      duration_s3: setting.duration_s3 != null ? String(setting.duration_s3) : '12.00',
      custom_video_s1: setting.custom_video_s1 || null,
      custom_video_s2: setting.custom_video_s2 || null,
      custom_video_s3: setting.custom_video_s3 || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'bab_number' })

    if (error) {
      console.error('Supabase chapter_settings upsert error:', error.message)
      throw new Error(`Gagal menyimpan ke database Supabase: ${error.message}`)
    }
  } catch (err: any) {
    console.error('Supabase saveChapterSetting error:', err)
    if (err?.message?.includes('database')) {
      throw err
    }
  }

  // 2. Save to LocalStorage cache
  try {
    let map: Record<number, ChapterSetting> = {}
    const localStr = localStorage.getItem(SETTINGS_KEY)
    if (localStr) {
      map = JSON.parse(localStr)
    }
    map[setting.bab_number] = setting
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(map))
  } catch (e) {
    console.error('LocalStorage save error:', e)
  }

  notifyChapterChanged(setting)
  return true
}

/* ── Save Multiple Chapter Settings in Batch (Publish All / Hide All) ── */
export async function saveBatchChapterSettings(settingsList: ChapterSetting[]): Promise<boolean> {
  // 1. Batch upsert into Supabase DB
  try {
    const payload = settingsList.map(s => ({
      bab_number: s.bab_number,
      title: s.title,
      subtitle: s.subtitle,
      is_hidden: s.is_hidden,
      has_video: s.has_video ?? !s.is_hidden,
      duration_s1: s.duration_s1 != null ? String(s.duration_s1) : '15.00',
      duration_s2: s.duration_s2 != null ? String(s.duration_s2) : '15.00',
      duration_s3: s.duration_s3 != null ? String(s.duration_s3) : '12.00',
      custom_video_s1: s.custom_video_s1 || null,
      custom_video_s2: s.custom_video_s2 || null,
      custom_video_s3: s.custom_video_s3 || null,
      updated_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('chapter_settings').upsert(payload, { onConflict: 'bab_number' })
    if (error) {
      console.error('Supabase batch upsert error:', error.message)
      throw new Error(`Gagal batch update ke database Supabase: ${error.message}`)
    }
  } catch (err: any) {
    console.error('Supabase saveBatchChapterSettings error:', err)
    if (err?.message?.includes('database')) {
      throw err
    }
  }

  // 2. Save to LocalStorage cache
  try {
    let map: Record<number, ChapterSetting> = {}
    const localStr = localStorage.getItem(SETTINGS_KEY)
    if (localStr) {
      map = JSON.parse(localStr)
    }
    settingsList.forEach(s => {
      map[s.bab_number] = s
    })
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(map))
  } catch (e) {
    console.error('LocalStorage batch save error:', e)
  }

  notifyChapterChanged(settingsList)
  return true
}

/* -- Fetch Course Header Settings -- */
export async function getCourseHeaderSettings(): Promise<CourseHeaderSettings> {
  const defaultHeader: CourseHeaderSettings = {
    page_title: '📚 Buku Kursus Minna no Nihongo',
    page_subtitle: 'Pilih jilid buku dan pelajari 5 video materi + 1 kuis di setiap babnya',
  }

  try {
    const localStr = localStorage.getItem(HEADER_KEY)
    if (localStr) {
      return { ...defaultHeader, ...JSON.parse(localStr) }
    }
  } catch (e) {
    console.error(e)
  }

  return defaultHeader
}

/* -- Save Course Header Settings -- */
export async function saveCourseHeaderSettings(header: CourseHeaderSettings): Promise<boolean> {
  try {
    localStorage.setItem(HEADER_KEY, JSON.stringify(header))
    return true
  } catch (e) {
    console.error(e)
    return false
  }
}

/* ── Auto Detect Video Duration from File Metadata ── */
export function detectVideoDuration(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!url) {
      reject('No URL provided')
      return
    }

    const tempVideo = document.createElement('video')
    tempVideo.preload = 'metadata'
    tempVideo.src = url

    const timeout = setTimeout(() => {
      tempVideo.removeAttribute('src')
      tempVideo.load()
      reject('Timeout detecting video metadata')
    }, 12000)

    tempVideo.onloadedmetadata = () => {
      clearTimeout(timeout)
      const totalSeconds = tempVideo.duration
      if (!isNaN(totalSeconds) && totalSeconds > 0 && isFinite(totalSeconds)) {
        const mins = Math.floor(totalSeconds / 60)
        const secs = Math.floor(totalSeconds % 60)
        const formattedSecs = String(secs).padStart(2, '0')
        const resultStr = `${mins}.${formattedSecs}`
        tempVideo.removeAttribute('src')
        tempVideo.load()
        resolve(resultStr)
      } else {
        tempVideo.removeAttribute('src')
        tempVideo.load()
        reject('Invalid duration')
      }
    }

    tempVideo.onerror = () => {
      clearTimeout(timeout)
      tempVideo.removeAttribute('src')
      tempVideo.load()
      reject('Failed to load video metadata')
    }
  })
}
