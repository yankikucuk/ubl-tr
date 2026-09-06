import { UblTrError } from '../core/errors.js'

/**
 * Bir VKN ya da TCKN, kendi kontrol basamağı algoritmasından geçemedi.
 *
 * Uzunluk denetimi yeterli değildir: on haneli her sayı geçerli bir VKN
 * değildir. İncelenen üç UBL-TR paketinin **hiçbiri** kontrol basamağını
 * doğrulamıyor, yalnızca hane sayısına bakıyor. Sonuç: iki rakamı yer
 * değiştirmiş bir VKN belgeye yazılıyor, belge üretiliyor, gönderiliyor ve
 * GİB tarafından reddediliyor — hata, kaynağından çok uzakta ortaya çıkıyor.
 *
 * @example
 * ```ts
 * assertValidTaxIdentifier('1234567891', 'supplier.vkn')
 * // → InvalidTaxIdentifierError { kind: 'VKN', reason: 'checksum' }
 * ```
 */
export class InvalidTaxIdentifierError extends UblTrError {
  /**
   * @param value - Reddedilen numara
   * @param location - Hata mesajında görünecek alan yolu
   * @param reason - Reddedilme nedeni
   * @param kind - Uzunluğa göre belirlenen tür; belirlenemediyse `undefined`
   */
  constructor(
    /** Reddedilen numara. */
    public readonly value: string,
    /** Hata mesajında görünecek alan yolu. */
    public readonly location: string,
    /**
     * Reddedilme nedeni.
     *
     * - `'length'` — 10 (VKN) ya da 11 (TCKN) hane değil
     * - `'digits'` — rakam dışı karakter içeriyor
     * - `'leading-zero'` — TCKN sıfırla başlıyor
     * - `'checksum'` — biçim doğru ama kontrol basamağı tutmuyor
     */
    public readonly reason: 'length' | 'digits' | 'leading-zero' | 'checksum',
    /** Uzunluğa göre belirlenen tür. */
    public readonly kind: 'VKN' | 'TCKN' | undefined,
  ) {
    super(
      'INVALID_TAX_IDENTIFIER',
      `"${location}" alanındaki "${value}" geçerli bir ${kind ?? 'VKN/TCKN'} değil ` +
        `(${
          {
            length: 'hane sayısı VKN için 10, TCKN için 11 olmalı',
            digits: 'yalnızca rakam içerebilir',
            'leading-zero': 'TCKN sıfırla başlayamaz',
            checksum: 'kontrol basamağı tutmuyor — büyük olasılıkla yazım hatası',
          }[reason]
        }).`,
    )
  }
}

/**
 * Bir belge numarası, UBL-TR'nin 16 haneli biçimine uymuyor.
 *
 * GİB tüm e-belgelerde aynı numaralandırma düzenini şart koşar:
 * **3 harf + 4 haneli yıl + 9 haneli sıra numarası**. Harfler Türkçeye özgü
 * karakter içeremez.
 *
 * @example
 * ```ts
 * assertValidDocumentNumber('OUT', 'cbc:ID')
 * // → InvalidDocumentNumberError { reason: 'length' }
 * ```
 */
export class InvalidDocumentNumberError extends UblTrError {
  /**
   * @param value - Reddedilen numara
   * @param location - Hata mesajında görünecek alan yolu
   * @param reason - Reddedilme nedeni
   * @param detail - Nedene özgü ek bilgi; yıl uyuşmazlığında beklenen yıl
   */
  constructor(
    /** Reddedilen numara. */
    public readonly value: string,
    /** Hata mesajında görünecek alan yolu. */
    public readonly location: string,
    /**
     * Reddedilme nedeni.
     *
     * - `'length'` — 16 hane değil
     * - `'prefix'` — ilk üç hane A–Z aralığında üç harf değil
     * - `'year'` — 5.–8. haneler makul bir yıl değil
     * - `'sequence'` — son dokuz hane rakam değil
     * - `'year-mismatch'` — numaradaki yıl, düzenleme tarihinin yılıyla uyuşmuyor
     */
    public readonly reason: 'length' | 'prefix' | 'year' | 'sequence' | 'year-mismatch',
    /** Nedene özgü ek bilgi. */
    public readonly detail?: string,
  ) {
    super(
      'INVALID_DOCUMENT_NUMBER',
      `"${location}" alanındaki "${value}" geçerli bir belge numarası değil ` +
        `(${
          {
            length: '16 hane olmalı: 3 harf + 4 haneli yıl + 9 haneli sıra',
            prefix: 'ilk üç hane Türkçeye özgü karakter içermeyen üç harf olmalı (A–Z)',
            year: '5.–8. haneler dört haneli bir yıl olmalı',
            sequence: 'son dokuz hane yalnızca rakam olmalı',
            'year-mismatch': `numaradaki yıl düzenleme tarihiyle uyuşmuyor${
              detail === undefined ? '' : `; tarihe göre beklenen: ${detail}`
            }`,
          }[reason]
        }).`,
    )
  }
}

/**
 * Belge girdisi belgeye dönüştürülemiyor.
 *
 * `RangeError`'dan türer: girdi, kabul edilen değer aralığının dışındadır
 * ve üreticiler bu sözleşmeyi baştan beri taşır — `instanceof RangeError`
 * yakalayan mevcut kod çalışmaya devam eder. Üzerine iki alan ekler:
 *
 * - `code` — sürümler arası **kararlı** makine kodu; kararlar buna bakar
 * - `path` — hatanın hangi girdi alanından geldiği (`'billingReference'`,
 *   `'lines[2].withholdingCode'`)
 *
 * `path` olmadan bir form arayüzü hatayı yalnızca gösterebilir; `path` ile
 * hatalı alanı işaretleyebilir. `InvoiceSession` bu iki alanı doğrudan
 * doğrulama bulgusuna taşır, böylece üretim aşamasında reddedilen bir
 * belge de alan düzeyinde geri bildirim verir.
 *
 * Mesaj metni insan içindir ve sürümler arasında değişebilir.
 *
 * @example
 * ```ts
 * try {
 *   buildInvoiceXml(girdi)
 * } catch (hata) {
 *   if (hata instanceof DocumentInputError) {
 *     alaniIsaretle(hata.path) // 'billingReference'
 *     if (hata.code === 'MISSING_BILLING_REFERENCE') iadeAtfiAlaniniAc()
 *   }
 * }
 * ```
 */
export class DocumentInputError extends RangeError {
  /**
   * @param code - Sürümler arası kararlı makine kodu
   * @param path - Hatanın geldiği girdi alanı yolu
   * @param message - İnsan için açıklama; sürümler arası kararlı değildir
   */
  constructor(
    /** Sürümler arası kararlı makine kodu. */
    public readonly code: string,
    /** Hatanın geldiği girdi alanı yolu. */
    public readonly path: string,
    message: string,
  ) {
    super(message)
    this.name = 'DocumentInputError'
  }
}
