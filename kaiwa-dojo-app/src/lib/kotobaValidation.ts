/**
 * Validasi input Setoran Kotoba agar isian tidak asal-asalan.
 *
 * 1. Huruf Jepang : hanya hiragana / katakana / kanji (+ tanda baca Jepang), wajib ada kana/kanji,
 *                   tidak boleh huruf latin, tidak boleh diawali ー / huruf kecil, dan tidak berupa ketikan acak.
 * 2. Cara baca    : hanya huruf latin dengan susunan suku kata romaji yang wajar.
 *                   - Jika tulisan Jepang hanya kana → romaji harus cocok dengan bacaan kana tersebut.
 *                   - Jika ada kanji → bagian kana di awal/akhir (okurigana) harus cocok.
 * 3. Arti         : minimal satu kata berhuruf latin dan bukan ketikan acak.
 */

export interface KotobaInput {
  japanese: string
  romaji: string
  meaning: string
}

export interface KotobaValidation {
  isValid: boolean
  errors: Partial<Record<keyof KotobaInput, string>>
  /** Saran cara baca (hanya bila tulisan Jepang seluruhnya kana) */
  suggestedRomaji: string | null
  /** Nilai yang sudah dirapikan, siap disimpan */
  cleaned: KotobaInput
}

const KANA_KANJI_RE = /[぀-ゟ゠-ヿ㐀-䶿一-鿿々]/
const KANJI_RE = /[㐀-䶿一-鿿々]/
// Karakter yang boleh ada di kolom huruf Jepang (setelah normalisasi NFKC)
const JAPANESE_ALLOWED_RE = /^[぀-ゟ゠-ヿ㐀-䶿一-鿿々〆〜、。「」~!?0-9 ]+$/
const BAD_JAPANESE_START_RE = /^[ーっッぁぃぅぇぉゃゅょゎァィゥェォャュョヮ]/
const REPEATED_RE = /([^ー])\1{3,}/ // karakter sama 4x berturut-turut

/* ── Kana → romaji (Hepburn) ─────────────────────────────── */
const KANA_TABLE: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', ゐ: 'i', ゑ: 'e', を: 'o', ん: 'n', ゔ: 'vu',
}
const SMALL_Y: Record<string, string> = { ゃ: 'a', ゅ: 'u', ょ: 'o' }
const SMALL_VOWEL: Record<string, string> = { ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゎ: 'a' }

function katakanaToHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

/** Ubah tulisan kana menjadi romaji. Mengembalikan null bila ada kanji / karakter tak dikenal. */
export function kanaToRomaji(input: string): string | null {
  const s = katakanaToHiragana(input.normalize('NFKC'))
  let out = ''
  let pendingSokuon = false

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === 'っ') { pendingSokuon = true; continue }
    if (ch === 'ー') {
      const lastVowel = out.match(/[aiueo](?=[^aiueo]*$)/)?.[0]
      if (lastVowel) out += lastVowel
      continue
    }
    if (/[\s・、。「」〜~!?0-9]/.test(ch)) { out += ' '; continue }

    let syl: string | undefined = KANA_TABLE[ch]
    if (syl === undefined) {
      if (SMALL_VOWEL[ch]) syl = SMALL_VOWEL[ch]
      else if (SMALL_Y[ch]) syl = 'y' + SMALL_Y[ch]
      else return null // kanji atau karakter lain
    }

    // Kombinasi dengan huruf kecil berikutnya (きゃ, ファ, ティ, ウィ, シェ, ...)
    const next = s[i + 1]
    if (next && SMALL_Y[next] && syl.endsWith('i') && syl.length > 1) {
      const base = syl.slice(0, -1)
      syl = /(sh|ch|j)$/.test(base) ? base + SMALL_Y[next] : base + 'y' + SMALL_Y[next]
      i++
    } else if (next && SMALL_VOWEL[next] && next !== 'ゎ') {
      syl = (syl === 'u' ? 'w' : syl.replace(/[aiueo]$/, '')) + SMALL_VOWEL[next]
      i++
    }

    if (pendingSokuon) {
      syl = (syl.startsWith('ch') ? 't' : syl[0]) + syl
      pendingSokuon = false
    }
    out += syl
  }
  return out.replace(/\s+/g, ' ').trim()
}

