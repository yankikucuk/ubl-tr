import {
  type CodeTables,
  currencyDefinition,
  DEFAULT_CURRENCY_CODE,
} from '../../constants/index.js'
import { type Decimal, rescale, toStringValue } from '../../core/index.js'

/** Birler basamağı. Sıfır ayrı ele alınır. */
const ONES = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'] as const

/** Onlar basamağı. */
const TENS = [
  '',
  'On',
  'Yirmi',
  'Otuz',
  'Kırk',
  'Elli',
  'Altmış',
  'Yetmiş',
  'Seksen',
  'Doksan',
] as const

/** Üçlü grup adları; dizin, grubun sağdan sırasıdır. */
const SCALES = ['', 'Bin', 'Milyon', 'Milyar', 'Trilyon', 'Katrilyon', 'Kentilyon'] as const

/**
 * 0–999 arası bir sayıyı Türkçe yazıya çevirir.
 *
 * Yüzler basamağında "Bir" söylenmez: 100 "Yüz"dür, "Bir Yüz" değil.
 *
 * @param value - 0 ile 999 arası sayı
 * @returns Boşlukla ayrılmış sözcükler; sıfır için boş dize
 */
const groupToWords = (value: number): string => {
  const yuzler = Math.floor(value / 100)
  const onlar = Math.floor((value % 100) / 10)
  const birler = value % 10
  const parcalar: string[] = []
  if (yuzler > 0) {
    // 100 → "Yüz", 200 → "İki Yüz"
    if (yuzler > 1) parcalar.push(ONES[yuzler] ?? '')
    parcalar.push('Yüz')
  }
  if (onlar > 0) parcalar.push(TENS[onlar] ?? '')
  if (birler > 0) parcalar.push(ONES[birler] ?? '')
  return parcalar.join(' ')
}

/**
 * Negatif olmayan bir tam sayıyı Türkçe yazıya çevirir.
 *
 * @param value - Çevrilecek tam sayı
 * @returns Türkçe yazılı hâli; sıfır için `'Sıfır'`
 * @throws {RangeError} Sayı desteklenen en büyük gruptan (kentilyon) büyükse
 *
 * @example
 * ```ts
 * integerToWords(0n)       // 'Sıfır'
 * integerToWords(1000n)    // 'Bin'          — "Bir Bin" değil
 * integerToWords(1000000n) // 'Bir Milyon'   — burada "Bir" söylenir
 * integerToWords(10500n)   // 'On Bin Beş Yüz'
 * ```
 */
export const integerToWords = (value: bigint): string => {
  if (value === 0n) return 'Sıfır'
  if (value < 0n) throw new RangeError('integerToWords negatif değer almaz.')

  const gruplar: number[] = []
  let kalan = value
  while (kalan > 0n) {
    gruplar.push(Number(kalan % 1000n))
    kalan /= 1000n
  }
  if (gruplar.length > SCALES.length) {
    throw new RangeError('Sayı, desteklenen en büyük basamak grubundan büyük.')
  }

  const parcalar: string[] = []
  for (let i = gruplar.length - 1; i >= 0; i -= 1) {
    const grup = gruplar[i] ?? 0
    if (grup === 0) continue
    // "Bin" Türkçede tek başına söylenir: 1.000 "Bin"dir, "Bir Bin" değil.
    // Bu istisna YALNIZCA bin grubuna özgüdür; 1.000.000 "Bir Milyon"dur.
    if (i === 1 && grup === 1) {
      parcalar.push('Bin')
      continue
    }
    parcalar.push(groupToWords(grup))
    if (i > 0) parcalar.push(SCALES[i] ?? '')
  }
  return parcalar.filter((p) => p !== '').join(' ')
}

/** {@link amountInWords} seçenekleri. */
export interface AmountInWordsOptions {
  /**
   * Gömülü para birimi tablosunun önüne geçen tanımlar.
   *
   * Ondalık basamak sayısı ve birim adları buradan okunur; bkz.
   * {@link CodeTables}.
   */
  readonly codeTables?: CodeTables
  /**
   * Harf biçimi. Varsayılan `'title'`.
   *
   * `'upper'` seçildiğinde dönüşüm `toLocaleUpperCase('tr')` ile yapılır.
   * Sade `toUpperCase()` Türkçe için **yanlıştır**: "Lirası" → "LIRASI"
   * (noktasız I) üretir, doğrusu "LİRASI"dır. İncelenen en yaygın paket
   * ürettiği her faturanın yazıyla tutar alanında tam olarak bu hatayı
   * yapıyor.
   */
  readonly case?: 'title' | 'upper'
}

