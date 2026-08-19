import { supabase } from './supabaseClient'

export interface ChapterSetting {
  bab_number: number
  title: string
  subtitle: string
  is_hidden: boolean // true = Sembunyikan dari siswa, false = Tampilkan
  custom_video_s1?: string
  custom_video_s2?: string
  custom_video_s3?: string
}

export interface CourseHeaderSettings {
  page_title: string
  page_subtitle: string
}

const SETTINGS_KEY = 'kaiwa_chapter_settings_v1'
const HEADER_KEY = 'kaiwa_course_header_v1'

/* -- Default Chapter Titles for Jilid 1 (Bab 1 - 25) -- */
export const DEFAULT_JILID_1: { [key: number]: { title: string; subtitle: string } } = {
  1:  { title: 'Perkenalan Diri', subtitle: '??????????? (Saya adalah insinyur)' },
  2:  { title: 'Benda-benda Sekitar', subtitle: '?????? (Ini adalah buku)' },
  3:  { title: 'Tempat & Lokasi', subtitle: '??????? (Di sini adalah ruang kelas)' },
  4:  { title: 'Waktu & Waktu Kerja', subtitle: '?????? (Sekarang jam berapa?)' },
  5:  { title: 'Arah & Perpindahan', subtitle: '???????? (Pergi ke mana?)' },
  6:  { title: 'Kegiatan Sehari-hari', subtitle: '?????? (Minum air)' },
  7:  { title: 'Pemberian & Alat', subtitle: '????????? (Makan dengan sendok)' },
  8:  { title: 'Kata Sifat (Adjective)', subtitle: '???????? (Gunung Fuji tinggi)' },
  9:  { title: 'Kesukaan & Keahlian', subtitle: '???????? (Suka bahasa Jepang)' },
  10: { title: 'Keberadaan Benda/Orang', subtitle: '?????????? (Ada buku di atas meja)' },
  11: { title: 'Jumlah & Hitungan', subtitle: '???? 5????? (Minta 5 buah apel)' },
  12: { title: 'Bentuk Lampau & Perbandingan', subtitle: '??????? (Kemarin hujan)' },
  13: { title: 'Keinginan (Tai / Hoshii)', subtitle: '????????? (Ingin pergi ke Jepang)' },
  14: { title: 'Bentuk -Te (Permintaan)', subtitle: '??????????? (Tolong tunggu sebentar)' },
  15: { title: 'Izin & Larangan', subtitle: '??????????? (Boleh mengambil foto)' },
  16: { title: 'Urutan Kegiatan (-Te kara)', subtitle: '??????????? (Bangun pagi lalu cuci muka)' },
  17: { title: 'Bentuk -Nai (Nai de kudasai)', subtitle: '?????????? (Jangan khawatir)' },
  18: { title: 'Bentuk Kamus (Koto ga dekiru)', subtitle: '????????????? (Bisa bermain piano)' },
  19: { title: 'Bentuk -Ta (Pengalaman)', subtitle: '?????????????? (Pernah mendaki G. Fuji)' },
  20: { title: 'Biasa (Futsuukei)', subtitle: '?????????? (Besok mau pergi bareng?)' },
  21: { title: 'Pendapat (To omou / To iu)', subtitle: '????????????? (Saya pikir Jepang mahal)' },
  22: { title: 'Modifikasi Kata Benda', subtitle: '??????????? (Ini buku yang saya beli)' },
  23: { title: 'Waktu (Toki) & Syarat (To)', subtitle: '??????????? (Saat meminjam buku di perpustakaan)' },
  24: { title: 'Kurenai / Ageru / Morau', subtitle: '?????????? (Teman memberi saya buku)' },
  25: { title: 'Pengandaian (-Tara / -Demo)', subtitle: '???????????? (Jika hujan, tidak pergi)' },
}