/* ── Normalisasi romaji untuk perbandingan ───────────────── */
function expandMacrons(s: string): string {
  return s
    .replace(/[āâ]/g, 'aa').replace(/[īî]/g, 'ii').replace(/[ūû]/g, 'uu')
    .replace(/[ēê]/g, 'ee').replace(/[ōô]/g, 'ou')
}

/** Normalisasi ringan: huruf kecil, makron, ejaan Kunrei/wapuro → Hepburn, hanya huruf a-z. */
function lightKey(s: string): string {
  return expandMacrons(s.normalize('NFKC').toLowerCase())
    .replace(/[^a-z]/g, '')
    .replace(/sy/g, 'sh').replace(/ty/g, 'ch').replace(/(zy|jy|dy)/g, 'j')
    .replace(/si/g, 'shi').replace(/ti/g, 'chi').replace(/tu/g, 'tsu').replace(/hu/g, 'fu')
    .replace(/zi/g, 'ji').replace(/di/g, 'ji').replace(/du/g, 'zu').replace(/wo/g, 'o')
    .replace(/m(?=[bpm])/g, 'n')
}

/** Normalisasi longgar: juga menyamakan vokal panjang & konsonan ganda (toleran terhadap salah ketik kecil). */
function looseKey(s: string): string {
  return lightKey(s)
    .replace(/tch/g, 'ch')
    .replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, '$1')
    .replace(/w(?=[ie])/g, 'u') // ウィ/ウェ: wi = ui, we = ue
    .replace(/ou/g, 'o')
    .replace(/([aiueo])\1+/g, '$1')
}

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

/** Ketikan acak: 5 huruf berderet di keyboard (asdfg) atau 5+ konsonan beruntun. */
function looksLikeKeyboardMash(text: string): boolean {
  const lower = text.toLowerCase()
  if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(lower)) return true
  return KEYBOARD_ROWS.some(row => {
    for (let i = 0; i + 5 <= row.length; i++) {
      const seq = row.slice(i, i + 5)
      if (lower.includes(seq) || lower.includes([...seq].reverse().join(''))) return true
    }
    return false
  })
}

const ONSET = '(?:ky|gy|sy|zy|ty|dy|ny|hy|by|py|my|ry|jy|fy|vy|ch|sh|ts|th|dh|kw|gw|xy|ly|[kgsztdnhbpmyrwfvjlx])?'
const ROMAJI_SYLLABLES_RE = new RegExp(`^(?:${ONSET}[aiueo]|n|m(?=[bpm]))+$`)

/** Apakah teks tersusun dari suku kata romaji yang wajar? */
function isPlausibleRomaji(s: string): boolean {
  const letters = expandMacrons(s.normalize('NFKC').toLowerCase())
    .replace(/[^a-z]/g, '')
    .replace(/tch/g, 'ch')
    .replace(/([bcdfghjkmpqrstvwxyz])\1+/g, '$1') // konsonan ganda (っ), kecuali n
  return letters.length > 0 && ROMAJI_SYLLABLES_RE.test(letters)
}