/**
 * Bir tutarı Türkçe yazıya çevirir.
 *
 * Tutar **önce para biriminin ondalık basamağına yuvarlanır**, sonra ana ve
 * alt birime ayrılır. Sıra bu yüzden önemlidir: `1,999 TL` önce `2,00`
 * olur ve "İki Türk Lirası" yazılır. Önce ayırıp sonra yuvarlayan bir
 * uygulama "Bir Türk Lirası Yüz Kuruş" üretir — yüz kuruş diye bir şey
 * yoktur ve tutar yasal belgede yanlış yazılmış olur. Bu, incelenen bir
 * pakette canlı olarak doğrulandı.
 *
 * @param amount - Yazıya çevrilecek tutar
 * @param currencyCode - ISO 4217 kodu; varsayılan `'TRY'`
 * @param options - Harf biçimi seçenekleri
 * @returns Tutarın Türkçe yazılı hâli
 *
 * @example Temel kullanım
 * ```ts
 * amountInWords(decimal('1200.00'))  // 'Bin İki Yüz Türk Lirası'
 * amountInWords(decimal('10500.75')) // 'On Bin Beş Yüz Türk Lirası Yetmiş Beş Kuruş'
 * ```
 *
 * @example Yuvarlama önce yapılır
 * ```ts
 * amountInWords(decimal('1.999'))
 * // 'İki Türk Lirası' — "Bir Türk Lirası Yüz Kuruş" DEĞİL
 * ```
 *
 * @example Ana birim sıfır olduğunda alt birim düşmez
 * ```ts
 * amountInWords(decimal('0.50'))
 * // 'Sıfır Türk Lirası Elli Kuruş' — kuruş sessizce atılmaz
 * ```
 *
 * @example Para birimi ve alt birimi doğru adlandırır
 * ```ts
 * amountInWords(decimal('100.25'), 'USD') // 'Yüz Amerikan Doları Yirmi Beş Sent'
 * amountInWords(decimal('5000'), 'JPY')   // 'Beş Bin Japon Yeni' — yenin alt birimi yok
 * ```
 *
 * @example Türkçe büyük harf
 * ```ts
 * amountInWords(decimal('1200.00'), 'TRY', { case: 'upper' })
 * // 'BİN İKİ YÜZ TÜRK LİRASI' — noktalı İ; toUpperCase() 'LIRASI' verirdi
 * ```
 */
export const amountInWords = (
  amount: Decimal,
  currencyCode: string = DEFAULT_CURRENCY_CODE,
  options: AmountInWordsOptions = {},
): string => {
  const birim = currencyDefinition(currencyCode, options.codeTables)
  // ÖNCE yuvarla, SONRA ayır. Ters sıra "yüz kuruş" üretir.
  const yuvarli = rescale(amount, birim.minorUnits)
  const negatif = yuvarli.units < 0n
  const mutlak = negatif ? -yuvarli.units : yuvarli.units
  const bolen = 10n ** BigInt(birim.minorUnits)
  const anaBirim = mutlak / bolen
  const altBirim = mutlak % bolen

  const parcalar: string[] = []
  if (negatif) parcalar.push('Eksi')
  parcalar.push(integerToWords(anaBirim), birim.name)
  if (altBirim > 0n && birim.subunit !== undefined) {
    parcalar.push(integerToWords(altBirim), birim.subunit)
  }

  const sonuc = parcalar.join(' ')
  return options.case === 'upper' ? sonuc.toLocaleUpperCase('tr') : sonuc
}

/** {@link amountInWordsNote} seçenekleri. */
export interface AmountInWordsNoteOptions extends AmountInWordsOptions {
  /**
   * Yazının önüne eklenen etiket. Varsayılan `'YALNIZ'`.
   *
   * GİB kılavuzu etiketin kendisini şart koşmaz; alanın `#` ile sınırlanmış
   * olması beklenir. Uygulamada iki yaygın biçim var: `YALNIZ #…#` ve
   * `YAZIYLA:#…#`. Hangisini yazacağınız sizin tercihinizdir; bu yüzden
   * seçenek olarak bırakıldı, varsayılan seçilmiş bir değerdir.
   */
  readonly label?: string
}

/**
 * `cbc:Note` alanına yazılacak yazıyla tutar notunu üretir.
 *
 * @param amount - Tutar
 * @param currencyCode - ISO 4217 kodu; varsayılan `'TRY'`
 * @param options - Etiket ve harf biçimi
 * @returns `#` ile sınırlanmış not metni
 *
 * @example
 * ```ts
 * amountInWordsNote(decimal('1200.00'))
 * // 'YALNIZ #Bin İki Yüz Türk Lirası#'
 *
 * amountInWordsNote(decimal('1200.00'), 'TRY', { label: 'YAZIYLA:', case: 'upper' })
 * // 'YAZIYLA:#BİN İKİ YÜZ TÜRK LİRASI#'
 * ```
 */
export const amountInWordsNote = (
  amount: Decimal,
  currencyCode: string = DEFAULT_CURRENCY_CODE,
  options: AmountInWordsNoteOptions = {},
): string => {
  const etiket = options.label ?? 'YALNIZ '
  return `${etiket}#${amountInWords(amount, currencyCode, options)}#`
}

/**
 * Tutarın ondalık gösterimini para biriminin basamak sayısıyla üretir.
 *
 * @param amount - Yazılacak tutar
 * @param currencyCode - ISO 4217 kodu; varsayılan `'TRY'`
 * @returns XML'e yazılabilir ondalık metin
 *
 * @example
 * ```ts
 * formatAmount(decimal('1200'), 'TRY') // '1200.00'
 * formatAmount(decimal('1200'), 'JPY') // '1200'   — yenin ondalığı yoktur
 * formatAmount(decimal('1.5'), 'KWD')  // '1.500'  — dinar üç basamaklıdır
 * ```
 */
export const formatAmount = (
  amount: Decimal,
  currencyCode: string = DEFAULT_CURRENCY_CODE,
  tables?: CodeTables,
): string => toStringValue(amount, currencyDefinition(currencyCode, tables).minorUnits)
