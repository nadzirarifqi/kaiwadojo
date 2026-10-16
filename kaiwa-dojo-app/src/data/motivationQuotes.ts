/**
 * Kata penyemangat untuk halaman Kursus Saya: peribahasa & ungkapan Jepang (kotowaza)
 * beserta cara baca, arti, dan pesan yang relevan untuk perjalanan belajar bahasa Jepang.
 */

export interface MotivationQuote {
  jp: string
  reading: string
  meaning: string
  message: string
}

export const MOTIVATION_QUOTES: MotivationQuote[] = [
  { jp: '七転び八起き', reading: 'nana korobi ya oki', meaning: 'Jatuh tujuh kali, bangkit delapan kali.',
    message: 'Salah ucap atau lupa kosakata itu wajar. Yang penting, kamu selalu kembali belajar.' },
  { jp: '継続は力なり', reading: 'keizoku wa chikara nari', meaning: 'Ketekunan adalah kekuatan.',
    message: 'Satu video hari ini lebih berharga daripada lima video yang ditunda sampai minggu depan.' },
  { jp: '千里の道も一歩から', reading: 'senri no michi mo ippo kara', meaning: 'Perjalanan seribu ri dimulai dari satu langkah.',
    message: 'Fasih berbahasa Jepang dimulai dari satu bab. Buka materi berikutnya sekarang.' },
  { jp: '塵も積もれば山となる', reading: 'chiri mo tsumoreba yama to naru', meaning: 'Debu yang menumpuk akan menjadi gunung.',
    message: 'Lima kosakata sehari berarti lebih dari 1.800 kata dalam setahun.' },
  { jp: '石の上にも三年', reading: 'ishi no ue ni mo sannen', meaning: 'Duduk di atas batu pun, tiga tahun kemudian akan hangat.',
    message: 'Kesabaran selalu berbuah. Tetap konsisten, hasilnya pasti terasa.' },
  { jp: '習うより慣れよ', reading: 'narau yori nareyo', meaning: 'Lebih baik membiasakan diri daripada sekadar mempelajari.',
    message: 'Ucapkan kalimat dari video dengan suara keras. Mulut yang terbiasa akan lancar dengan sendirinya.' },
  { jp: '失敗は成功のもと', reading: 'shippai wa seikō no moto', meaning: 'Kegagalan adalah awal dari keberhasilan.',
    message: 'Nilai kuis yang belum sempurna adalah petunjuk bagian mana yang perlu diulang.' },
  { jp: '急がば回れ', reading: 'isogaba maware', meaning: 'Kalau terburu-buru, ambillah jalan memutar.',
    message: 'Kuasai dasarnya dengan benar. Fondasi yang kuat membuatmu lebih cepat di bab-bab berikutnya.' },
  { jp: '為せば成る', reading: 'naseba naru', meaning: 'Jika dilakukan, pasti bisa terwujud.',
    message: 'Tidak ada yang mustahil selama kamu mau memulainya.' },
  { jp: '初心忘るべからず', reading: 'shoshin wasuru bekarazu', meaning: 'Jangan lupakan semangat saat pertama kali memulai.',
    message: 'Ingat lagi alasanmu belajar bahasa Jepang. Semangat itu bahan bakar terbaikmu.' },
  { jp: '好きこそものの上手なれ', reading: 'suki koso mono no jōzu nare', meaning: 'Karena menyukainya, kita jadi mahir.',
    message: 'Nikmati prosesnya: tonton anime, dengarkan lagu, dan temukan sisi Jepang yang kamu sukai.' },
  { jp: '雨降って地固まる', reading: 'ame futte ji katamaru', meaning: 'Setelah hujan, tanah menjadi lebih padat.',
    message: 'Masa sulit dalam belajar justru membuat pemahamanmu semakin kokoh.' },
  { jp: '案ずるより産むが易し', reading: 'anzuru yori umu ga yasushi', meaning: 'Melakukannya lebih mudah daripada mengkhawatirkannya.',
    message: 'Takut salah bicara? Coba saja. Ternyata tidak sesulit yang dibayangkan.' },
  { jp: '猿も木から落ちる', reading: 'saru mo ki kara ochiru', meaning: 'Monyet pun bisa jatuh dari pohon.',
    message: 'Bahkan penutur asli pun bisa salah. Jangan terlalu keras pada dirimu sendiri.' },
  { jp: '雨垂れ石を穿つ', reading: 'amadare ishi o ugatsu', meaning: 'Tetesan air hujan bisa melubangi batu.',
    message: 'Usaha kecil yang terus diulang akan menembus tantangan yang paling keras sekalipun.' },
  { jp: '聞くは一時の恥、聞かぬは一生の恥', reading: 'kiku wa ittoki no haji, kikanu wa isshō no haji', meaning: 'Bertanya itu malu sesaat, tidak bertanya malu seumur hidup.',
    message: 'Bingung dengan materi? Tanyakan di kelas live. Tidak ada pertanyaan yang bodoh.' },
  { jp: '百聞は一見に如かず', reading: 'hyakubun wa ikken ni shikazu', meaning: 'Mendengar seratus kali tidak sebaik melihat sekali.',
    message: 'Tonton videonya, perhatikan ekspresi dan situasinya. Konteks membuat kosakata lebih mudah diingat.' },
  { jp: '早起きは三文の徳', reading: 'hayaoki wa sanmon no toku', meaning: 'Bangun pagi membawa keuntungan.',
    message: 'Belajar 15 menit di pagi hari, saat pikiran masih segar, sangat efektif untuk menghafal.' },
  { jp: '鉄は熱いうちに打て', reading: 'tetsu wa atsui uchi ni ute', meaning: 'Tempalah besi selagi panas.',
    message: 'Langsung kerjakan kuis setelah menonton video, selagi materinya masih segar di ingatan.' },
  { jp: '三人寄れば文殊の知恵', reading: 'sannin yoreba monju no chie', meaning: 'Tiga orang berkumpul, lahirlah kebijaksanaan.',
    message: 'Belajar bersama teman membuat materi sulit terasa lebih ringan.' },
  { jp: '笑う門には福来る', reading: 'warau kado ni wa fuku kitaru', meaning: 'Keberuntungan datang ke rumah yang penuh tawa.',
    message: 'Belajar dengan hati senang membuat materi lebih cepat menempel. Tersenyumlah!' },
  { jp: '実るほど頭を垂れる稲穂かな', reading: 'minoru hodo kōbe o tareru inaho kana', meaning: 'Semakin berisi, padi semakin merunduk.',
    message: 'Semakin banyak yang kamu kuasai, tetaplah rendah hati dan terus belajar.' },
  { jp: '井の中の蛙大海を知らず', reading: 'i no naka no kawazu taikai o shirazu', meaning: 'Katak dalam sumur tidak tahu luasnya samudra.',
    message: 'Bahasa Jepang membuka pintu ke dunia yang lebih luas. Teruslah menjelajah.' },
  { jp: '一生懸命', reading: 'isshōkenmei', meaning: 'Bersungguh-sungguh dengan sepenuh hati.',
    message: 'Berikan yang terbaik untuk satu materi hari ini. Itu sudah cukup untuk membuatmu maju.' },
  { jp: '明日は明日の風が吹く', reading: 'ashita wa ashita no kaze ga fuku', meaning: 'Besok akan bertiup angin yang lain.',
    message: 'Hari ini terasa berat? Istirahatlah sejenak. Besok adalah kesempatan baru untuk belajar.' },
]

/** Kutipan harian yang konsisten untuk tanggal yang sama. */
export function getDailyQuoteIndex(dateStr: string): number {
  let hash = 7
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 33 + dateStr.charCodeAt(i)) >>> 0
  }
  return hash % MOTIVATION_QUOTES.length
}
