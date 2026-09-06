/** Adı bilinen bir ödeme şekli kodunun tanımı. */
export interface PaymentMeansDefinition {
  /** UN/ECE 4461 ödeme şekli kodu — `cbc:PaymentMeansCode`. */
  readonly code: string
  /** Ödeme şeklinin Türkçe adı. */
  readonly name: string
}

/**
 * GİB'in kabul ettiği ödeme şekli kodlarının tamamı.
 *
 * Doğrulama bu küme üzerinden yapılır. Kümenin tamamının Türkçe adı
 * yayımlanmış değildir; adı bilinenler {@link PAYMENT_MEANS_DEFINITIONS}
 * içindedir. Adı olmayan bir kodu uydurmak yerine kod geçerli sayılır ve
 * adı `undefined` kalır.
 */
export const PAYMENT_MEANS_CODES: ReadonlySet<string> = new Set([
  '1',
  '2',
  '3',
  '4',
  '5',
  '10',
  '20',
  '23',
  '30',
  '31',
  '42',
  '48',
  '49',
  '50',
  '51',
  '60',
  '61',
  '62',
  '97',
  'ZZZ',
])

/**
 * Türkçe adı bilinen ödeme şekli kodları.
 *
 * Liste {@link PAYMENT_MEANS_CODES} kümesinin **alt kümesidir**: kod listesi
 * belgesinde etiketi yayımlanmış olanları içerir.
 */
export const PAYMENT_MEANS_DEFINITIONS: readonly PaymentMeansDefinition[] = [
  { code: '1', name: 'Ödeme Tipi Muhtelif' },
  { code: '10', name: 'Nakit' },
  { code: '20', name: 'Çek' },
  { code: '23', name: 'Banka Çeki' },
  { code: '42', name: 'Havale/EFT' },
  { code: '48', name: 'Kredi Kartı/Banka Kartı' },
  { code: 'ZZZ', name: 'Diğer' },
]

const PAYMENT_MEANS_MAP = new Map(PAYMENT_MEANS_DEFINITIONS.map((p) => [p.code, p]))

/**
 * Bir ödeme şekli kodunun tanımını döndürür.
 *
 * Kod geçerli ama Türkçe adı yayımlanmamışsa `undefined` döner; bu, kodun
 * geçersiz olduğu anlamına **gelmez**. Geçerliliği
 * {@link isValidPaymentMeansCode} söyler.
 *
 * @param code - UN/ECE 4461 kodu
 * @returns Tanım; adı bilinmiyorsa `undefined`
 *
 * @example
 * ```ts
 * paymentMeansDefinition('42')?.name // 'Havale/EFT'
 * paymentMeansDefinition('97')       // undefined — geçerli ama adı yayımlı değil
 * isValidPaymentMeansCode('97')      // true
 * ```
 */
export const paymentMeansDefinition = (code: string): PaymentMeansDefinition | undefined =>
  PAYMENT_MEANS_MAP.get(code)

/**
 * Bir ödeme şekli kodunun geçerli olup olmadığını söyler.
 *
 * @param code - Denetlenecek kod
 * @returns Kod GİB'in kabul ettiği kümede varsa `true`
 *
 * @example
 * ```ts
 * isValidPaymentMeansCode('42')      // true
 * isValidPaymentMeansCode('HAVALE')  // false — bu bir ad, kod değil
 * ```
 */
export const isValidPaymentMeansCode = (code: string): boolean => PAYMENT_MEANS_CODES.has(code)
