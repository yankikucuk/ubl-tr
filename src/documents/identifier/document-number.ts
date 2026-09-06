import { InvalidDocumentNumberError } from '../errors.js'

/** Ayrıştırılmış belge numarasının parçaları. */
export interface ParsedDocumentNumber {
  /** İlk üç hane — Türkçeye özgü karakter içermeyen üç harf. */
  readonly prefix: string
  /** 5.–8. haneler — belgenin düzenlendiği yıl. */
  readonly year: number
  /** Son dokuz hane — sıra numarası; baştaki sıfırlar korunur. */
  readonly sequence: string
}

/**
 * UBL-TR belge numarasının biçimi: 3 harf + 4 haneli yıl + 9 haneli sıra.
 *
 * Harf kümesi bilerek `A-Z` ile sınırlıdır. GİB, seri kodunda Türkçeye özgü
 * harflere (Ç, Ğ, İ, Ö, Ş, Ü) izin vermez; ayrıca rakama da izin vermez.
 * Rakama izin veren daha gevşek bir desen — incelenen en yaygın pakette
 * `[A-Z0-9]{3}` kullanılıyor — `123` gibi bir seriyi geçerli sayar ve hata
 * karşı tarafın doğrulayıcısına kalır.
 */
const DOCUMENT_NUMBER = /^([A-Z]{3})(\d{4})(\d{9})$/

/** Numaradaki yılın makul kabul edildiği alt sınır — UBL-TR'nin yürürlük yılı. */
const MIN_YEAR = 2010

/**
 * Bir belge numarasını parçalarına ayırır.
 *
 * @param value - 16 haneli belge numarası
 * @returns Biçim doğruysa parçalar; değilse `undefined`
 *
 * @example
 * ```ts
 * parseDocumentNumber('ABC2026000000001')
 * // { prefix: 'ABC', year: 2026, sequence: '000000001' }
 *
 * parseDocumentNumber('OUT')     // undefined — 16 hane değil
 * parseDocumentNumber('123...')  // undefined — seri harf olmalı
 * ```
 */
export const parseDocumentNumber = (value: string): ParsedDocumentNumber | undefined => {
  const eslesme = DOCUMENT_NUMBER.exec(value)
  if (eslesme === null) return undefined
  const [, prefix, year, sequence] = eslesme
  if (prefix === undefined || year === undefined || sequence === undefined) return undefined
  return { prefix, year: Number(year), sequence }
}

/**
 * Bir belge numarasının UBL-TR biçimine uyup uymadığını söyler.
 *
 * @param value - Denetlenecek numara
 * @returns Biçim doğruysa `true`
 *
 * @example
 * ```ts
 * isValidDocumentNumber('ABC2026000000001') // true
 * isValidDocumentNumber('OUT')              // false
 * isValidDocumentNumber('ABC1999000000001') // false — yıl aralık dışı
 * ```
 */
export const isValidDocumentNumber = (value: string): boolean => {
  const parcalar = parseDocumentNumber(value)
  return parcalar !== undefined && parcalar.year >= MIN_YEAR
}

/** {@link assertValidDocumentNumber} seçenekleri. */
export interface DocumentNumberOptions {
  /**
   * Belgenin düzenleme tarihi (`YYYY-MM-DD`).
   *
   * Verilirse, numaradaki yıl segmentinin bu tarihin yılıyla aynı olduğu
   * denetlenir. GİB numaralandırmayı yıla bağlar: 2026'da düzenlenen bir
   * belgenin numarası `…2025…` olamaz. Bu çapraz denetimi incelenen
   * paketlerin hiçbiri yapmıyor; ikisi yıl segmentine hiç bakmıyor.
   */
  readonly issueDate?: string
}

/**
 * Bir belge numarasını doğrular; geçersizse nedenini söyleyen hata fırlatır.
 *
 * UBL-TR tüm e-belgelerde (fatura, irsaliye, serbest meslek makbuzu,
 * müstahsil makbuzu) aynı 16 haneli düzeni şart koşar. Bu kural XSD'de
 * değil, GİB kılavuzunda ve Schematron katmanında tanımlıdır — yani
 * `xmllint` ile şema doğrulaması yapan bir üretici bu hatayı **göremez**.
 *
 * Gerçek dünyadan örnek: Odoo'nun Türkiye e-İrsaliye modülü kök
 * `cbc:ID` alanına 16 haneli numara yerine üç harflik sıra kodunu (`OUT`)
 * yazıyordu. Belge XSD'den geçiyor, karşı taraf reddediyordu.
 *
 * @param value - Denetlenecek numara
 * @param location - Hata mesajında görünecek alan yolu (ör. `cbc:ID`)
 * @param options - Düzenleme tarihiyle çapraz denetim seçenekleri
 * @returns Ayrıştırılmış parçalar
 * @throws {InvalidDocumentNumberError} Numara geçersizse; `reason` alanı nedeni söyler
 *
 * @example
 * ```ts
 * const { prefix, year, sequence } = assertValidDocumentNumber(
 *   'ABC2026000000001',
 *   'cbc:ID',
 * )
 * ```
 *
 * @example Düzenleme tarihiyle çapraz denetim
 * ```ts
 * assertValidDocumentNumber('ABC2025000000001', 'cbc:ID', {
 *   issueDate: '2026-09-06',
 * })
 * // → InvalidDocumentNumberError { reason: 'year-mismatch', detail: '2026' }
 * ```
 *
 * @example Odoo'da görülen hata
 * ```ts
 * assertValidDocumentNumber('OUT', 'cbc:ID')
 * // → InvalidDocumentNumberError { reason: 'length' }
 * ```
 */
export const assertValidDocumentNumber = (
  value: string,
  location: string,
  options: DocumentNumberOptions = {},
): ParsedDocumentNumber => {
  if (value.length !== 16) {
    throw new InvalidDocumentNumberError(value, location, 'length')
  }
  if (!/^[A-Z]{3}/.test(value)) {
    throw new InvalidDocumentNumberError(value, location, 'prefix')
  }
  if (!/^[A-Z]{3}\d{4}/.test(value)) {
    throw new InvalidDocumentNumberError(value, location, 'year')
  }
  const parcalar = parseDocumentNumber(value)
  if (parcalar === undefined) {
    throw new InvalidDocumentNumberError(value, location, 'sequence')
  }
  if (parcalar.year < MIN_YEAR) {
    throw new InvalidDocumentNumberError(value, location, 'year')
  }

  if (options.issueDate !== undefined) {
    const tarihYili = Number(options.issueDate.slice(0, 4))
    if (Number.isInteger(tarihYili) && tarihYili !== parcalar.year) {
      throw new InvalidDocumentNumberError(value, location, 'year-mismatch', String(tarihYili))
    }
  }

  return parcalar
}
