/**
 * Bir para biriminin, tutar aritmetiği için gereken tanımı.
 *
 * `minorUnits`, ISO 4217'nin "kaç ondalık basamak" değeridir ve para
 * aritmetiğinin tamamı buna dayanır: tutarlar kayan noktalı sayı olarak
 * değil, **tam sayı alt birim** olarak taşınır.
 */
export interface CurrencyDefinition {
  /** ISO 4217 üç harfli kod. */
  readonly code: string
  /** Ondalık basamak sayısı (ISO 4217). TRY için 2, JPY için 0, KWD için 3. */
  readonly minorUnits: number
  /** Ana birimin Türkçe adı — yazıyla tutarda kullanılır. */
  readonly name: string
  /**
   * Alt birimin Türkçe adı.
   *
   * "Kuruş" yalnızca Türk lirasının alt birimidir. Doları "kuruş" ile
   * yazmak yanlıştır ve incelenen bir pakette tam olarak bu yapılıyor.
   * Alt birimi olmayan para birimlerinde (JPY) `undefined`.
   */
  readonly subunit?: string
}

/**
 * UBL-TR belgelerinde kullanılan para birimleri.
 *
 * Liste bilerek kapalı değildir: bilinmeyen bir kod için
 * {@link currencyDefinition} makul bir varsayılan üretir, çünkü bir para
 * biriminin tabloda olmaması belgeyi düzenlemeyi engellememelidir.
 */
export const Currency = {
  TRY: { code: 'TRY', minorUnits: 2, name: 'Türk Lirası', subunit: 'Kuruş' },
  USD: { code: 'USD', minorUnits: 2, name: 'Amerikan Doları', subunit: 'Sent' },
  EUR: { code: 'EUR', minorUnits: 2, name: 'Euro', subunit: 'Sent' },
  GBP: { code: 'GBP', minorUnits: 2, name: 'İngiliz Sterlini', subunit: 'Peni' },
  CHF: { code: 'CHF', minorUnits: 2, name: 'İsviçre Frangı', subunit: 'Rapen' },
  JPY: { code: 'JPY', minorUnits: 0, name: 'Japon Yeni' },
  RUB: { code: 'RUB', minorUnits: 2, name: 'Rus Rublesi', subunit: 'Kopek' },
  CNY: { code: 'CNY', minorUnits: 2, name: 'Çin Yuanı', subunit: 'Fen' },
  SAR: { code: 'SAR', minorUnits: 2, name: 'Suudi Riyali', subunit: 'Halala' },
  AED: { code: 'AED', minorUnits: 2, name: 'BAE Dirhemi', subunit: 'Fils' },
  AZN: { code: 'AZN', minorUnits: 2, name: 'Azerbaycan Manatı', subunit: 'Kepik' },
  KWD: { code: 'KWD', minorUnits: 3, name: 'Kuveyt Dinarı', subunit: 'Fils' },
  BHD: { code: 'BHD', minorUnits: 3, name: 'Bahreyn Dinarı', subunit: 'Fils' },
} as const satisfies Record<string, CurrencyDefinition>

/** Tabloda tanımlı para birimi kodları. */
export type KnownCurrencyCode = keyof typeof Currency

/** UBL-TR belgelerinin varsayılan para birimi. */
export const DEFAULT_CURRENCY_CODE = 'TRY'

/**
 * Bir para birimi kodunun tanımını döndürür.
 *
 * Tabloda olmayan bir kod için iki ondalık basamaklı, alt birimi olmayan
 * bir tanım üretilir. Hata fırlatmak yerine makul varsayılan vermek
 * bilinçlidir: ISO 4217 listesi zamanla değişir ve tabloda eksik bir kod,
 * geçerli bir faturayı düzenlenemez hâle getirmemelidir. İki basamak,
 * ISO 4217'deki para birimlerinin büyük çoğunluğu için doğrudur.
 *
 * @param code - ISO 4217 üç harfli kod
 * @returns Para birimi tanımı; tabloda yoksa varsayılan tanım
 *
 * @example
 * ```ts
 * currencyDefinition('TRY').minorUnits // 2
 * currencyDefinition('JPY').minorUnits // 0 — yen'in alt birimi yoktur
 * currencyDefinition('KWD').minorUnits // 3 — dinar üç basamaklıdır
 * currencyDefinition('XYZ').minorUnits // 2 — bilinmeyen kod, varsayılan
 * ```
 */
export const currencyDefinition = (code: string): CurrencyDefinition => {
  const bilinen = (Currency as Record<string, CurrencyDefinition | undefined>)[code]
  return bilinen ?? { code, minorUnits: 2, name: code }
}