/* ── Validasi utama ──────────────────────────────────────── */
export function validateKotobaInput(input: KotobaInput): KotobaValidation {
  const japanese = input.japanese.normalize('NFKC').replace(/\s+/g, ' ').trim()
  const romaji = input.romaji.normalize('NFKC').replace(/\s+/g, ' ').trim()
  const meaning = input.meaning.normalize('NFKC').replace(/\s+/g, ' ').trim()
  const errors: KotobaValidation['errors'] = {}
  let suggestedRomaji: string | null = null

  // 1. Huruf Jepang
  if (!japanese) {
    errors.japanese = 'Wajib diisi dengan huruf Jepang.'
  } else if (/[a-zA-Z]/.test(japanese)) {
    errors.japanese = 'Jangan pakai huruf latin. Tulis dengan hiragana, katakana, atau kanji.'
  } else if (!JAPANESE_ALLOWED_RE.test(japanese) || !KANA_KANJI_RE.test(japanese)) {
    errors.japanese = 'Hanya boleh hiragana (あ), katakana (ア), atau kanji (日).'
  } else if (japanese.length > 30) {
    errors.japanese = 'Terlalu panjang. Setor satu kosakata saja (maks. 30 karakter).'
  } else if (BAD_JAPANESE_START_RE.test(japanese)) {
    errors.japanese = 'Kosakata tidak bisa diawali ー atau huruf kecil (っ, ゃ, ぁ, …).'
  } else if (REPEATED_RE.test(japanese)) {
    errors.japanese = 'Sepertinya ketikan acak (huruf yang sama berulang). Periksa lagi.'
  }

  const hasKanji = KANJI_RE.test(japanese)
  const kanaReading = !errors.japanese && !hasKanji ? kanaToRomaji(japanese) : null
  if (kanaReading) suggestedRomaji = kanaReading

  // 2. Cara baca (romaji)
  if (!romaji) {
    errors.romaji = 'Wajib diisi dengan cara baca dalam huruf latin.'
  } else if (KANA_KANJI_RE.test(romaji)) {
    errors.romaji = 'Tulis cara baca dengan huruf latin (romaji), bukan huruf Jepang.'
  } else if (/[0-9]/.test(romaji) || /[^a-zA-ZāīūēōâîûêôĀĪŪĒŌ\s'’\-.]/.test(romaji)) {
    errors.romaji = 'Hanya boleh huruf latin, spasi, atau tanda hubung (-).'
  } else if (REPEATED_RE.test(romaji.toLowerCase()) || looksLikeKeyboardMash(romaji)) {
    errors.romaji = 'Sepertinya ketikan acak (huruf yang sama berulang). Periksa lagi.'
  } else if (!isPlausibleRomaji(romaji)) {
    errors.romaji = 'Bukan susunan romaji yang benar. Contoh penulisan: taberu, gakkou, raamen.'
  } else if (!errors.japanese) {
    if (kanaReading) {
      // Tulisan seluruhnya kana → bacaan harus cocok
      const target = looseKey(romaji)
      const candidates = [kanaReading]
      const hira = katakanaToHiragana(japanese)
      if (/は$/.test(hira)) candidates.push(kanaToRomaji(hira.replace(/は$/, 'わ')) || '')
      if (/へ$/.test(hira)) candidates.push(kanaToRomaji(hira.replace(/へ$/, 'え')) || '')
      if (!candidates.some(c => c && looseKey(c) === target)) {
        errors.romaji = `Cara baca tidak cocok dengan "${japanese}". Seharusnya: ${kanaReading}`
      }
    } else if (hasKanji) {
      // Ada kanji → cocokkan bagian kana di awal & akhir (okurigana)
      const prefix = japanese.match(/^[^㐀-䶿一-鿿々]+/)?.[0] ?? ''
      const suffix = japanese.match(/[^㐀-䶿一-鿿々]+$/)?.[0] ?? ''
      const key = lightKey(romaji)
      const prefixRomaji = prefix ? kanaToRomaji(prefix) : ''
      const suffixRomaji = suffix ? kanaToRomaji(suffix) : ''
      if (prefixRomaji && !key.startsWith(lightKey(prefixRomaji))) {
        errors.romaji = `Cara baca harus diawali "${prefixRomaji}" sesuai tulisan "${prefix}".`
      } else if (suffixRomaji && !key.endsWith(lightKey(suffixRomaji))) {
        errors.romaji = `Cara baca harus diakhiri "${suffixRomaji}" sesuai tulisan "${suffix}".`
      } else if (key.length <= lightKey((prefixRomaji || '') + (suffixRomaji || '')).length) {
        errors.romaji = 'Cara baca bagian kanjinya belum ditulis.'
      }
    }
  }

  // 3. Arti
  if (!meaning) {
    errors.meaning = 'Wajib diisi dengan arti dalam bahasa Indonesia.'
  } else if (!/[a-zA-ZÀ-ɏ]{2,}/.test(meaning)) {
    errors.meaning = 'Tulis arti dengan huruf latin (minimal satu kata).'
  } else if (meaning.length > 100) {
    errors.meaning = 'Terlalu panjang (maks. 100 karakter).'
  } else if (REPEATED_RE.test(meaning.toLowerCase())) {
    errors.meaning = 'Sepertinya ketikan acak (huruf yang sama berulang). Periksa lagi.'
  } else if (
    looksLikeKeyboardMash(meaning) ||
    meaning.split(/\s+/).some(w => w.length > 3 && /^[a-z]+$/i.test(w) && !/[aiueoy]/i.test(w))
  ) {
    errors.meaning = 'Sepertinya ketikan acak. Tulis arti kosakata dengan benar.'
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    suggestedRomaji,
    cleaned: { japanese, romaji, meaning },
  }
}