/* -- Default Chapter Titles for Jilid 2 (Bab 26 - 50) -- */
export const DEFAULT_JILID_2: { [key: number]: { title: string; subtitle: string } } = {
  26: { title: 'Penjelasan Penilaian (n desu)', subtitle: '?????????? (Beli di mana sih?)' },
  27: { title: 'Bentuk Potensial (Dekiru)', subtitle: '???????? (Bisa bicara bahasa Jepang)' },
  28: { title: 'Dua Kegiatan Bersamaan (Nagara)', subtitle: '????????????? (Belajar sambil dengar musik)' },
  29: { title: 'Keadaan Otomatis (-Te imasu)', subtitle: '????????? (Pintunya sedang terbuka)' },
  30: { title: 'Persiapan (-Te okimasu)', subtitle: '????????????????? (Pesan hotel sebelum liburan)' },
  31: { title: 'Bentuk Maksud (Volitional Form)', subtitle: '??????????????? (Berniat beli besok)' },
  32: { title: 'Saran (-Hou ga ii / Shou)', subtitle: '????????????? (Sebaiknya olahraga tiap hari)' },
  33: { title: 'Perintah & Larangan (Meireikei)', subtitle: '????! (Lari cepat!)' },
  34: { title: 'Petunjuk (-Toori ni / Ato de)', subtitle: '????????????? (Rakit sesuai petunjuk)' },
  35: { title: 'Pengandaian (-Ba)', subtitle: '???????? (Kalau murah saya beli)' },
  36: { title: 'Usaha (You ni shimasu)', subtitle: '???????????????? (Usahakan makan sayur tiap hari)' },
  37: { title: 'Bentuk Pasif (Ukemi)', subtitle: '???????? (Digigit anjing)' },
  38: { title: 'Penggunaan No (Nominalisasi)', subtitle: '?????????? (Suka menggambar)' },
  39: { title: 'Sebab Akibat (-Te / De)', subtitle: '???????????????? (Kaget mendengar berita)' },
  40: { title: 'Ketidakpastian (Ka dou ka)', subtitle: '?????????????? (Tidak tahu keburu atau tidak)' },
  41: { title: 'Pemberian Hormat (Yaru/Itadaku)', subtitle: '?????????????? (Menerima kue dari pengajar)' },
  42: { title: 'Tujuan (Tame ni / Noni)', subtitle: '????????????????? (Menabung demi buka toko)' },
  43: { title: 'Kelihatan (Sou desu)', subtitle: '???????? (Kelihatannya mau hujan)' },
  44: { title: 'Berlebihan (Sugimasu)', subtitle: '??????? (Makan terlalu banyak)' },
  45: { title: 'Keadaan (Baai wa)', subtitle: '?????????????? (Jika terjadi kebakaran, evakuasi)' },
  46: { title: 'Waktu Tepat (Hazu / Tokoro)', subtitle: '???????????? (Baru mau berangkat sekarang)' },
  47: { title: 'Kabar/Dengar-dengar (Sou desu)', subtitle: '?????????????????? (Dengar-dengar besok cerah)' },
  48: { title: 'Bentuk Kausatif (Saseru)', subtitle: '??????????? (Menyuruh anak les)' },
  49: { title: 'Hormat Kenjougo & Sonkeigo I', subtitle: '?????????????? (Bapak Direktur sudah pulang)' },
  50: { title: 'Hormat Kenjougo & Sonkeigo II', subtitle: '?????? (Saya yang akan datang)' },
}

/* -- Fetch Chapter Settings (Supabase with LocalStorage fallback) -- */
export async function getChapterSettingsMap(): Promise<Record<number, ChapterSetting>> {
  const result: Record<number, ChapterSetting> = {}

  // Populate default first
  for (let i = 1; i <= 50; i++) {
    const def = i <= 25 ? DEFAULT_JILID_1[i] : DEFAULT_JILID_2[i]
    result[i] = {
      bab_number: i,
      title: def?.title || `Bab ${i}`,
      subtitle: def?.subtitle || '',
      is_hidden: false, // default: published/visible
    }
  }

  // 1. Try Supabase
  try {
    const { data } = await supabase.from('chapter_settings').select('*')
    if (data && data.length > 0) {
      data.forEach((item: any) => {
        if (result[item.bab_number]) {
          result[item.bab_number] = {
            ...result[item.bab_number],
            title: item.title || result[item.bab_number].title,
            subtitle: item.subtitle || result[item.bab_number].subtitle,
            is_hidden: typeof item.is_hidden === 'boolean' ? item.is_hidden : false,
            custom_video_s1: item.custom_video_s1,
            custom_video_s2: item.custom_video_s2,
            custom_video_s3: item.custom_video_s3,
          }
        }
      })
      return result
    }
  } catch (err) {
    console.warn('Supabase chapter_settings fetch failed, using local storage fallback:', err)
  }

  // 2. LocalStorage Fallback
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

  return result
}

/* -- Save Chapter Setting -- */
export async function saveChapterSetting(setting: ChapterSetting): Promise<boolean> {
  // Update LocalStorage first
  try {
    const map = await getChapterSettingsMap()
    map[setting.bab_number] = setting
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(map))
  } catch (e) {
    console.error('LocalStorage save error:', e)
  }

  // Try Supabase upsert
  try {
    const { error } = await supabase.from('chapter_settings').upsert({
      bab_number: setting.bab_number,
      title: setting.title,
      subtitle: setting.subtitle,
      is_hidden: setting.is_hidden,
      custom_video_s1: setting.custom_video_s1 || null,
      custom_video_s2: setting.custom_video_s2 || null,
      custom_video_s3: setting.custom_video_s3 || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'bab_number' })

    if (error) {
      console.warn('Supabase chapter_settings upsert error (using local storage):', error.message)
    }
  } catch (err) {
    console.warn('Supabase offline, saved to local storage:', err)
  }

  return true
}

/* -- Fetch Course Header Settings -- */
export async function getCourseHeaderSettings(): Promise<CourseHeaderSettings> {
  const defaultHeader: CourseHeaderSettings = {
    page_title: '?? Buku Kursus Minna no Nihongo',
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
